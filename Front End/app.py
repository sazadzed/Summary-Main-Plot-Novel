"""
StoryMind Backend — Flask + spaCy NLP server.

Endpoints
─────────
  GET  /health              — readiness check
  POST /api/analyze         — full knowledge-package analysis

Request body (JSON)
  { "text": "story chapter string..." }

Response (JSON)
  Full knowledge package — see schema below.
"""

from __future__ import annotations

import re
import json
import textwrap
from collections import Counter
from dataclasses import dataclass, asdict
from typing import Optional

from flask import Flask, request, jsonify
from flask_cors import CORS
import spacy

# ── Load spaCy model once at startup ──────────────────────────────────────────
try:
    nlp = spacy.load("en_core_web_md")
except OSError:
    try:
        nlp = spacy.load("en_core_web_sm")
    except OSError:
        import sys
        print("ERROR: spaCy model not found. Run: python -m spacy download en_core_web_md --system", file=sys.stderr)
        sys.exit(1)


# ── App ───────────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)   # allow cross-origin requests from the frontend


# ═══════════════════════════════════════════════════════════════════════════════
# ANALYSIS HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def _sent_tokenize(text: str) -> list[str]:
    """Split into sentences, stripping whitespace."""
    doc = nlp(text)
    sents = [s.text.strip() for s in doc.sents if s.text.strip()]
    return sents if sents else [text[:200]]


def _build_doc(text: str):
    """Full spaCy parse."""
    return nlp(text)


# ── Sentiment ─────────────────────────────────────────────────────────────────

SENTIMENT_POSITIVE = {"love", "passion", "joy", "happy", "hope", "kind", "gentle",
                      "warm", "devotion", "tender", "embrace", "laugh", "smile"}
SENTIMENT_NEGATIVE = {"hate", "rage", "fury", "fear", "terror", "despair", "grief",
                      "sorrow", "cry", "tears", "bleak", "dark", "death", "murder",
                      "violence", "blood", "revenge", "betrayal", "trap"}

def _polarity(text: str) -> dict:
    lower = text.lower()
    pos = sum(1 for w in SENTIMENT_POSITIVE if w in lower)
    neg = sum(1 for w in SENTIMENT_NEGATIVE if w in lower)
    diff = pos - neg
    if diff > 1:  label = "Positive / Hopeful"
    elif diff < -1: label = "Negative / Dark"
    elif pos > 0 and neg > 0: label = "Mixed / Bittersweet"
    else: label = "Neutral / Contemplative"
    score = max(-1.0, min(1.0, diff / max(1, pos + neg)))
    return {"label": label, "score": round(score, 2)}


# ── Tone ──────────────────────────────────────────────────────────────────────

def _detect_tone(text: str) -> str:
    lower = text.lower()
    if any(w in lower for w in ["gloomy", "despair", "bleak", "grave", "ominous"]):
        return "Dark / Gothic"
    if any(w in lower for w in ["love", "passion", "devotion", "tender", "romantic"]):
        return "Romantic / Sentimental"
    if any(w in lower for w in ["battle", "war", "conquer", "blade", "army", "clash"]):
        return "Epic / Action"
    if any(w in lower for w in ["mystery", "secret", "shadow", "whisper", "clue", "noir"]):
        return "Mysterious / Noir"
    if any(w in lower for w in ["funny", "laugh", "humor", "comedy", "joke", "ridiculous"]):
        return "Comedic / Light"
    if any(w in lower for w in ["magic", "spell", "dragon", "realm", "prophesy", "enchant"]):
        return "Fantasy / Magical"
    if any(w in lower for w in ["alien", "spaceship", "robot", "cyber", "galaxy", "orbit"]):
        return "Sci-Fi"
    return "General / Literary"


# ── Setting ───────────────────────────────────────────────────────────────────

def _detect_setting(text: str) -> dict:
    lower = text.lower()
    if any(w in lower for w in ["manor", "estate", "duke", "lord", "lady", "castle", "throne", "knight", "squire"]):
        setting = "Medieval / Aristocratic"
    elif any(w in lower for w in ["city", "urban", "downtown", "office", "apartment", "subway"]):
        setting = "Contemporary / Urban"
    elif any(w in lower for w in ["forest", "woods", "meadow", "river", "clearing", "cottage"]):
        setting = "Natural / Rural"
    elif any(w in lower for w in ["ocean", "sea", "ship", "coast", "island", "port", "harbor"]):
        setting = "Maritime / Naval"
    elif any(w in lower for w in ["space", "galaxy", "starship", "orbit", "planet", "asteroid"]):
        setting = "Sci-Fi / Space"
    else:
        setting = "Unspecified"

    time_periods = []
    time_keywords = {
        "modern day": "Contemporary", "present day": "Contemporary",
        "twentieth century": "Early 20th Century", "nineteenth century": "Victorian Era",
        "nineteenth": "Victorian Era", "medieval": "Medieval", "ancient": "Ancient",
        "dusk": "Dusk / Evening", "dawn": "Dawn / Morning", "night": "Night",
        "afternoon": "Afternoon", "winter": "Winter", "summer": "Summer",
    }
    for kw, label in time_keywords.items():
        if kw in lower and label not in time_periods:
            time_periods.append(label)

    return {"setting": setting, "time_periods": time_periods}


# ── Entities (spaCy NER) ───────────────────────────────────────────────────────

SKIP_ENTITIES = {"I", "He", "She", "It", "They", "We", "You", "One", "Two", "Three",
                 "The", "This", "That", "A", "An", "All", "Some",
                 "Mr", "Mrs", "Ms", "Dr", "Sir", "Lady", "Lord",
                 # Languages / nationalities that spaCy mislabels as PERSON/GPE
                 "Italian", "Japanese", "English", "French", "German", "Chinese",
                 "Spanish", "Korean", "Russian", "American", "British", "Chinese",
                 "Asia", "Europe", "America", "Africa", "Australia", "Antarctica"}

BROAD_LOCATIONS = {"asia", "europe", "america", "africa", "australia", "antarctica",
                   "earth", "world", "planet", "continent", "region", "country"}

def _regex_names(text: str) -> list[str]:
    """Regex-based proper noun detection — catches names spaCy NER misses on first mention."""
    skip = SKIP_ENTITIES
    found = {}
    # Find capitalized words appearing 2+ times (more likely to be real names)
    words = re.findall(r'\b([A-Z][a-z]{1,18})\b', text)
    for w in words:
        if w not in skip:
            found[w] = found.get(w, 0) + 1
    # Also single-occurrence capitalized words that look like names (2-3 words, no common words)
    single_names = [w for w, c in found.items() if c == 1 and len(w) >= 3]
    multi_names   = [w for w, c in found.items() if c >= 2 and len(w) >= 3]
    return list(dict.fromkeys(multi_names + single_names[:4]))[:8]

def _extract_entities(doc):
    """Extract PERSON, GPE, LOC, ORG, DATE, TIME entities from spaCy doc."""
    entities = {
        "characters": [], "locations": [], "organizations": [],
        "dates_times": [], "objects": []
    }

    char_counter: Counter = Counter()
    loc_list: list[str] = []
    org_list: list[str] = []
    date_list: list[str] = []

    for ent in doc.ents:
        text = ent.text.strip()
        if not text or len(text) < 2:
            continue

        if ent.label_ == "PERSON":
            if text not in SKIP_ENTITIES and len(text) >= 3:
                char_counter[text] += 1

        elif ent.label_ == "GPE":
            if text in SKIP_ENTITIES:
                continue
            low = text.lower()
            if low in BROAD_LOCATIONS:
                continue
            # Filter out nation / language names that look like GPE to spaCy
            if low.endswith(('an', 'ese', 'ish', 'ic', 'ese')) and len(text) > 4:
                continue
            loc_list.append(text)

        elif ent.label_ == "LOC":
            low = text.lower()
            if low in BROAD_LOCATIONS:
                continue
            loc_list.append(text)

        elif ent.label_ == "ORG":
            if text in SKIP_ENTITIES:
                continue
            # Don't let character names become organizations
            if text in char_counter or text.lower() in (c.lower() for c in char_counter):
                continue
            org_list.append(text)

        elif ent.label_ in ("DATE", "TIME"):
            date_list.append(text)

    # Extract noun chunks as potential objects/artifacts
    noun_chunks = [nc.text for nc in doc.noun_chunks
                   if len(nc.text) > 4 and len(nc.text) < 40][:12]

    # Regex-based name detection as fallback / complement
    regex_names = _regex_names(doc.text)
    for name in regex_names:
        if name not in SKIP_ENTITIES:
            char_counter[name] = char_counter.get(name, 0) + 2  # boost priority

    # Sort characters by frequency (regex-boosted names float to top)
    entities["characters"] = [name for name, _ in char_counter.most_common(8)]
    entities["locations"]    = list(dict.fromkeys(loc_list))[:5]
    entities["organizations"] = list(dict.fromkeys(org_list))[:5]
    entities["dates_times"]  = list(dict.fromkeys(date_list))[:8]
    entities["objects"]       = noun_chunks[:8]

    return entities


# ── Character cards ───────────────────────────────────────────────────────────

def _build_character_cards(doc, characters: list[str], sentences: list[str]) -> list[dict]:
    lower = doc.text.lower()
    emotional_map = [
        ("fear|afraid|terrified|worried|anxious", "Anxious / Fearful"),
        ("angry|fury|hate|rage|hostile",           "Hostile / Angry"),
        ("sad|grief|sorrow|tears",                 "Grieving / Sorrowful"),
        ("love|passion|tender|devotion|embrace",   "Loving / Passionate"),
        ("determined|resolute|resolve|will",        "Determined / Resolute"),
        ("surprised|shocked|startled",             "Surprised / Startled"),
        ("hopeful|optimistic|wish|dream",          "Hopeful / Optimistic"),
        ("cold|distant|guarded|reserved|aloof",     "Guarded / Distant"),
        ("trust|loyal|devoted|faithful",           "Loyal / Trusting"),
        ("returned|came back|home",                 "Nostalgic / Returning"),
        ("secret|hidden|whisper|conspiracy",         "Secretive / Mysterious"),
    ]
    emotion = "Neutral / Uncertain"
    for pattern, label in emotional_map:
        if re.search(pattern, lower):
            emotion = label
            break

    verb_patterns = [
        (r"\b(killed|murdered|executed)\b",                  "Kills / Murder"),
        (r"\b(fled|escaped|ran|vanished|disappeared)\b",    "Flees / Escapes"),
        (r"\b(revealed|discovered|uncovered|learned)\b",   "Reveals / Discovers"),
        (r"\b(returned|came back|home)\b",                   "Returns"),
        (r"\b(told|whispered|said|spoke|asked|answered)\b", "Communicates"),
        (r"\b(attacked|fought|struck|clashed)\b",            "Attacks / Combats"),
        (r"\b(saw|noticed|observed|witnessed|sensed)\b",    "Perceives"),
        (r"\b(remembered|recalled|memories)\b",              "Recollects"),
        (r"\b(entered|crossed|arrived|came)\b",             "Arrives / Enters"),
        (r"\b(felt|experienced|sensed|trembled)\b",         "Experiences"),
        (r"\b(swore|promised|vowed|pledged)\b",             "Makes Vow"),
    ]
    verbs_found = [label for pat, label in verb_patterns if re.search(pat, lower)]

    cards = []
    for i, name in enumerate(characters[:6]):
        # Find first sentence this name appears in
        first_sent_idx = next(
            (j for j, s in enumerate(sentences) if name in s), 0
        )
        role = ("Protagonist / POV"  if i == 0 else
                "Key Ally / Antagonist" if i == 1 else
                "Supporting Character")

        rel = {}
        if i == 0 and len(characters) > 1:
            rel[characters[1]] = "Significant relationship (nature TBD)"
        if i == 1 and characters:
            rel[characters[0]] = "Significant relationship (nature TBD)"

        # Dominant tense
        verb_tenses = [tok.morph.get("Tense") for tok in doc
                       if tok.pos_ == "VERB" and tok.morph.get("Tense")]
        dominant_tense = (Counter(v for vs in verb_tenses for v in vs).most_common(1) or [["Unclear"]])[0][0]

        cards.append({
            "name":              name,
            "role":              role,
            "emotional_state":   emotion,
            "first_appearance":  f"Sentence {first_sent_idx + 1}",
            "key_actions":       verbs_found[:4] or ["General narrative involvement"],
            "relationships":     rel,
            "dominant_tense":    dominant_tense,
        })
    return cards


# ── Conflict ──────────────────────────────────────────────────────────────────

def _detect_conflict(text: str) -> str:
    lower = text.lower()
    if re.search(r"revenge|avenge|wronged|justice|payback", lower):
        return "Revenge / Justice Sought"
    if re.search(r"secret|hidden truth|conspiracy|cover-up", lower):
        return "Hidden Truth / Conspiracy"
    if re.search(r"love.{0,20}hate|loyalty.{0,20}betrayal|betrayal|trust", lower):
        return "Betrayal / Loyalty Conflict"
    if re.search(r"inheritance|power|throne|claim|right|succession", lower):
        return "Power / Inheritance Struggle"
    if re.search(r"survival|escape|trap|caught|hunted", lower):
        return "Survival / Capture"
    if re.search(r"duty|obligation|must.{0,15}(do|act|sacrifice)", lower):
        return "Moral / Duty Dilemma"
    return "Central Conflict (unspecified)"


# ── Ending type ───────────────────────────────────────────────────────────────

def _detect_ending(text: str) -> str:
    lower = text.lower()
    if re.search(r"to be continued|end of chapter|chapter ends", lower):
        return "Open — To Be Continued"
    if re.search(r"resolution|resolved|all was well|happily ever after|they lived", lower):
        return "Closed — Resolved"
    if re.search(r"mystery remains|unanswered|unresolved|doubt|fate", lower):
        return "Open — Mystery Remains"
    if re.search(r"\b(died|death|passed away|murdered)\b", lower):
        return "Closed — Tragic"
    return "Open — Turning Point / Climax"


# ── Lore & world-building ─────────────────────────────────────────────────────

def _extract_lore(text: str) -> list[dict]:
    lower = text.lower()
    lore = []

    if re.search(r"magic|magical|spell|enchant|mystic|arcane", lower):
        lore.append({"category": "Magic System",       "detail": "Magic system implied in narrative"})
    if re.search(r"prophecy|prophesy|foretold|destined|prophecy|omen", lower):
        lore.append({"category": "Prophecy / Destiny", "detail": "Prophecy or destiny theme detected"})
    if re.search(r"ancient|old|race|history|past|heritage|lineage", lower):
        lore.append({"category": "Historical Lore",    "detail": "Historical or ancestral lore implied"})
    if re.search(r"faction|guild|order|cult|clan|council|brotherhood", lower):
        lore.append({"category": "Organized Faction",  "detail": "Organized faction or group implied"})
    if re.search(r"artifact|relic|ancient weapon|cursed|blessed|enchanted", lower):
        lore.append({"category": "Magical Artifact",   "detail": "Magical artifact or relic mentioned"})
    if re.search(r"kingdom|empire|reign|royal|crown|scepter", lower):
        lore.append({"category": "Political Structure", "detail": "Royalty or political power structure present"})
    if re.search(r"war|battle|siege|army|soldier|knight|cavalry", lower):
        lore.append({"category": "Military / Conflict", "detail": "Military conflict or warfare present"})

    if not lore:
        lore.append({"category": "Lore", "detail": "No explicit world-building elements detected"})
    return lore


# ── Plot beats ────────────────────────────────────────────────────────────────

def _extract_beats(sentences: list[str], characters: list[str]) -> list[dict]:
    beats = []
    for i, sent in enumerate(sentences[:15]):
        clean = sent.strip()[:200]
        mentioned = [c for c in characters if c in clean]

        # Detect beat type
        lower = sent.lower()
        if re.search(r"\b(return|enter|arrive|cross|came)\b", lower):
            beat_type = "Entrance / Arrival"
        elif re.search(r"\b(whisper|say|tell|ask|answer|reply|speak)\b", lower):
            beat_type = "Dialogue / Exchange"
        elif re.search(r"\b(think|remember|recall|realize|understand)\b", lower):
            beat_type = "Reflection / Realization"
        elif re.search(r"\b(flee|escape|run|vanish|disappear)\b", lower):
            beat_type = "Departure / Escape"
        elif re.search(r"\b(fight|attack|battle|strike|clash|killed)\b", lower):
            beat_type = "Action / Combat"
        elif re.search(r"\b(door|candle|shadow|light|window|stairs)\b", lower):
            beat_type = "Environmental"
        elif re.search(r"\b(gasp|startle|shock|surprise|afraid|fear)\b", lower):
            beat_type = "Emotional Moment"
        else:
            beat_type = "Narrative Advance"

        beats.append({
            "beat_number": i + 1,
            "type": beat_type,
            "characters": mentioned,
            "text": clean,
        })
    return beats


# ── Summary bullets ───────────────────────────────────────────────────────────

def _build_summary(doc, sentences: list[str], characters: list[str],
                   entities: dict, sentiment: dict, tone: str,
                   conflict: str, ending: str, setting: dict,
                   verbs: list[str]) -> list[str]:
    first = sentences[0][:200] if sentences else doc.text[:200]
    last  = sentences[-1][:200] if sentences else first

    bullets = [
        f"  Setting: {setting['setting']}" +
        (f" | Time: {', '.join(setting['time_periods'])}" if setting["time_periods"] else "") + ".",
        f"  Tone/Genre: {tone}.",
        f"  Sentiment: {sentiment['label']} (score: {sentiment['score']})",
        f"  Central Conflict: {conflict}.",
        f"  Chapter Ending: {ending}.",
        f"  Key Action Verbs: {', '.join(verbs[:6]) or 'General narrative'}.",
        f"  Characters: {', '.join(characters) if characters else 'None detected'}.",
        f"  Locations: {', '.join(entities['locations']) if entities['locations'] else 'None specified'}.",
        f"  Organizations: {', '.join(entities['organizations']) if entities['organizations'] else 'None specified'}.",
        f"  Notable Objects: {', '.join(entities['objects'][:4]) if entities['objects'] else 'None specified'}.",
    ]
    return bullets


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINT
# ═══════════════════════════════════════════════════════════════════════════════

@app.route("/api/analyze", methods=["POST"])
def analyze():
    """
    Full NLP analysis of a story text.

    Request body:  { "text": "..." }
    Response:      Knowledge Package JSON (see schema)
    """
    data = request.get_json(silent=True) or {}
    raw_text = (data.get("text") or "").strip()

    if len(raw_text) < 10:
        return jsonify({"error": "Text too short to analyze. Provide at least 10 characters."}), 400

    # ── Core NLP ──
    doc       = _build_doc(raw_text)
    sentences = _build_doc(raw_text)  # re-parse for clean sentence list
    sentences = [s.text.strip() for s in doc.sents if s.text.strip()] or [raw_text[:200]]
    entities  = _extract_entities(doc)

    characters  = entities["characters"]
    sentiment   = _polarity(raw_text)
    tone        = _detect_tone(raw_text)
    setting     = _detect_setting(raw_text)
    conflict    = _detect_conflict(raw_text)
    ending      = _detect_ending(raw_text)
    lore        = _extract_lore(raw_text)
    beats       = _extract_beats(sentences, characters)

    # Verb analysis from POS tags
    verbs = [
        tok.lemma_.lower()
        for tok in doc
        if tok.pos_ == "VERB" and len(tok.text) > 3
    ]
    verb_counts = Counter(verbs)
    top_verbs   = [v.title() for v, _ in verb_counts.most_common(10)]

    # Character cards (requires entities)
    char_cards = _build_character_cards(doc, characters, sentences)

    # Summary
    summary = _build_summary(
        doc, sentences, characters, entities,
        sentiment, tone, conflict, ending, setting, top_verbs
    )

    # ── Assemble package ──
    package = {
        "meta": {
            "word_count":   len(raw_text.split()),
            "char_count":    len(raw_text),
            "sentence_count": len(sentences),
            "entity_count":  len(characters),
            "analyzer":      "spaCy / Flask backend",
        },
        "overall_summary": {
            "bullets":        summary,
            "tone":           tone,
            "sentiment":      sentiment,
            "conflict":       conflict,
            "ending_type":    ending,
            "setting":        setting,
        },
        "timeline": {
            "plot_beats": beats,
        },
        "characters": {
            "entities": characters,
            "cards":    char_cards,
        },
        "lore": {
            "items": lore,
        },
        "entities": entities,
        "top_verbs": top_verbs,
    }

    return jsonify(package)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": nlp.meta.get("lang","en") + "_" + nlp.meta.get("name","?")})


# ═══════════════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    print("\n StoryMind Backend")
    print(" ================")
    model_name = nlp.meta.get("lang","en") + "_" + nlp.meta.get("name","?")
    print("  SPAcY model :", model_name)
    print("  Server      : http://localhost:5000")
    print("  Endpoint    : POST /api/analyze")
    print("  Health      : GET  /health\n")
    app.run(host="127.0.0.1", port=5000, debug=False)

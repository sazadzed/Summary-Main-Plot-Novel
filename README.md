# StoryMind — Knowledge Package Generator

A warm, literary web tool that transforms raw story chapters into dense, AI-readable **Knowledge Packages** using real NLP.

## Architecture

```
Browser (HTML/CSS/JS)          Python Backend (Flask + spaCy)
─────────────────────          ─────────────────────────────
  app.js  ──────────POST──►  app.py → /api/analyze
                    ◄──JSON──  spaCy NER, POS tagging,
                    fallback   sentiment, entity extraction
```

## Quick Start

### 1. Start the backend (optional — falls back to client-side if offline)

```bash
cd d:\Coding\Cursor new

# Install dependencies (one-time)
python -m pip install flask flask-cors
python -m pip install spacy
python -m spacy download en_core_web_sm --system

# Run the server
python app.py
```

The backend runs on **http://localhost:5000**. The frontend auto-detects it.

### 2. Open the frontend

```bash
# Option A: double-click index.html

# Option B: local server (recommended)
python -m http.server 8000
# → open http://localhost:8000
```

## Features

### Backend (Flask + spaCy)
- **Named Entity Recognition (NER)** — spaCy detects PERSON, GPE, LOC, ORG, DATE entities
- **POS Tagging** — extracts verbs, adjectives, nouns from the story
- **Verb Analysis** — ranked list of dominant action verbs via lemma
- **Sentence Tokenization** — intelligent sentence boundary detection
- **Sentence-level Beat Classification** — categorizes each beat: Dialogue, Action, Reflection, etc.
- **Character Emotion Detection** — maps emotional markers to character states
- **Tense Detection** — identifies dominant narrative tense (past/present)
- **Richer Output** — includes locations, organizations, dates/times, notable objects

### Frontend (always available)
- Full client-side fallback — works without the backend
- Warm parchment UI with Playfair Display + Crimson Pro fonts
- 4 collapsible virtual folders (Summary, Timeline, Characters, Lore)
- 5th folder: Verb Analysis (spaCy mode only)
- Processing animation with spinning gear + typewriter text
- Staggered folder + line reveal animations
- Confetti burst on export
- Bouncy toast notifications
- Word/character count with count-up animation
- Export as `.txt` file
- `Ctrl + Enter` keyboard shortcut

## API

### `POST /api/analyze`

**Request:**
```json
{ "text": "Your story chapter here..." }
```

**Response:**
```json
{
  "meta": { "word_count", "char_count", "sentence_count", "entity_count", "analyzer" },
  "overall_summary": { "bullets", "tone", "sentiment", "conflict", "ending_type", "setting" },
  "timeline": { "plot_beats": [{ "beat_number", "type", "characters", "text" }] },
  "characters": { "entities": [...], "cards": [{ "name", "role", "emotional_state", "key_actions", "relationships" }] },
  "lore": { "items": [{ "category", "detail" }] },
  "entities": { "characters", "locations", "organizations", "dates_times", "objects" },
  "top_verbs": [...]
}
```

### `GET /health`
Returns `{"status": "ok", "model": "en_core_web_sm"}`

## Dependencies

| Package | Purpose |
|---|---|
| Flask | Web server |
| flask-cors | Cross-origin requests |
| spacy | NLP engine |
| en_core_web_sm | English language model |

## Project Structure

```
d:\Coding\Cursor new\
  index.html   — Frontend markup
  style.css    — All styles + animations
  app.js       — Frontend logic + API integration
  app.py       — Flask backend with spaCy NLP
  SPEC.md      — Design specification
  README.md    — This file
```

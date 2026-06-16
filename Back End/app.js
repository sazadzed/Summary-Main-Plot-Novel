/* ═══════════════════════════════════════════════════════════════════════════════
   StoryMind — Knowledge Package Generator (Frontend)
   Calls Flask backend at /api/analyze; falls back to client-side analysis.
═══════════════════════════════════════════════════════════════════════════════ */

const API_BASE = 'http://localhost:5000';

/* ── DOM refs ── */
const inputText         = document.getElementById('inputText');
const processBtn        = document.getElementById('processBtn');
const clearBtn          = document.getElementById('clearBtn');
const exportBtn         = document.getElementById('exportBtn');
const wordCount         = document.getElementById('wordCount');
const charCount         = document.getElementById('charCount');
const shortWarning      = document.getElementById('shortWarning');
const placeholder      = document.getElementById('placeholderState');
const outputContent    = document.getElementById('outputContent');
const processingOverlay= document.getElementById('processingOverlay');
const processingStage  = document.getElementById('processingStage');
const progressBar      = document.getElementById('progressBar');
const toast            = document.getElementById('toast');
const toastMsg         = document.getElementById('toastMsg');
const backendBadge     = document.getElementById('backendBadge');

let lastPackage = null;
let usingBackend = false;

/* ═══════════════════════════════════════════════════════════════════════════════
   API SERVICE
═══════════════════════════════════════════════════════════════════════════════ */

async function analyzeBackend(text) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal: controller.signal,
  });
  clearTimeout(timer);

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

/* ═══════════════════════════════════════════════════════════════════════════════
   CLIENT-SIDE FALLBACK ANALYSIS
═══════════════════════════════════════════════════════════════════════════════ */

function extractSentences(text) {
  return text.match(/[^.!?]+[.!?]+/g) || [text];
}

function detectTone(text) {
  const l = text.toLowerCase();
  if (/gloomy|despair|death|bleak|sorrow|cry|tears|grave/.test(l)) return 'Dark / Gothic';
  if (/love|heart|embrace|passion|tender|kiss|devotion/.test(l)) return 'Romantic / Sentimental';
  if (/battle|war|fight|blade|blood|violence|conquer/.test(l)) return 'Epic / Action';
  if (/mystery|secret|shadow|hidden|whisper|clue/.test(l)) return 'Mysterious / Noir';
  if (/comedy|funny|laugh|humor|ridiculous|joke/.test(l)) return 'Comedic / Light';
  if (/magic|spell|enchant|realm|dragon|prophesy/.test(l)) return 'Fantasy / Magical';
  if (/alien|spaceship|planet|future|robot|cyber/.test(l)) return 'Sci-Fi';
  return 'General / Literary';
}

function detectSetting(text) {
  const l = text.toLowerCase();
  if (/manor|estate|duke|lord|lady|castle|throne|knight/.test(l)) return 'Medieval / Aristocratic';
  if (/city|urban|streets|downtown|office|modern/.test(l)) return 'Contemporary / Urban';
  if (/forest|woods|creek|clearing|meadow|river/.test(l)) return 'Natural / Rural';
  if (/space|galaxy|starship|planet|orbit/.test(l)) return 'Sci-Fi / Space';
  if (/ocean|sea|ship|coast|island|port/.test(l)) return 'Maritime / Naval';
  return 'Unspecified';
}

function detectNames(text) {
  const sentences = extractSentences(text);
  const candidates = {};
  const skip = new Set(['The','And','But','For','Not','She','Her','His','One','Two','Three','Four','Five','This','That','With','From','Said','They','Them','When','What','Were','Was','All','Some','More',
                        'Italian','Japanese','English','French','German','Chinese','Spanish','Korean','Russian','American','British',
                        'Asia','Europe','America','Africa','Australia','Antarctica']);
  sentences.forEach(s => {
    const words = s.match(/(?:^|[\s'"])([A-Z][a-z]{1,20})/g) || [];
    words.forEach(w => {
      const clean = w.replace(/^[\s'"]+/, '');
      if (clean.length > 2 && !skip.has(clean)) candidates[clean] = (candidates[clean] || 0) + 1;
    });
  });
  return Object.entries(candidates)
    .filter(([_, c]) => c >= 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([n]) => n);
}

function detectActionVerbs(text) {
  const l = text.toLowerCase();
  const patterns = [
    [/\b(killed|murdered|executed)\b/, 'Kills/Murder'],
    [/\b(fled|escaped|ran|vanished|disappeared)\b/, 'Flees/Escapes'],
    [/\b(revealed|discovered|uncovered|learned)\b/, 'Reveals/Discovers'],
    [/\b(returned|came back)\b/, 'Returns'],
    [/\b(told|whispered|said|spoke|asked)\b/, 'Communicates'],
    [/\b(attacked|fought|struck|clashed)\b/, 'Attacks/Combats'],
    [/\b(saw|noticed|observed|witnessed|sensed)\b/, 'Perceives'],
    [/\b(remembered|recalled|memories)\b/, 'Recollects'],
    [/\b(entered|crossed|arrived|came)\b/, 'Arrives/Enters'],
    [/\b(felt|experienced|sensed|trembled)\b/, 'Experiences'],
    [/\b(swore|promised|vowed|pledged)\b/, 'Makes Vow'],
  ];
  const verbs = [];
  patterns.forEach(([re, label]) => { if (re.test(l)) verbs.push(label); });
  if (!verbs.length) verbs.push('General narrative progression');
  return [...new Set(verbs)];
}

function detectConflicts(text) {
  const l = text.toLowerCase();
  if (/revenge|avenge|wronged|justice|payback/.test(l)) return 'Revenge / Justice Sought';
  if (/secret|hidden truth|conspiracy|cover-up/.test(l)) return 'Hidden Truth / Conspiracy';
  if (/love|hate|loyalty|betrayal|trust/.test(l)) return 'Betrayal / Loyalty Conflict';
  if (/inheritance|power|throne|claim|right/.test(l)) return 'Power / Inheritance Struggle';
  if (/survival|escape|trap|caught|hunted/.test(l)) return 'Survival / Capture';
  if (/duty|obligation|must|should|have to/.test(l)) return 'Moral / Duty Dilemma';
  return 'Central Conflict (unspecified)';
}

function detectEnding(text) {
  const l = text.toLowerCase();
  if (/to be continued|end of chapter|chapter ends/.test(l)) return 'Open — To Be Continued';
  if (/resolution|resolved|all was well|happily ever after/.test(l)) return 'Closed — Resolved';
  if (/mystery remains|unanswered|unresolved|doubt/.test(l)) return 'Open — Mystery Remains';
  if (/death|died|passed/.test(l)) return 'Closed — Tragic';
  return 'Open — Turning Point / Climax';
}

function extractMagicFactions(text) {
  const l = text.toLowerCase();
  const lore = [];
  if (/magic|magical|spell|enchant|mystic/.test(l)) lore.push('Magic System Implied');
  if (/prophecy|prophesy|foretold|destined/.test(l)) lore.push('Prophecy / Destiny Theme');
  if (/ancient|old|race|history|past/.test(l)) lore.push('Historical Lore Implied');
  if (/faction|guild|order|cult|clan/.test(l)) lore.push('Organized Faction Implied');
  if (/artifact|relic|ancient weapon|cursed/.test(l)) lore.push('Magical Artifacts Mentioned');
  if (!lore.length) lore.push('None explicitly stated');
  return lore;
}

function clientSideGenerate(rawText) {
  const text = rawText.trim();
  const sentences = extractSentences(text);
  const names = detectNames(text);
  const verbs = detectActionVerbs(text);
  const tone = detectTone(text);
  const conflict = detectConflicts(text);
  const ending = detectEnding(text);
  const rawSetting = detectSetting(text);
  const lower = text.toLowerCase();

  const timeWords = [
    ['modern day','Contemporary'],['present day','Contemporary'],
    ['twentieth century','Early 20th Century'],['nineteenth century','Victorian Era'],
    ['medieval','Medieval'],['ancient','Ancient'],
    ['dusk','Dusk / Evening'],['dawn','Dawn / Morning'],['night','Night'],['afternoon','Afternoon'],
  ];
  const timePeriods = [];
  timeWords.forEach(([w, lbl]) => { if (lower.includes(w)) timePeriods.push(lbl); });

  const first = sentences[0]?.trim() || text.substring(0, 120);
  const last  = sentences[sentences.length - 1]?.trim() || sentences[0]?.trim();

  const summaryBullets = [
    `  Setting: ${rawSetting}${timePeriods.length ? ' | Time: ' + timePeriods.join(', ') : ''}.`,
    `  Tone/Genre: ${tone}.`,
    `  Central Conflict: ${conflict}.`,
    `  Key Action Verbs: ${verbs.slice(0,5).join(' | ')}.`,
    `  Characters: ${names.join(', ') || 'None detected'}.`,
    `  Chapter Ending: ${ending}.`,
  ];

  const beats = sentences.slice(0,12).map((s, i) => {
    const clean = s.trim().substring(0,180);
    const mentioned = names.filter(n => clean.includes(n));
    const verb = verbs.find(v => clean.toLowerCase().includes(v.split('/')[0].toLowerCase())) || 'Advances';
    return { beat_number: i+1, type: 'Narrative', characters: mentioned, text: clean };
  });

  const emotionMap = [
    ['returned|came back|home','Nostalgic / Returning'],['fear|afraid|terrified|worried','Anxious / Fearful'],
    ['angry|fury|hate|rage','Hostile / Angry'],['sad|grief|sorrow|tears','Grieving / Sorrowful'],
    ['determined|resolute|resolve','Determined / Resolute'],['surprised|shocked|startled','Surprised / Startled'],
    ['hopeful|optimistic|wish','Hopeful'],['cold|distant|guarded|reserved','Guarded / Distant'],
    ['trust|loyal|devoted','Loyal / Trusting'],
  ];
  let emotion = 'Neutral / Uncertain';
  emotionMap.forEach(([p, l]) => { if (lower.includes(p)) emotion = l; });

  const charCards = names.map((name, i) => {
    const rel = {};
    if (i===0 && names.length>1) rel[names[1]]='Significant relationship (nature TBD)';
    if (i===1 && names.length>0) rel[names[0]]='Significant relationship (nature TBD)';
    return { name, role: i===0?'Protagonist / POV':(i===1?'Key Ally / Antagonist':'Supporting Character'),
             emotional_state: emotion, first_appearance: `Sentence ${sentences.findIndex(s=>s.includes(name))+1||1}`,
             key_actions: verbs.slice(0,4), relationships: rel };
  });

  const loreItems = extractMagicFactions(text).map(l => ({ category:'Lore', detail:l }));

  return {
    meta: { word_count: text.split(/\s+/).length, char_count: text.length,
            sentence_count: sentences.length, entity_count: names.length,
            analyzer: 'Client-side (no backend)' },
    overall_summary: { bullets: summaryBullets, tone, sentiment:{label:'N/A',score:0},
                       conflict, ending_type: ending, setting:{setting:rawSetting,time_periods:timePeriods} },
    timeline: { plot_beats: beats },
    characters: { entities: names, cards: charCards },
    lore: { items: loreItems },
    entities: { characters:names, locations:[], organizations:[], dates_times:[], objects:[] },
    top_verbs: verbs,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════════
   ANIMATIONS
═══════════════════════════════════════════════════════════════════════════════ */

function typewriter(element, text, speed = 35) {
  element.textContent = '';
  let i = 0;
  const cursor = document.createElement('span');
  cursor.className = 'cursor-blink';
  element.appendChild(cursor);
  function tick() {
    if (i < text.length) {
      element.textContent = text.slice(0, i + 1);
      element.appendChild(cursor);
      i++;
      setTimeout(tick, speed);
    }
  }
  tick();
}

function confettiBurst() {
  const colors = ['#8B3A2A','#3A6B4A','#5C4A3A','#b84a38','#6B8F71','#C4956A'];
  for (let i = 0; i < 28; i++) {
    const dot = document.createElement('div');
    dot.className = 'confetti-dot';
    dot.style.cssText = `left:${45+Math.random()*10}%;top:${30+Math.random()*20}%;` +
      `background:${colors[Math.floor(Math.random()*colors.length)]};` +
      `width:${5+Math.random()*7}px;height:${5+Math.random()*7}px;` +
      `border-radius:${Math.random()>0.5?'50%':'2px'};` +
      `animation-delay:${Math.random()*200}ms;` +
      `animation-duration:${600+Math.random()*400}ms;` +
      `transform:translate(${(Math.random()-0.5)*200}px,0);`;
    document.body.appendChild(dot);
    setTimeout(() => dot.remove(), 1200);
  }
}

function addRipple(btn) {
  btn.classList.remove('clicked');
  void btn.offsetWidth;
  btn.classList.add('clicked');
  setTimeout(() => btn.classList.remove('clicked'), 600);
}

function countUp(element, target, suffix = '', duration = 400) {
  const start = parseInt(element.textContent.replace(/\D/g, '')) || 0;
  if (start === target) return;
  const startTime = performance.now();
  function step(now) {
    const elapsed = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - elapsed, 3);
    const current = Math.round(start + (target - start) * eased);
    element.textContent = current + suffix;
    if (elapsed < 1) requestAnimationFrame(step);
    else element.textContent = target + suffix;
  }
  requestAnimationFrame(step);
}

/* ═══════════════════════════════════════════════════════════════════════════════
   RENDER HELPERS
═══════════════════════════════════════════════════════════════════════════════ */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderJson(obj) {
  return JSON.stringify(obj, null, 2).split('\n').map(line =>
    line
      .replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:')
      .replace(/: "([^"]*)"([^,}]?)/g, ': <span class="json-string">"$1"</span>$2')
      .replace(/[{}\[\]]/g, m => `<span class="json-bracket">${m}</span>`)
  ).join('\n');
}

/* ═══════════════════════════════════════════════════════════════════════════════
   RENDER OUTPUT (works with both backend and client-side formats)
═══════════════════════════════════════════════════════════════════════════════ */

function renderOutput(data) {
  const summaryBullets = data.overall_summary.bullets;
  const beats          = data.timeline.plot_beats;
  const charCards      = data.characters.cards;
  const loreItems      = data.lore.items;

  const analyzer = data.meta?.analyzer || 'unknown';
  const isBackend  = analyzer.includes('spaCy') || analyzer.includes('Flask');

  const html = `
    <!-- Backend mode badge -->
    <div class="backend-badge${isBackend ? ' active' : ''}" id="backendBadge" style="
      display:flex;align-items:center;gap:8px;padding:6px 14px;border-radius:20px;
      border:1.5px solid ${isBackend?'var(--success)':'var(--border)'};
      background:${isBackend?'rgba(58,107,74,0.06)':'transparent'};
      color:${isBackend?'var(--success)':'var(--muted)'};
      font-family:'JetBrains Mono',monospace;font-size:11px;width:fit-content;
      animation:floatUp 0.4s cubic-bezier(0.22,1,0.36,1) both;">
      <span style="
        width:7px;height:7px;border-radius:50%;
        background:${isBackend?'var(--success)':'var(--muted)'};
        ${isBackend?'animation:pulse 2s ease-in-out infinite;':''}"></span>
      ${isBackend ? 'spaCy NLP (Live)' : 'Client-side mode'}
    </div>

    <!-- Meta stats strip -->
    <div style="display:flex;gap:16px;flex-wrap:wrap;animation:floatUp 0.4s 0.1s cubic-bezier(0.22,1,0.36,1) both;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted);">
        <span style="color:var(--accent);font-weight:600">${data.meta.word_count}</span> words
      </div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted);">
        <span style="color:var(--accent);font-weight:600">${data.meta.sentence_count}</span> sentences
      </div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted);">
        <span style="color:var(--accent);font-weight:600">${data.meta.entity_count}</span> characters
      </div>
    </div>

    <!-- Sentiment + Setting strip -->
    <div style="display:flex;gap:12px;flex-wrap:wrap;animation:floatUp 0.4s 0.15s cubic-bezier(0.22,1,0.36,1) both;">
      <span class="meta-tag">${escapeHtml(data.overall_summary.tone)}</span>
      <span class="meta-tag">${escapeHtml(data.overall_summary.conflict)}</span>
      <span class="meta-tag">${escapeHtml(data.overall_summary.ending_type)}</span>
    </div>

    <!-- Folder 1: Summary -->
    <div class="vfolder open" data-delay="0">
      <div class="vfolder-header">
        <svg class="folder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <span class="folder-name">01_COMPREHENSIVE_SUMMARY</span>
        <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
      <div class="vfolder-body">
        <div class="vfolder-content">
          <div class="file-line line-animated" style="animation-delay:0ms">
            <svg class="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            <span class="file-label">overall_plot.txt</span>
          </div>
          <div class="content-text">${summaryBullets.map((b,i) => `<div class="line-animated" style="animation-delay:${i*60}ms">${escapeHtml(b)}</div>`).join('')}</div>
        </div>
      </div>
    </div>

    <!-- Folder 2: Timeline -->
    <div class="vfolder open" data-delay="120">
      <div class="vfolder-header">
        <svg class="folder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <span class="folder-name">02_TIMELINE_and_PLOT_BEATS</span>
        <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
      <div class="vfolder-body">
        <div class="vfolder-content">
          <div class="file-line line-animated" style="animation-delay:120ms">
            <svg class="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            <span class="file-label">chronological_flow.log</span>
          </div>
          <div class="content-text">${beats.map((b,i) => {
            const beatType = b.type ? `<span style="color:var(--accent);font-weight:600">[${b.type}]</span> ` : '';
            const chars = b.characters?.length ? `<span style="color:#5C4A3A">${b.characters.join(' + ')} —</span> ` : '';
            return `<div class="line-animated" style="animation-delay:${120+i*50}ms">${beatType}${chars}"${escapeHtml(b.text.substring(0,180))}${b.text.length>180?'...':''}"</div>`;
          }).join('')}</div>
        </div>
      </div>
    </div>

    <!-- Folder 3: Characters -->
    <div class="vfolder open" data-delay="240">
      <div class="vfolder-header">
        <svg class="folder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <span class="folder-name">03_CHARACTER_DATABASE_UPDATES</span>
        <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
      <div class="vfolder-body">
        <div class="vfolder-content">
          <div class="file-line line-animated" style="animation-delay:240ms">
            <svg class="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            <span class="file-label">entities_status.json</span>
          </div>
          <div class="json-content line-animated" style="animation-delay:260ms">${renderJson(charCards)}</div>
        </div>
      </div>
    </div>

    <!-- Folder 4: Lore -->
    <div class="vfolder open" data-delay="360">
      <div class="vfolder-header">
        <svg class="folder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <span class="folder-name">04_LORE_and_WORLD_BUILDING</span>
        <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
      <div class="vfolder-body">
        <div class="vfolder-content">
          <div class="file-line line-animated" style="animation-delay:360ms">
            <svg class="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            <span class="file-label">world_context.db</span>
          </div>
          <div class="content-text">${loreItems.map((l,i) => `<div class="line-animated" style="animation-delay:${360+i*60}ms">  <span style="color:var(--accent)">[${escapeHtml(l.category)}]</span> ${escapeHtml(l.detail)}</div>`).join('')}</div>
        </div>
      </div>
    </div>

    <!-- Top Verbs (spaCy only) -->
    ${data.top_verbs?.length ? `
    <div class="vfolder" data-delay="480">
      <div class="vfolder-header">
        <svg class="folder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <span class="folder-name">05_VERB_ANALYSIS</span>
        <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
      <div class="vfolder-body">
        <div class="vfolder-content">
          <div class="content-text" style="display:flex;flex-wrap:wrap;gap:8px;padding-top:12px;">
            ${data.top_verbs.slice(0,12).map((v,i) => `<span class="verb-tag line-animated" style="animation-delay:${480+i*40}ms;display:inline-block;padding:4px 10px;border:1.5px solid var(--border);border-radius:12px;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--secondary);background:var(--bg);transition:all 150ms;">${escapeHtml(v)}</span>`).join('')}
          </div>
        </div>
      </div>
    </div>` : ''}
  `;

  placeholder.style.display = 'none';
  outputContent.style.display = 'flex';
  outputContent.style.flexDirection = 'column';
  outputContent.style.gap = '20px';
  outputContent.innerHTML = html;
  exportBtn.disabled = false;

  /* Stagger folder entrance */
  setTimeout(() => {
    document.querySelectorAll('.vfolder').forEach(f => {
      setTimeout(() => f.classList.add('visible'), parseInt(f.dataset.delay || 0));
    });
  }, 30);

  /* Folder toggle via delegation */
  outputContent.addEventListener('click', e => {
    const header = e.target.closest('.vfolder-header');
    if (header) header.parentElement.classList.toggle('open');
  });
}

/* ═══════════════════════════════════════════════════════════════════════════════
   EXPORT
═══════════════════════════════════════════════════════════════════════════════ */

function doExport() {
  if (!lastPackage) return;
  const d = lastPackage;

  const lines = [
    '================================================================',
    '  KNOWLEDGE PACKAGE — StoryMind',
    '  Generated: ' + new Date().toLocaleString(),
    `  Analyzer:  ${d.meta.analyzer}`,
    '================================================================',
    '',
    '== 01_COMPREHENSIVE_SUMMARY ==',
    'FILE: overall_plot.txt',
    '',
    ...d.overall_summary.bullets,
    '',
    `  Tone:       ${d.overall_summary.tone}`,
    `  Conflict:   ${d.overall_summary.conflict}`,
    `  Ending:     ${d.overall_summary.ending_type}`,
    '',
    '== 02_TIMELINE_and_PLOT_BEATS ==',
    'FILE: chronological_flow.log',
    '',
    ...d.timeline.plot_beats.map(b =>
      `  [Beat ${b.beat_number}]${b.type ? ` [${b.type}]` : ''} ${b.characters?.length?'('+b.characters.join(', ')+')':''} "${b.text.substring(0,180)}"`
    ),
    '',
    '== 03_CHARACTER_DATABASE_UPDATES ==',
    'FILE: entities_status.json',
    '',
    ...JSON.stringify(d.characters.cards, null, 2).split('\n').map(l => '  ' + l),
    '',
    '== 04_LORE_and_WORLD_BUILDING ==',
    'FILE: world_context.db',
    '',
    ...d.lore.items.map(l => `  [${l.category}] ${l.detail}`),
    d.top_verbs?.length ? '' : null,
    d.top_verbs?.length ? '== 05_VERB_ANALYSIS ==' : null,
    d.top_verbs?.length ? '  ' + d.top_verbs.slice(0,12).join(', ') : null,
    '================================================================',
  ].filter(Boolean);

  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'knowledge_package_' + Date.now() + '.txt';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);

  confettiBurst();
  showToast('Knowledge Package exported!');
}

/* ═══════════════════════════════════════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════════════════════════════════════ */

function showToast(msg) {
  toast.classList.remove('show','hiding');
  void toast.offsetWidth;
  toastMsg.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._dismissTimer);
  toast._dismissTimer = setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => toast.classList.remove('show','hiding'), 320);
  }, 3500);
}

/* ═══════════════════════════════════════════════════════════════════════════════
   PROCESSING PIPELINE
═══════════════════════════════════════════════════════════════════════════════ */

async function runProcessing() {
  const text = inputText.value.trim();
  if (!text) return;

  processingOverlay.classList.add('active');
  processBtn.disabled = true;

  const stages = [
    { text: 'Connecting to NLP engine...',   progress: 20, speed: 500 },
    { text: 'Parsing narrative structure',  progress: 40, speed: 700 },
    { text: 'Extracting named entities',    progress: 65, speed: 600 },
    { text: 'Building knowledge package',   progress: 90, speed: 500 },
    { text: 'Finalizing output',            progress: 100, speed: 400 },
  ];

  let data = null;
  let usedBackend = false;

  for (let i = 0; i < stages.length; i++) {
    typewriter(processingStage, stages[i].text, 28);
    progressBar.style.width = stages[i].progress + '%';
    await new Promise(r => setTimeout(r, stages[i].speed));

    /* Attempt backend call on first real processing stage */
    if (i === 1 && !data) {
      try {
        processingStage.innerHTML = 'spaCy NLP active<span class="cursor-blink"></span>';
        data = await analyzeBackend(text);
        usedBackend = true;
      } catch (err) {
        processingStage.innerHTML = 'Backend offline &mdash; client mode<span class="cursor-blink"></span>';
        await new Promise(r => setTimeout(r, 800));
        data = clientSideGenerate(text);
      }
    }
  }

  /* Final flash */
  progressBar.style.transition = 'none';
  progressBar.style.width = '100%';
  progressBar.style.boxShadow = '0 0 16px rgba(139,58,42,0.7)';
  await new Promise(r => setTimeout(r, 250));
  progressBar.style.transition = 'width 300ms ease';
  progressBar.style.width = '0%';
  progressBar.style.boxShadow = 'none';

  processingOverlay.classList.remove('active');

  /* Pop process button */
  processBtn.style.transform = 'scale(1.15)';
  processBtn.style.boxShadow = '0 0 0 6px rgba(139,58,42,0.2)';
  setTimeout(() => { processBtn.style.transform = ''; processBtn.style.boxShadow = ''; }, 250);
  processBtn.disabled = false;

  lastPackage = data;
  usingBackend = usedBackend;
  renderOutput(data);
}

/* ═══════════════════════════════════════════════════════════════════════════════
   STATS & INPUT
═══════════════════════════════════════════════════════════════════════════════ */

function updateStats() {
  const text = inputText.value.trim();
  const words = text ? text.split(/\s+/).length : 0;
  const chars = text.length;
  countUp(wordCount, words, ' word' + (words!==1?'s':''));
  countUp(charCount, chars, ' character' + (chars!==1?'s':''));
  processBtn.disabled = words < 3;
  if (words >= 3) processBtn.classList.add('ready');
  else processBtn.classList.remove('ready');
  const wasHidden = !shortWarning.classList.contains('visible');
  shortWarning.classList.toggle('visible', words>0 && words<50);
  if (wasHidden && words>0 && words<50) {
    shortWarning.style.animation='none'; void shortWarning.offsetWidth;
    shortWarning.style.animation='';
  }
}
inputText.addEventListener('input', updateStats);

inputText.addEventListener('input', () => {
  inputText.style.height = 'auto';
  inputText.style.height = Math.max(360, inputText.scrollHeight) + 'px';
});

/* ═══════════════════════════════════════════════════════════════════════════════
   BUTTON EVENTS
═══════════════════════════════════════════════════════════════════════════════ */

processBtn.addEventListener('click', () => { addRipple(processBtn); runProcessing(); });

clearBtn.addEventListener('click', () => {
  addRipple(clearBtn);
  inputText.value = ''; updateStats();
  placeholder.style.display = 'flex';
  outputContent.style.display = 'none';
  outputContent.innerHTML = ''; lastPackage = null;
  exportBtn.disabled = true;
  shortWarning.classList.remove('visible');
  inputText.style.height = 'auto';
});

exportBtn.addEventListener('click', () => { addRipple(exportBtn); doExport(); });

/* ═══════════════════════════════════════════════════════════════════════════════
   KEYBOARD SHORTCUT
═══════════════════════════════════════════════════════════════════════════════ */

inputText.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    if (!processBtn.disabled) { addRipple(processBtn); runProcessing(); }
  }
});

/* ═══════════════════════════════════════════════════════════════════════════════
   DRAG & DROP FILE LOADING
═══════════════════════════════════════════════════════════════════════════════ */

const dropZone      = document.getElementById('dropZone');
const dropZoneInner = document.getElementById('dropZoneInner');
const fileInput     = document.getElementById('fileInput');

function loadFile(file) {
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['txt', 'md', 'text', 'story', 'chapter'].includes(ext)) {
    showToast('Only .txt and .md files are supported.');
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    inputText.value = e.target.result;
    updateStats();
    showToast(`Loaded: ${file.name}`);
  };
  reader.onerror = () => showToast('Failed to read file.');
  reader.readAsText(file);
}

dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', e => {
  if (e.target.files.length) loadFile(e.target.files[0]);
  e.target.value = '';
});

dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', e => {
  if (!dropZone.contains(e.relatedTarget)) {
    dropZone.classList.remove('drag-over');
  }
});
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) loadFile(file);
});

/* ═══════════════════════════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════════════════════════ */

updateStats();

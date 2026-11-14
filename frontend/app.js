/* StoryMind frontend. The backend (backend/app.py) serves this page and does the analysis. */

/* ── DOM refs ── */
const inputText         = document.getElementById('inputText');
const processBtn        = document.getElementById('processBtn');
const clearBtn          = document.getElementById('clearBtn');
const exportBtn         = document.getElementById('exportBtn');
const wordCount         = document.getElementById('wordCount');
const charCount         = document.getElementById('charCount');
const shortWarning      = document.getElementById('shortWarning');
const placeholder       = document.getElementById('placeholderState');
const placeholderText   = placeholder.querySelector('p');
const outputContent     = document.getElementById('outputContent');
const processingOverlay = document.getElementById('processingOverlay');
const processingStage   = document.getElementById('processingStage');
const progressBar       = document.getElementById('progressBar');
const toast             = document.getElementById('toast');
const toastMsg          = document.getElementById('toastMsg');
const outputLanguage    = document.getElementById('outputLanguage');
const continueStory     = document.getElementById('continueStory');

const STORY_KEY = 'storymind_story_state';
const PLACEHOLDER_TEXT = placeholderText.textContent;
let lastPackage = null;

/* Story so far, kept between chapters. Storage can be blocked (private mode): then it is just off. */
function loadStory() { try { return localStorage.getItem(STORY_KEY) || ''; } catch { return ''; } }
function saveStory(state) { try { localStorage.setItem(STORY_KEY, state); } catch {} }
function updateContinueToggle() {
  continueStory.disabled = !loadStory();
  if (continueStory.disabled) continueStory.checked = false;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   API
═══════════════════════════════════════════════════════════════════════════════ */

async function analyze(text) {
  let res;
  try {
    res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        output_language: outputLanguage.value,
        story_so_far: continueStory.checked ? loadStory() : '',
      }),
    });
  } catch {
    throw new Error('Cannot reach the backend. Start it with: python backend/app.py');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Server error (HTTP ${res.status})`);
  return body;
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
   RENDER
═══════════════════════════════════════════════════════════════════════════════ */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const lines = (items, toHtml) => items.map((item, i) =>
  `<div class="line-animated" style="animation-delay:${i*50}ms">${toHtml(item)}</div>`).join('');
const paragraphs = text => text.split(/\n+/).filter(p => p.trim()).map(p => `<p>${escapeHtml(p)}</p>`).join('');
const accent = text => `<span class="accent">${escapeHtml(text)}</span>`;

function folder(name, file, body, delay) {
  return `
    <div class="vfolder open" data-delay="${delay}">
      <div class="vfolder-header">
        <svg class="folder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <span class="folder-name">${name}</span>
        <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
      <div class="vfolder-body">
        <div class="vfolder-content">
          <div class="file-line">
            <svg class="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            <span class="file-label">${file}</span>
          </div>
          <div class="content-text">${body}</div>
        </div>
      </div>
    </div>`;
}

function renderOutput(data) {
  const s = data.overall_summary;

  const summary =
    `<div class="logline">${escapeHtml(s.logline)}</div>` +
    `<div class="narrative">${paragraphs(s.narrative)}</div>` +
    lines(s.bullets, b => `• ${escapeHtml(b)}`) +
    `<div>${accent('Setting:')} ${escapeHtml(s.setting)}</div>`;

  const timeline = lines(data.timeline.plot_beats, b =>
    `${accent(`${b.beat_number}. [${b.type}]`)} ` +
    (b.characters.length ? `<span class="beat-chars">${escapeHtml(b.characters.join(' + '))} —</span> ` : '') +
    escapeHtml(b.text) +
    (b.evidence ? `<div class="evidence">“${escapeHtml(b.evidence)}”</div>` : ''));

  const characters = data.characters.cards.length ? lines(data.characters.cards, c =>
    `<strong>${escapeHtml(c.name)}</strong> — ${escapeHtml(c.role)}` +
    `<div>${accent('Feels:')} ${escapeHtml(c.emotional_state)}</div>` +
    `<div>${accent('Does:')} ${escapeHtml(c.key_actions.join('; '))}</div>` +
    c.relationships.map(r => `<div>${accent(`→ ${r.to}:`)} ${escapeHtml(r.nature)}</div>`).join('') +
    `<div>${accent('Change:')} ${escapeHtml(c.change_in_chapter)}</div>`)
    : '<div>No characters found.</div>';

  const lore = data.lore.items.length
    ? lines(data.lore.items, l => `${accent(`[${l.category}]`)} ${escapeHtml(l.detail)}`)
    : '<div>No world-building details in this chapter.</div>';

  const threads =
    (data.open_threads.length ? lines(data.open_threads, t => `? ${escapeHtml(t)}`) : '<div>Nothing left open.</div>') +
    `<div class="narrative">${accent('Story so far:')}${paragraphs(data.story_state)}</div>`;

  outputContent.innerHTML = `
    <div class="meta-strip">
      <span>${accent(data.meta.word_count)} words</span>
      <span>analyzed by ${accent(data.meta.analyzer)}</span>
    </div>
    <div class="meta-strip">
      <span class="meta-tag">${escapeHtml(s.tone)}</span>
      <span class="meta-tag">${escapeHtml(s.conflict)}</span>
      <span class="meta-tag">${escapeHtml(s.ending_type)}</span>
    </div>` +
    folder('01_COMPREHENSIVE_SUMMARY', 'overall_plot.txt', summary, 0) +
    folder('02_TIMELINE_and_PLOT_BEATS', 'chronological_flow.log', timeline, 120) +
    folder('03_CHARACTER_DATABASE_UPDATES', 'entities_status.txt', characters, 240) +
    folder('04_LORE_and_WORLD_BUILDING', 'world_context.db', lore, 360) +
    folder('05_OPEN_THREADS', 'story_so_far.txt', threads, 480);

  placeholder.style.display = 'none';
  outputContent.style.display = 'flex';
  exportBtn.disabled = false;

  /* Stagger folder entrance */
  setTimeout(() => {
    document.querySelectorAll('.vfolder').forEach(f => {
      setTimeout(() => f.classList.add('visible'), parseInt(f.dataset.delay || 0));
    });
  }, 30);
}

/* Folder toggle: registered once, not per render, or each click would toggle twice */
outputContent.addEventListener('click', e => {
  const header = e.target.closest('.vfolder-header');
  if (header) header.parentElement.classList.toggle('open');
});

/* ═══════════════════════════════════════════════════════════════════════════════
   EXPORT
═══════════════════════════════════════════════════════════════════════════════ */

function doExport() {
  if (!lastPackage) return;
  const d = lastPackage, s = d.overall_summary;

  const text = [
    '# Knowledge Package — StoryMind',
    `Generated ${new Date().toLocaleString()} by ${d.meta.analyzer}`,
    '',
    '## 01 Summary',
    `**${s.logline}**`, '',
    s.narrative, '',
    ...s.bullets.map(b => `- ${b}`), '',
    `Setting: ${s.setting}`, `Tone: ${s.tone}`, `Conflict: ${s.conflict}`, `Ending: ${s.ending_type}`,
    '',
    '## 02 Timeline',
    ...d.timeline.plot_beats.map(b =>
      `${b.beat_number}. [${b.type}] ${b.characters.length ? `(${b.characters.join(', ')}) ` : ''}${b.text}` +
      (b.evidence ? `\n   > ${b.evidence}` : '')),
    '',
    '## 03 Characters',
    ...d.characters.cards.flatMap(c => [
      `### ${c.name} — ${c.role}`,
      `- Feels: ${c.emotional_state}`,
      `- Does: ${c.key_actions.join('; ')}`,
      ...c.relationships.map(r => `- → ${r.to}: ${r.nature}`),
      `- Change: ${c.change_in_chapter}`, '',
    ]),
    '## 04 Lore',
    ...d.lore.items.map(l => `- [${l.category}] ${l.detail}`),
    '',
    '## 05 Open threads',
    ...d.open_threads.map(t => `- ${t}`),
    '',
    '## Story so far',
    d.story_state,
    '',
  ].join('\n');

  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }));
  const a = document.createElement('a');
  a.href = url; a.download = 'knowledge_package_' + Date.now() + '.md';
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
   PROCESSING
═══════════════════════════════════════════════════════════════════════════════ */

async function runProcessing() {
  const text = inputText.value.trim();
  if (!text || processingOverlay.classList.contains('active')) return;

  processingOverlay.classList.add('active');
  processBtn.disabled = true;
  typewriter(processingStage, 'Reading the chapter… this can take a minute', 28);
  /* Real duration is unknown, so the bar creeps toward 90% and jumps to the end when done */
  progressBar.style.transition = 'width 60s cubic-bezier(0.1, 0.7, 0.3, 1)';
  progressBar.style.width = '90%';

  let data = null, failure = null;
  try { data = await analyze(text); } catch (err) { failure = err.message; }

  progressBar.style.transition = 'width 300ms ease';
  progressBar.style.width = '100%';
  await new Promise(r => setTimeout(r, 300));
  progressBar.style.transition = 'none';
  progressBar.style.width = '0%';
  processingOverlay.classList.remove('active');
  updateStats();

  if (failure) {
    /* Keep the previous package on screen if there is one; otherwise explain in the empty panel */
    placeholderText.textContent = failure;
    showToast(failure);
    return;
  }
  lastPackage = data;
  saveStory(data.story_state);
  updateContinueToggle();
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
  placeholderText.textContent = PLACEHOLDER_TEXT;
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
updateContinueToggle();

# StoryMind — Knowledge Package Generator

Paste a novel chapter, get a real summary: what happens and why, a timeline with
quotes from the text, per-character notes, lore, open threads, and a running
"story so far" that carries over to the next chapter. Works for Vietnamese,
English and other languages.

The analysis is done by Claude through the Anthropic API, so you need an API key
(https://console.anthropic.com). Each chapter costs a few cents.

## Run

```bash
pip install -r requirements.txt
```

```bash
export ANTHROPIC_API_KEY=sk-ant-...      # Windows PowerShell: $env:ANTHROPIC_API_KEY="sk-ant-..."
```

```bash
python backend/app.py
```

Open http://localhost:5000. The backend serves the page itself; do not open
`index.html` directly.

Optional: `STORYMIND_MODEL` picks the model (default `claude-opus-5-5`;
`claude-sonnet-5-5` and `claude-haiku-5-5` are cheaper).

## Use

- Paste text or drop a `.txt` / `.md` file, then **Process** (`Ctrl + Enter`).
- **Write the summary in**: the chapter's language, Tiếng Việt, or English.
- **Continue from the previous chapter**: sends the "story so far" from the last
  chapter you processed in this browser, so the summary knows the plot up to
  here. Untick it when you start a different novel.
- **Export** saves the package as a Markdown file.

## API

`POST /api/analyze`

```json
{ "text": "chapter...", "output_language": "auto | vi | en", "story_so_far": "optional" }
```

Returns:

```json
{
  "meta": { "word_count", "char_count", "analyzer" },
  "overall_summary": { "logline", "narrative", "bullets", "tone", "conflict", "ending_type", "setting" },
  "timeline": { "plot_beats": [{ "beat_number", "type", "characters", "text", "evidence" }] },
  "characters": { "cards": [{ "name", "role", "emotional_state", "key_actions", "relationships": [{ "to", "nature" }], "change_in_chapter" }] },
  "lore": { "items": [{ "category", "detail" }] },
  "open_threads": ["..."],
  "story_state": "running summary of the novel so far"
}
```

Errors come back as `{ "error": "message" }` with a 4xx/5xx status.
`GET /health` returns `{ "status": "ok", "model": "..." }`.

## Tests

```bash
pip install pytest && python -m pytest tests
```

The tests run the real Anthropic SDK against a fake HTTP transport: no key, no cost.

## Layout

```
backend/app.py     Flask server: prompt, schema, one Claude call
frontend/          index.html, app.js, style.css
tests/test_app.py
SPEC.md            original design spec (visual design still applies)
UPGRADE_PLAN.md    why the keyword engine was replaced
```

# Story Summary App — SPEC.md

## 1. Concept & Vision

A literary-grade web tool that transforms raw story chapters into a dense, AI-readable **Knowledge Package** — the same virtual directory structure from your earlier prompt. It feels like a scholar's desk: warm, focused, and purposeful. The user pastes narrative text, clicks a single button, and watches as the "AI" processes and produces a beautifully structured output. The experience should feel like magic — processing a messy story into clean, organized intelligence.

## 2. Design Language

**Aesthetic:** Warm literary manuscript — like a modernized rare books room. Parchment tones, deep ink accents, elegant serif headings, with sharp functional contrast.

**Color Palette:**
- Background: `#F5F0E8` (warm parchment)
- Surface: `#FDFAF5` (cream white)
- Primary: `#2C1810` (deep espresso — ink)
- Accent: `#8B3A2A` (burnt sienna — wax seal)
- Secondary: `#5C4A3A` (warm umber)
- Muted: `#9E8E7E` (faded ink)
- Border: `#E0D5C5` (aged paper)
- Success: `#3A6B4A` (forest green)

**Typography:**
- Headings: `Playfair Display` (serif, literary authority)
- Body/UI: `Crimson Pro` (readable serif, scholarly)
- Code/Folder labels: `JetBrains Mono` (structural contrast)
- Scale: 48px hero, 24px section, 18px body, 14px labels

**Spatial System:**
- Generous whitespace; sections breathe
- 8px base unit; multiples of 8 for spacing
- Soft box shadows to lift cards from parchment background

**Motion:**
- Folder expand/collapse: height + opacity, 300ms ease-out
- "Processing" stages: sequential typewriter pulse, 600ms stagger
- Output reveal: fade-in from top, staggered per folder, 200ms delays
- Input focus: border glow transition 200ms

**Visual Assets:**
- Lucide icons for folder/file glyphs (consistent 20px stroke)
- Decorative SVG dividers between sections (flourish motifs)
- Subtle paper texture via CSS noise gradient

## 3. Layout & Structure

```
┌──────────────────────────────────────────────────────┐
│  [Logo + Title]           [Process] [Clear] [Export] │
├──────────────────────────────────────────────────────┤
│                                                      │
│  [INPUT PANEL]          │  [OUTPUT PANEL]            │
│  "Paste your chapter"   │  Knowledge Package         │
│                         │                            │
│  [textarea]             │  📁 01_COMPREHENSIVE_SUMMARY │
│                         │    📄 overall_plot.txt     │
│  [word count / chars]   │                            │
│                         │  📁 02_TIMELINE            │
│                         │    📄 chronological_flow  │
│                         │                            │
│                         │  📁 03_CHARACTERS          │
│                         │    📄 entities_status.json │
│                         │                            │
│                         │  📁 04_LORE                │
│                         │    📄 world_context.db     │
│                         │                            │
└──────────────────────────────────────────────────────┘
```

- Single page, two-column split (40% / 60%)
- Left: input panel with textarea + stats
- Right: scrollable output panel with virtual folders
- Responsive: stacks vertically on mobile
- Sticky header with action buttons

## 4. Features & Interactions

### Core Features

**Text Input**
- Auto-expanding textarea (min 300px, grows with content)
- Live word count + character count in footer
- Paste detection: auto-focus and subtle highlight pulse
- Placeholder: rich example story snippet

**Process Button**
- Primary CTA, prominent burnt sienna
- Disabled state when input is empty or too short (<50 words)
- On click: shows processing animation → generates Knowledge Package

**Processing Animation**
- 3 sequential stages displayed as animated text:
  1. "Parsing narrative structure..."
  2. "Extracting character entities..."
  3. "Synthesizing knowledge package..."
- Stage text types in with a typewriter cursor effect
- Each stage takes ~800ms
- Total processing: ~2.5 seconds minimum (for perceived reliability)

**Knowledge Package Output**
- Four virtual folders, each expandable/collapsible
- Click folder header → toggle content visibility
- All open by default after generation
- Smooth accordion animation

**Folder Contents:**
1. `overall_plot.txt` — Multi-bullet dense summary
2. `chronological_flow.log` — Beat-by-beat timeline
3. `entities_status.json` — Character cards in JSON format
4. `world_context.db` — Lore and world-building notes

**Smart Content Generation**
- Analyzes input text structure to extract:
  - Setting (time period, location)
  - Main characters and their roles
  - Central conflict
  - Key plot events (detects verbs, turning points)
  - Mood/tone indicators
- Generates plausible, contextually-aware output even from short inputs
- Falls back gracefully for minimal input

**Export Button**
- Exports the full Knowledge Package as a formatted .txt file
- Filename: `knowledge_package_[timestamp].txt`

**Clear Button**
- Resets input textarea and output panel
- Confirmation not needed (instant)

### Edge Cases
- Empty input: Process button disabled, tooltip explains
- Very short input (<50 words): Warning message, still processes
- Very long input: Truncates at 10,000 words with notice
- Re-process: Clears previous output before new generation
- No characters detected: Folder shows "No characters found"

## 5. Component Inventory

**Header**
- Logo: SVG open book icon + "StoryMind" text
- Buttons: Process (primary), Clear (ghost), Export (outline)
- States: Process disabled when empty; Export disabled when no output

**InputPanel**
- Label: "Your Story Chapter"
- Textarea: warm cream bg, espresso border on focus, min 300px
- Footer bar: word count (left), char count (right), muted style

**ProcessingOverlay**
- Semi-transparent overlay on output panel
- Centered stage text with typewriter animation
- Pulsing cursor after text

**VirtualFolder**
- Header: folder icon (Lucide) + folder name in mono font
- Chevron indicator (rotates on expand/collapse)
- Collapsed: just header visible
- Expanded: content card slides in below
- States: open, closed, hover (subtle bg lift)

**FolderContentCard**
- Light cream card within folder
- File labels in mono font
- Content in readable serif
- JSON blocks in mono with syntax-like coloring

**Toast Notification**
- Bottom-right, slides in
- Success: forest green accent
- Auto-dismisses after 3s

## 6. Technical Approach

- **Single HTML file** with embedded CSS and JavaScript
- **Vanilla JS** — no framework needed for this scope
- **Google Fonts** loaded via `<link>` (Playfair Display, Crimson Pro, JetBrains Mono)
- **Lucide Icons** via CDN for SVG icons
- **LocalStorage** — optional: save last input for recovery
- **No backend** — all "AI processing" is smart client-side text analysis
- **Responsive** — CSS Grid with media query at 768px breakpoint

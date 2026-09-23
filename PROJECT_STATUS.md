# langLSRW Project Status

Last updated: 2026-09-23

## Current Stage

langLSRW is currently a personal, local-first language-learning prototype. The listening and speaking workflow is usable for daily local testing. Reading, writing, review pools, article generation, and cloud data are still future work.

Local testing is the default workflow. Run `tools/start-langlsrw-server.bat` on Windows or `tools/start-langlsrw-server.sh` on Linux/Ubuntu, then open `http://localhost:8848/`. A Sites hosting configuration exists, but deployment must only happen after the owner explicitly requests it. `deploy/README.md` documents a separate, owner-requested deployment target: the `vpsde` VPS, served at `lang.mltz.tech`.

## Implemented

### Shared application

- Four-part navigation: `听说 -> 读 -> 写`; reading and writing currently remain placeholders.
- Local users, browser storage, user switching, JSON import/export, and settings reset.
- Google sign-in (Google Identity Services token model, no backend). A Google user's sentence libraries, practice history, training progress, settings and AI grammar cache live in a visible `langLSRW/` folder in their own Drive (`drive.file` scope); merge rules live in `src/cloud-sync.js` (tested in `tests/cloud-sync.test.js`). Local users remain as guest mode, and a guest's libraries, progress and history can be moved into a Google account on first sign-in. Needs an OAuth client ID in `index.html` (setup in `deploy/README.md`).
- Visual style mirrors nav.mltz.tech: same design tokens, light/dark mode that follows the OS until toggled, and the same four palettes (default green, GitHub, Reddit, Twitter), plus an extra Anki palette modeled on apps.ankiweb.net (blue accent, pill controls, borderless shadowed cards, Hanken Grotesk).
- Separate English-content and Chinese UI/translation font settings.
- Configurable colors for all grammar roles, with a color picker, editable HEX value, common color palette, local persistence, and reset defaults.
- Top popovers for shortcuts, source files, settings, and users. Learning shortcuts are suspended while any of these popovers is open.
- Sentence-library dialog listing the user's own libraries, with import, rename, delete, search, paginated preview and a direct practice action.
- Local static server launcher that resolves the project directory from the BAT file location and only stops a Python `http.server` occupying port 8848.

### Sentence libraries

- The server hosts code only. Every library is imported by the user (.txt / .lrc / .tsv, or pasted text) and belongs to that user.
- Libraries are stored per user in IndexedDB (`src/library-store.js`), so they survive reloads; the position in each library and the practice mode are remembered too.
- For a Google user each library is also a TSV file in `langLSRW/libraries/` in their Drive. Renaming or deleting the file in Drive is picked up on the next sync; deleting in the app moves the Drive file to the trash.
- The former built-in `常用英语句库` (30,150 English-Chinese pairs) is kept in the repo at `data/libraries/common-english-30150/sentences.tsv` and can be imported like any other TSV; it is no longer deployed.
- Search (English, Chinese, ID) and 50-row paginated preview run locally.

### Listening and dictation

- Import `.txt` and `.lrc`, paste sentence lists, and load the bundled bilingual material.
- English source above Chinese translation, with independent source and translation visibility.
- Ordered, random, and mistake practice modes.
- Previous/next sentence navigation, British English as the default accent, voice selection, normal and slower replay, word replay, and automatic reading.
- Dictation input with accuracy, speed, pause, fluency, and error statistics plus recent records.
- Configurable keyboard shortcuts.

### Speaking

- Hold-to-speak workflow with speech recognition and recording.
- Live bar-style volume indication and active-listening border feedback.
- Similarity, omitted-word, wrong-word, extra-word, and volume feedback.
- Recording playback and model-sentence comparison controls.

### AI grammar analysis

- Manual AI trigger; sentence switching and ordinary practice never trigger paid requests.
- Personal local API settings stored in browser storage for the current private-use stage.
- Traditional English teaching grammar is the only enabled runtime framework.
- Hierarchical grammar JSON rendering with main, first-level, and all-node views.
- Role-specific colors, expandable nodes, notes, child indicators, and explanations.
- Cached analysis reuse for the same sentence; reanalysis is an explicit context-menu action.
- View and copy the exact AI prompt and raw/formatted AI response.
- Prompt source is maintained in the traditional grammar Skill and generated into `src/generated/grammar-prompt.js`.
- SIEG2 remains a separate Skill and appears disabled in the UI; it is not included in the active runtime prompt.

## Current Architecture

```text
langLSRW/
  index.html
  src/
    app.js
    library-store.js
    google-drive.js
    cloud-sync.js
    styles.css
    generated/grammar-prompt.js
  tests/cloud-sync.test.js
  data/                      (not deployed)
    libraries/common-english-30150/sentences.tsv
    materials/
  tools/start-langlsrw-server.bat
  tools/start-langlsrw-server.sh
  .agents/skills/
    langlsrw-traditional-grammar-analysis/
    langlsrw-sieg2-grammar-analysis/
  .openai/hosting.json
```

The HTML, CSS, bundled material, generated prompt, and launcher are separated. Most application behavior is still concentrated in `src/app.js`; splitting listening, speaking, storage, settings, and grammar rendering into modules remains architectural work, not a completed migration.

## Known Boundaries

- Reading and writing pages are not implemented yet.
- AI article generation, writing review, and review-material generation are not implemented yet.
- There are no shared or curated libraries; every user starts empty and imports their own material.
- There is no backend or database. Cloud sync exists only for Google users, via their own Drive; the API key and light/dark/palette choice stay per-device.
- The API key is stored in browser local storage and is acceptable only for private local use.
- Before public AI access, requests must move behind a backend proxy with quotas and cost controls.
- Speech recognition and recording depend on browser support and microphone permission.
- The native system color-picker dialog cannot be customized by the webpage; HEX editing is provided in the settings panel.

## Verification

Verified on 2026-09-23:

- `node --check src/app.js` passes.
- Traditional grammar Skill/runtime prompt synchronization test passes: 1/1.
- SIEG2 Skill validation and cache behavior tests pass: 13/13.
- Light/dark mode and palette switching verified in the browser; no horizontal overflow at desktop or 375px widths.
- HEX input and common-palette selection update only the selected grammar role.
- Opening a top popover disables learning shortcuts; closing it restores them.
- The common library manifest count matches the 30,150 valid TSV records.
- Library search, 50-row pagination, practice selection, and shortcut suspension were verified in the browser.

## Next Priorities

1. Continue local daily-use testing and fix listening, speaking, and grammar-analysis defects.
2. Continue moving feature boundaries out of the large `src/app.js`; library storage, Drive access and sync rules already live in `src/library-store.js`, `src/google-drive.js` and `src/cloud-sync.js`.
3. Build the reading page around full articles, sentence understanding, vocabulary, phrases, and notes.
4. Build the writing page around rewriting, summaries, retelling, and AI-assisted review.
5. Add review pools that connect listening mistakes, speaking problems, reading notes, and writing corrections.
6. Add AI-generated learning materials based on level and interests, using manual triggers, caching, and result reuse.
7. Add a backend proxy, authentication, quotas, and cloud storage only before broader public use.

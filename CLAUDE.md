## Agent skills

### Issue tracker

Issues and specs are local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Project conventions

Electron + TypeScript (ADR 0001), Node 24, npm, Vitest, esbuild.

- `npm install`, then `node node_modules/electron/install.js` if the Electron binary is missing (npm may skip install scripts).
- `npm test`: run all tests (`src/**/*.test.ts`, colocated with the code). `npm run typecheck`: `tsc --noEmit`.
- `npm run build`: bundle to `dist/` via `scripts/build.mjs`. `npm start`: build and launch the app.

Layout (renderers and main depend on `core`, never the reverse):

- `src/core/`: headless core. No Electron/DOM imports. `createCore({ clock })` gives `dispatch(command)`, `getState()`, `subscribe()`. Add commands to `Command` in `types.ts` and handle them in `core.ts`. Test through this seam with `createFakeClock()`.
- `src/main/`: Electron main process and preload; owns the core instance and bridges IPC (`src/shared/ipc.ts`). Renderers use `window.neoprompter` (`getState`, `dispatch`, `onState`).
- `src/operator/`, `src/output/`: thin renderers of core state (`index.html` + `<name>.ts`, bundled to `dist/<name>/<name>.js`). A new renderer page must be added to the page list in `scripts/build.mjs`.
- New headless modules (import, API server, shuttle adapter) get their own `src/<module>/` folder with an `index.ts` and colocated tests.

- `src/output-window/`: headless Output placement (chosen monitor per display setup, Windowed Output). Display list, settings store and window host are injected; main wires them to Electron.

Script model (`src/core/types.ts`): `Script { name, lines: ScriptLine[] }`. A `ScriptLine` is a plain `string` (one unstyled run) or a `RichLine { heading?: 1-6, runs: Run[] }`; a `Run` is `{ text, bold?, italic?, color? }`. Color is the source color as `#rrggbb`, stored as-is (the readable-color rule is applied at render time, never on the Script). Fonts, sizes and spacing are never stored. Use `lineRuns`/`lineText`/`lineHeading` to read a line. The library stores `StoredScript { text, lines? }`: `text` is the plain form, `lines` the optional styled form; old text-only entries still load. `saveScript` takes optional `lines`. The Output renders runs as spans, headings bold at the Preset's size.

Import (`src/import/`): `importDocx(bytes, fileName): { ok: true, script } | { ok: false, message }` is a pure function (the second test seam). Tests build `.docx` fixtures in code with `src/import/fixtures.ts`. `importDocx` resolves bold, italic and color through character styles, paragraph styles, `basedOn` chains and document defaults, with direct run formatting winning. Legacy `.doc` (Word 97-2003) goes through `importDoc` in `src/import/doc.ts`: a minimal pure-JS reader (the `cfb` package for the container; piece table, character/paragraph formatting and style sheet parsed in-house), same result shape; `.doc` fixtures are built in code by `src/import/docFixtures.ts`. `importDocument(bytes, fileName)` dispatches by extension and is what main calls. `.doc` limits: Word 6/95 files and password-protected files are refused with a message; headings come from style names ("heading N", "Title") only, so text that is merely bold and large is not a heading; colors are the 16-color palette or 24-bit values (theme-based colors are lost); no list numbers, no text boxes, headers, footnotes or fields' results beyond their displayed text. Main wires the Operator view's "Import…" button (file picker for `.docx` and `.doc`, then `saveScript` with `lines`).

## Installers

- `npm run dist:mac` builds `release/Neoprompter-<ver>.dmg`; `npm run dist:win` builds `release/Neoprompter Setup <ver>.exe` (NSIS; cross-builds from macOS without wine). `npm run dist:check` verifies the artifacts exist. Config: `electron-builder.yml`. `release/` is git-ignored.
- Unsigned, no auto-update: updates are done by hand. macOS: right-click > Open on first launch. Windows: SmartScreen "More info > Run anyway".
- The app makes no network calls (`src/packaging/offline.test.ts` guards against remote resources). The Windows `.exe` is built but not run-tested here (no Windows machine).

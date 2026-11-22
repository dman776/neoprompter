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
- `npm run check` is what the pre-commit hook runs. Renderer change? Run the app and look at it: `docs/run-and-test.md`.

Layout (renderers and main depend on `core`, never the reverse):

- `src/core/`: headless core. No Electron/DOM imports. `createCore({ clock })` gives `dispatch(command)`, `getState()`, `subscribe()`. Add commands to `Command` in `types.ts` and handle them in `core.ts`. Test through this seam with `createFakeClock()`.
- `src/main/`: Electron main process and preload; owns the core instance and bridges IPC (`src/shared/ipc.ts`). Renderers use `window.neoprompter` (`getState`, `dispatch`, `onState`).
- `src/operator/`, `src/output/`: thin renderers of core state (`index.html` + `<name>.ts`, bundled to `dist/<name>/<name>.js`). A new renderer page must be added to the page list in `scripts/build.mjs`.
- New headless modules (import, API server, shuttle adapter) get their own `src/<module>/` folder with an `index.ts` and colocated tests.

- `src/output-window/`: headless Output placement (chosen monitor per display setup, Windowed Output). Display list, settings store and window host are injected; main wires them to Electron.

Scroll model: a Script line is a paragraph and the Output wraps it, so position, speed (lines per second), the viewport, Screen jumps, the end-of-Script stop and Progress are all in visual lines. The Output measures each Script line's height in visual lines after every layout-affecting change and dispatches `setLineExtents { extents, revision }` (like `setViewport`); the core keeps `extents` (1 per line until measured), clamps to `sum(extents) - viewportLines`, and converts the reading position through (Script line + fraction) on edits and re-measures so it stays on the same text. A measurement for an old `scriptRevision` is ignored. `scriptRevision` bumps on any Script content change (edit, cut, color, load); the Output re-renders its text DOM on it, not on the Script name.

Script model (`src/core/types.ts`): `Script { name, lines: ScriptLine[] }`. A `ScriptLine` is a plain `string` (one unstyled run) or a `RichLine { heading?: 1-6, runs: Run[] }`; a `Run` is `{ text, bold?, italic?, color? }`. Color is the source color as `#rrggbb`, stored as-is (the readable-color rule is applied at render time, never on the Script). Fonts, sizes and spacing are never stored. Use `lineRuns`/`lineText`/`lineHeading` to read a line. The library stores `StoredScript { text, lines? }`: `text` is the plain form, `lines` the optional styled form; old text-only entries still load. `saveScript` takes optional `lines`. The Output renders runs as spans, headings bold at the Preset's size.

Import (`src/import/`): `importDocx(bytes, fileName): { ok: true, script } | { ok: false, message }` is a pure function (the second test seam). Tests build `.docx` fixtures in code with `src/import/fixtures.ts`. `importDocx` resolves bold, italic and color through character styles, paragraph styles, `basedOn` chains and document defaults, with direct run formatting winning. Legacy `.doc` (Word 97-2003) goes through `importDoc` in `src/import/doc.ts`: a minimal pure-JS reader (the `cfb` package for the container; piece table, character/paragraph formatting and style sheet parsed in-house), same result shape; `.doc` fixtures are built in code by `src/import/docFixtures.ts`. `importDocument(bytes, fileName)` dispatches by extension and is what main calls. `.doc` limits: Word 6/95 files and password-protected files are refused with a message; headings come from style names ("heading N", "Title") only, so text that is merely bold and large is not a heading; colors are the 16-color palette or 24-bit values (theme-based colors are lost); no list numbers, no text boxes, headers, footnotes or fields' results beyond their displayed text. Main wires the Operator view's "Import…" button (file picker for `.docx` and `.doc`, then `saveScript` with `lines`).

Readable-color guard (`src/core/readableColor.ts`): `displayColor(source, background, themeColor)` is a pure function the Output calls on every render for each colored run, so a background change re-evaluates every color. It keeps the source color if its WCAG contrast ratio against the Output background is at least `MIN_CONTRAST` = 3 (the WCAG large-text bar; prompter text is far larger, and 3:1 rejects Word's stray black, near-black and dark blue/red on black while keeping red and green), else returns the theme text color. Missing or invalid colors (anything but `#rgb`/`#rrggbb`) also use the theme color. The Operator view does not show Script text in color, so only the Output uses it.

## Installers

- `npm run dist:mac` builds `release/Neoprompter-<ver>.dmg`; `npm run dist:win` builds `release/Neoprompter Setup <ver>.exe` (NSIS; cross-builds from macOS without wine). `npm run dist:check` verifies the artifacts exist. Config: `electron-builder.yml`. `release/` is git-ignored.
- Unsigned, no auto-update: updates are done by hand. macOS: right-click > Open on first launch. Windows: SmartScreen "More info > Run anyway".
- The app makes no network calls (`src/packaging/offline.test.ts` guards against remote resources). The Windows `.exe` is built but not run-tested here (no Windows machine).

## Companion API

`src/api/` is the local HTTP service (Node `http`, no framework). `createApiServer({ core, port, token?, extraRoutes? })` has `start()` (rejects with a readable message when the port is taken), `stop()`, `setToken()`. Request flow lives in one place: (1) remote-address gate, 403; (2) token, 401 (applies to unknown routes too; only `Authorization: Bearer` or `X-Neoprompter-Token` headers count, never a `?token=` query string); (3) route lookup, 404/405; (4) body cap (4 KB, 413). Built-in routes are only `POST /api/notify {text, durationMs?}` and `GET /api/status`, listed in `ROUTES`; there is deliberately no transport or Script endpoint, and `api.test.ts` asserts the table and probes transport-like paths. The Producer page (`src/api/producer.ts`, `producerPage.ts`) is added via `extraRoutes`: `GET /` (static inline HTML, the only `public: true` route, served without a token so it can prompt for one; the token is never embedded, the browser keeps it in localStorage and sends `X-Neoprompter-Token`), plus `GET`/`POST /api/quick-messages` for the shared quick-message list (persisted in `quick-messages.json` by `src/main/fileQuickMessageStore.ts`). `producer.test.ts` asserts that route table; `api.test.ts` asserts the built-ins.

"Local network only" as built: the server binds `0.0.0.0` (so LAN devices can reach it) and every request is checked against the socket peer address with `isPrivateAddress`: loopback, RFC 1918 (10/8, 172.16/12, 192.168/16), IPv4 link-local, IPv6 loopback/unique-local/link-local, and IPv4-mapped forms. Anything else gets 403. It does not stop a public-routable address on this machine from being bound; it relies on the check, and on the router not forwarding the port. Port (default 4780, 1024-65535) and optional token persist in `api-settings.json` in userData (`src/main/fileApiSettingsStore.ts`), edited in the Operator view (`src/operator/apiPanel.ts`); `src/main/apiController.ts` restarts the server on port change. Companion setup examples: `docs/companion.md`.

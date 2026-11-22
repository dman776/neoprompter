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

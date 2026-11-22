## Agent skills

### Issue tracker

Issues and specs are local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Project conventions

Electron + TypeScript (ADR 0001), Node 24, npm, Vitest, esbuild. Scripts are in `package.json`; `npm run check` must pass, and the pre-commit hook runs it. After a renderer change, run the app and look at it: `docs/run-and-test.md`.

Layout:

- `src/core/`: headless. Renderers and `src/main/` import it; it imports neither (`npm run check` enforces no Electron, DOM, or upward imports). `createCore({ clock })` gives `dispatch(command)`, `getState()`, `subscribe()`. Add commands to `Command` in `types.ts`, handle them in `core.ts`, and test through this seam with `createFakeClock()`.
- `src/main/`: Electron main process and preload. Owns the core and bridges IPC (`src/shared/ipc.ts`); renderers use `window.neoprompter`.
- `src/operator/`, `src/output/`: thin renderers of core state (`index.html` + `<name>.ts`). `scripts/build.mjs` bundles every `src/*/index.html` page.
- `src/import/`, `api/`, `input/`, `library/`, `output-window/`: headless modules with an `index.ts` and colocated tests; collaborators (stores, display lists, window hosts) are injected. New modules follow suit.

Read the matching doc before touching:

- Scrolling, position, Screen jumps, Progress bar: `docs/scroll-model.md`
- Script storage, Import, colors (source colors are stored as-is; the readable-color rule applies at render time): `docs/script-model-and-import.md`
- `src/api/`, the Producer page, quick messages (the API exposes Notifications and status only): `docs/api-design.md`. Companion button setup: `docs/companion.md`
- Installers: `docs/installers.md`

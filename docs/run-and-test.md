# Run and test

Three seams, from cheapest to most real. Use the cheapest one that can show the behavior.

| Seam                   | Command                                | Sees                                                                                                                    | Cannot see                                                              |
| ---------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Core                   | `npm test` (`src/core/*.test.ts`)      | commands in, state out, fake clock                                                                                      | any rendering                                                           |
| Renderer (jsdom)       | `npm test` (`src/**/*.dom.test.ts(x)`) | the real renderer code reacting to real core state: which DOM it builds, colors, transforms, the commands it dispatches | real layout: jsdom has no text wrapping, so `offsetHeight` is simulated |
| Running app (Electron) | `npm run test:e2e`                     | the built app: both windows, real wrapping and scrolling, screenshots                                                   | anything needing hardware (ShuttleXPress, a second monitor)             |

`npm run check` (typecheck + `npm test`) is what the pre-commit hook runs. The Electron test is not in it: it opens windows and takes seconds.

## When you change a renderer

Renderers are `src/operator/` (the Operator view, Edit mode and Run mode), `src/preferences/` (Preferences), `src/shuttle/` (Virtual shuttle), all React (a page with a `<name>.tsx` entry is built as React; shared design-system pieces are in `src/operator/ui/`), and `src/output/` (plain TypeScript). If the change affects what the Operator or Talent sees (layout, scrolling, colors, wrapping, text rendering), run `npm run test:e2e`, then open the screenshots it writes to `e2e/artifacts/` and look at them: `operator-edit-dark.png`, `operator-edit-light.png`, `operator-run-dark.png`, `operator-run-light.png`, `operator-run-locked.png`, `operator-notification-*.png`, `preferences-*.png` (`preferences-fit-*` is every Preferences tab at 900x640), `virtual-shuttle.png`, `output-loaded.png` and `output-end.png`. Preferences never scrolls: a category with many settings is split into tabs (`tabs` on its `Category`), and the e2e test fails if any tab needs a scroll at 900x640 (only the Quick messages list may scroll). A passing unit test does not show that text is visible or readable. Say in your report what you looked at. If you did not run the app, say that.

## How the Electron test works

`e2e/smoke.e2e.test.ts` launches `dist/` with Playwright's Electron driver. `NEOPROMPTER_USER_DATA` points the app at a temp directory, so it never touches your real library. A pre-written `output-settings.json` turns on the Windowed Output, so the Output opens in an ordinary window with no second monitor. The Output starts Off, so the test switches it On with the Output switch in the Button bar. The Virtual shuttle and Preferences open from the native menu (as their own windows), and the HTTP API listens on the fixed port 4780, so run the e2e test alone. The test drives the app the way the Operator view does, with `window.neoprompter.dispatch(command)` on the Operator page, and reads results from the Output page's DOM and `window.neoprompter.getState()`.

To check a new behavior, add a test there: dispatch the commands, then assert on the Output DOM or take a screenshot.

## Launching by hand

`npm start` builds and launches the app.

## Dependencies stay current by themselves

npm can leave Electron's binary uninstalled. `npm start` and `npm run test:e2e` install it when missing (`scripts/ensure-electron.mjs`). After a merge, pull, or branch switch that changes `package-lock.json`, the git hooks (`.husky/post-merge`, `.husky/post-checkout`) run `npm ci` and then the same Electron check. In a fresh worktree, run `npm ci` and `node scripts/ensure-electron.mjs` yourself, because worktrees start without `node_modules`.

## A full screen Output on one display

The Output only goes full screen on a display other than the Operator view's, so a machine with one display cannot show it. The e2e test sets `NEOPROMPTER_FAKE_SECOND_DISPLAY=1`, which adds a pretend second display on top of the real one, so a genuine full screen Output opens and Esc can be tested for real. Closing a full screen window on macOS is slow and pulls a window created meanwhile into its Space, so the main process takes the old Output out of full screen, closes it, and only then opens the new one (`retireOutput` in `src/main/main.ts`).

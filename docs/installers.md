# Installers

- `npm run dist:mac` builds `release/NeoPrompter-<ver>.dmg`; `npm run dist:win` builds `release/NeoPrompter Setup <ver>.exe` (NSIS; cross-builds from macOS without wine). `npm run dist:check` verifies the artifacts exist. Config: `electron-builder.yml`. The app icon is drawn in `build/icon.svg`; `node scripts/make-icon.mjs` (macOS, needs `librsvg`) rebuilds `build/icon.icns`, `build/icon.ico` and `build/icon.png` from it, and they are committed. `release/` is git-ignored.
- Unsigned, no auto-update: updates are done by hand. macOS: right-click > Open on first launch. Windows: SmartScreen "More info > Run anyway".
- The app makes no network calls (`src/packaging/offline.test.ts` guards against remote resources). The Windows `.exe` is built but not run-tested here (no Windows machine).

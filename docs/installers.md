# Installers

- `npm run dist:mac` builds `release/Neoprompter-<ver>.dmg`; `npm run dist:win` builds `release/Neoprompter Setup <ver>.exe` (NSIS; cross-builds from macOS without wine). `npm run dist:check` verifies the artifacts exist. Config: `electron-builder.yml`. `release/` is git-ignored.
- Unsigned, no auto-update: updates are done by hand. macOS: right-click > Open on first launch. Windows: SmartScreen "More info > Run anyway".
- The app makes no network calls (`src/packaging/offline.test.ts` guards against remote resources). The Windows `.exe` is built but not run-tested here (no Windows machine).

# Installers

- `npm run dist:mac` builds `release/NeoPrompter-<ver>-mac-arm64.dmg` (Apple Silicon) and `release/NeoPrompter-<ver>-mac-x64.dmg` (Intel); `npm run dist:win` builds `release/NeoPrompter-Setup-<ver>-win-x64.exe` (NSIS; cross-builds from macOS without wine). The names have no spaces and carry the platform and architecture (`artifactName` in `electron-builder.yml`), because GitHub rewrites spaces in release file names. `npm run dist:check` verifies the artifacts exist. Config: `electron-builder.yml`. The app icon is drawn in `build/icon.svg`; `node scripts/make-icon.mjs` (macOS, needs `librsvg`) rebuilds `build/icon.icns`, `build/icon.ico` and `build/icon.png` from it, and they are committed. `release/` is git-ignored.
- Unsigned, so updates are installed by hand; the app only tells the Operator a newer version exists (see Update check below). macOS: right-click > Open on first launch. Windows: SmartScreen "More info > Run anyway".
- The app's only network request is the Update check (ADR 0004); `src/packaging/offline.test.ts` guards against remote resources and any other remote host. The Windows `.exe` is built but not run-tested here (no Windows machine).

## Releasing

Pushing a version tag builds the installers on GitHub and drafts a release (`.github/workflows/release.yml`):

1. Set the version and commit it: `npm version 0.2.0 --no-git-tag-version`, commit, push. A pre-release is `0.3.0-beta.1`.
2. Tag that commit `v0.2.0` and push the tag (`git tag v0.2.0 && git push origin v0.2.0`), or use "Draft a new release" on GitHub and choose a new `v0.2.0` tag. Either way, the tag push starts the build.
3. The workflow stops at once if the tag is not `v` plus the `package.json` version (`scripts/check-release-tag.mjs`, tested in `scripts/releaseTag.test.mjs`), then runs `npm run check`. Only if that passes does it build the two macOS disk images on a macOS runner and the Windows installer on a Windows runner.
4. It creates a **draft** release for the tag with generated notes (commits since the last tag) under the first-launch note in `.github/release-notes.md`, and a hyphenated version such as `0.3.0-beta.1` is marked a pre-release. Review the draft on GitHub and press Publish. If a release for the tag already exists, the installers are added to it instead.

The builds are unsigned (no Apple or Windows certificate), which is why the release notes explain the first launch. If a certificate is added later, put it in repository secrets and set it in `electron-builder.yml`; the tag flow stays the same. The Electron e2e tests are not run in CI (they need a display). The workflow itself can only be exercised by pushing a tag: try it once on a throwaway branch: set the version to `0.1.1-test.1`, commit, tag that commit `v0.1.1-test.1`, push the tag, and delete the draft release and the tag afterwards.

## Update check

`src/updates/` (headless) asks the GitHub releases API for this repo (`src/main/githubReleases.ts`, the only remote host in the code) and shows an Update notice in Edit mode when a newer published release exists. Drafts are never seen; a stable build ignores pre-releases, a pre-release build hears about newer ones. It runs at launch at most once a day (Preferences > General turns that off) and on "Check now"; a launch failure is silent, a manual one says so. "Skip this version" is remembered in `update-settings.json` until a newer version is published. It never appears in Run mode. `NEOPROMPTER_NO_UPDATE_CHECK=1` disables the launch check (the e2e tests set it), and `NEOPROMPTER_UPDATE_STUB_URL` points the lookup at a local stub to try the notice by hand.

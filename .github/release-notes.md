## Installing

These builds are **not code-signed** (there is no Apple or Windows certificate behind them), so the
first launch needs one extra step.

**macOS** (`-mac-arm64` for Apple Silicon, `-mac-x64` for Intel)

1. Open the `.dmg` and drag NeoPrompter to Applications.
2. Right-click NeoPrompter and choose **Open**, then **Open** again.
3. If macOS says the app is damaged or will not open, clear the download flag once and try again:
   `xattr -dr com.apple.quarantine /Applications/NeoPrompter.app`

**Windows** (`-win-x64`)

1. Run the installer. If SmartScreen appears, choose **More info**, then **Run anyway**.

There is no auto-update: install a newer release over the old one.

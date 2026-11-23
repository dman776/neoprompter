# Electron for consistent scrolling

NeoPrompter is built with Electron and TypeScript. Smooth, fast scrolling must look the same on macOS and Windows, and Electron bundles one Chromium engine on both. Tauri was considered and rejected: it is smaller, but it uses WebKit on macOS and WebView2 on Windows, so scroll smoothness can differ between the two. Electron also has ready-made Node libraries for raw ShuttleXPress access, `.doc`/`.docx` import, and the local web server behind the Producer page and the Companion API.

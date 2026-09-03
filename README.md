# NestCut

Offline PDF print-and-cut nesting, duplex preview, and an editable Illustrator registration reference box.

## Web development

Use Node.js 22 or newer. Run `npm ci`, then `npm run dev`.
Run `npm test` for geometry, preset, and desktop asset-boundary regression tests.

## Windows desktop

Run `npm run desktop:start` to build and launch the desktop app locally. This serves the built frontend on the private `nestcut://app/` origin; no web server or internet connection is needed. Source-tree runs use a separate `NestCut-dev` data folder so testing does not change installed-app presets.

On **Windows x64**, run:

```sh
npm ci
npm test
npm run desktop:dist:win
```

Output: `release/NestCut-0.1.0-Windows-x64-Setup.exe` (version follows package.json). The installer supports per-user installation, a chosen install directory, and shortcuts. The app keeps presets on upgrade and uninstall; use the preset Delete action to remove saved entries deliberately.

Alternatively, after committing/pushing the workflow, open GitHub Actions → **Windows Desktop Build** → **Run workflow**. Download **NestCut-Windows-x64** from that run's artifacts. It contains the installer and a SHA-256 checksum. The workflow also supports `desktop-v*` tags. It does **not** create a public release or upload source PDFs. Public distribution is a separate, deliberate release step.

This initial installer is **unsigned**: Windows may show an unrecognized-publisher/SmartScreen warning. Verify the download source and checksum; obtain a Windows code-signing certificate before broad public distribution. Do not disable system security globally. Test installation, PDF upload, nesting, PDF Save As, presets after restart, and uninstall on a Windows PC before release. A successful macOS smoke test is not a Windows acceptance test.

## Presets and files

- Installed Windows app data: `%APPDATA%/NestCut/`. Presets use Chromium local storage at the stable `nestcut://app/` origin, independent of browser browsing data.
- Built-in paper presets are read-only. Saved presets support **Update**, **Rename**, **Delete**, and **Save as new**, including paper size, margins, gap, arrangement, orientation, and registration-box settings.
- Browser presets are **not automatically copied** into the desktop app. Re-create them in the app for this version.
- Imported PDF data stays in the local renderer. PDFs and desktop fonts are processed offline. Exports use the native Save As dialog; canceling that dialog does not save a file.
- No Node.js or filesystem bridge is exposed to imported content. The sandboxed renderer can access only packaged frontend assets and files the user selects. Remote navigation and permission requests are denied.
- The rectangle is a reference for Illustrator / Cutting Master, not a machine-ready Graphtec cut file or ARMS mark. Convert it with the official tooling before production.

Build outputs are ignored by git. No auto-update service or public publishing is configured.

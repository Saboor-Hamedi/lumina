Icon generation and packaging

Overview
- The app's packager (`electron-builder`) is configured to use icons from the `build/` folder (`buildResources: build`).
- To replace the Electron default icon everywhere (Start menu, pinned shortcuts, installer, exe), you must build/package the app. The `BrowserWindow` icon helps during development but packaged artifacts require icons embedded at build time.

Quick generate (recommended)
- If you have a PNG at `renderer/public/icon.png`, run this (bash):

```bash
npm run make:icons
```

- This uses `npx electron-icon-maker` to produce `build/icon.ico` and `build/icon.icns` (when possible) into the `build/` folder.

Manual alternatives
- Create a multi-size .ico with ImageMagick (Windows):

```bash
magick convert path/to/source-icon.png -define icon:auto-resize=256,128,64,48,32,16 build/icon.ico
```

- Create an .icns on macOS using `iconutil`:

```bash
mkdir -p tmp.iconset
sips -z 16 16    source-icon.png --out tmp.iconset/icon_16x16.png
sips -z 32 32    source-icon.png --out tmp.iconset/icon_16x16@2x.png
sips -z 32 32    source-icon.png --out tmp.iconset/icon_32x32.png
sips -z 64 64    source-icon.png --out tmp.iconset/icon_32x32@2x.png
sips -z 128 128  source-icon.png --out tmp.iconset/icon_128x128.png
sips -z 256 256  source-icon.png --out tmp.iconset/icon_128x128@2x.png
sips -z 256 256  source-icon.png --out tmp.iconset/icon_256x256.png
sips -z 512 512  source-icon.png --out tmp.iconset/icon_256x256@2x.png
sips -z 512 512  source-icon.png --out tmp.iconset/icon_512x512.png
sips -z 1024 1024 source-icon.png --out tmp.iconset/icon_512x512@2x.png
iconutil -c icns tmp.iconset -o build/icon.icns
rm -rf tmp.iconset
```

Dev vs packaged notes
- Development: `createWindow()` looks for `resources/icon.ico` (Windows) and `renderer/public/icon.png` for non-Windows. If you want to see the icon in dev, copy `build/icon.ico` to `resources/icon.ico` (or ensure `resources/icon.ico` exists).
- Packaged: run `npm run build:win` (or appropriate build script). The produced installer/exe will embed `build/icon.ico` and `build/icon.icns` due to `electron-builder.yml` configuration.

If you'd like, I can:
- Run `npm run make:icons` for you (needs the source PNG to be present at `renderer/public/icon.png`).
- Add a fallback script that attempts multiple source locations.


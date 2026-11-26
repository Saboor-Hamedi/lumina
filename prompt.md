npm run dev
npm notice run lumina@2.3.0 dev
npm notice run tauri dev
     Running BeforeDevCommand (`npm run dev:renderer`)
npm notice run lumina@2.3.0 dev:renderer
npm notice run vite
failed to load config from B:\electron\lumina\vite.config.mjs
error when starting dev server:
Error: ENOSPC: no space left on device, write
    at async write (node:internal/fs/promises:1492:8)
    at async writeFileHandle (node:internal/fs/promises:1174:7)
    at async loadConfigFromBundledFile (file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:35994:3)
    at async bundleAndLoadConfigFile (file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:35884:17)
    at async loadConfigFromFile (file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:35851:42)
    at async resolveConfig (file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:35500:22)
    at async _createServer (file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:25441:67)
    at async CAC.<anonymous> (file:///B:/electron/lumina/node_modules/vite/dist/node/cli.js:572:18)
       Error The "beforeDevCommand" terminated with a non-zero status code.

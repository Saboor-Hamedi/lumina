er/ExplorerModals.tsx". Does the file exist?
Plugin: vite:import-analysis
File: B:/electron/lumina/src/renderer/src/features/Explorer/ExplorerModals.tsx:25:7
6 | import Confirm from "../modals/Confirm";
7 | import ContextMenu from "../modals/ContextMenu";
8 | import "../drop/css/externaldropOverlay.css";
| ^
9 | export const ExplorerModals = ({
10 | activeListDragItem,
7:42:52 PM [vite] (client) hmr update /src/assets/index.css, /src/features/Explorer/FileExplorer.tsx
7:42:52 PM [vite] (client) hmr update /src/assets/index.css, /src/features/Explorer/FileExplorer.tsx (x2)
7:42:53 PM [vite] Internal server error: Failed to resolve import "../drop/css/externaldropOverlay.css" from "src/renderer/src/features/Explorer/ExplorerModals.tsx". Does the file exist?
Plugin: vite:import-analysis
File: B:/electron/lumina/src/renderer/src/features/Explorer/ExplorerModals.tsx:25:7
6 | import Confirm from "../modals/Confirm";
7 | import ContextMenu from "../modals/ContextMenu";
8 | import "../drop/css/externaldropOverlay.css";
| ^
9 | export const ExplorerModals = ({
10 | activeListDragItem,
at TransformPluginContext._formatLog (file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:29079:43)
at TransformPluginContext.error (file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:29076:14)
at normalizeUrl (file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:27199:18)
at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
at async file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:27257:32
at async Promise.all (index 7)
at async TransformPluginContext.transform (file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:27225:4)
at async EnvironmentPluginContainer.transform (file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:28877:14)
at async loadAndTransform (file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:22746:26)
at async viteTransformMiddleware (file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:24622:20)
[ErrorBoundary] {
message: 'Failed to fetch dynamically imported module: http://localhost:5173/src/App.jsx',
stack: 'TypeError: Failed to fetch dynamically imported module: http://localhost:5173/src/App.jsx',
componentStack: '\n' +
' at Lazy (<anonymous>)\n' +
' at Suspense (<anonymous>)\n' +
' at GlobalErrorHandler (http://localhost:5173/src/components/GlobalErrorHandler.jsx:6:5)',
timestamp: 1791549773488,
errorId: 'error-1791549773472-uun9z6w'
}
7:43:08 PM [vite] (client) hmr update /src/assets/index.css, /src/features/Explorer/ExplorerVirtuosoList.tsx
7:43:33 PM [vite] (client) hmr update /src/features/Explorer/css/fileExplorer.css
[17252:1009/194354.900:ERROR:CONSOLE:1] "Request Autofill.enable failed. {"code":-32601,"message":"'Autofill.enable' wasn't found"}", source: devtools://devtools/bundled/core/protocol_client/protocol_client.js (1)
[17252:1009/194354.926:ERROR:CONSOLE:1] "Request Autofill.setAddresses failed. {"code":-32601,"message":"'Autofill.setAddresses' wasn't found"}", source: devtools://devtools/bundled/core/protocol_client/protocol_client.js (1)
7:44:00 PM [vite] (client) Pre-transform error: Failed to resolve import "../drop/css/externaldropOverlay.css" from "src/renderer/src/features/Explorer/ExplorerModals.tsx". Does the file exist?
Plugin: vite:import-analysis
File: B:/electron/lumina/src/renderer/src/features/Explorer/ExplorerModals.tsx:25:7
6 | import Confirm from "../modals/Confirm";
7 | import ContextMenu from "../modals/ContextMenu";
8 | import "../drop/css/externaldropOverlay.css";
| ^
9 | export const ExplorerModals = ({
10 | activeListDragItem,
7:44:02 PM [vite] Internal server error: Failed to resolve import "../drop/css/externaldropOverlay.css" from "src/renderer/src/features/Explorer/ExplorerModals.tsx". Does the file exist?
Plugin: vite:import-analysis
File: B:/electron/lumina/src/renderer/src/features/Explorer/ExplorerModals.tsx:25:7
6 | import Confirm from "../modals/Confirm";
7 | import ContextMenu from "../modals/ContextMenu";
8 | import "../drop/css/externaldropOverlay.css";
| ^
9 | export const ExplorerModals = ({
10 | activeListDragItem,
at TransformPluginContext._formatLog (file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:29079:43)
at TransformPluginContext.error (file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:29076:14)
at normalizeUrl (file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:27199:18)
at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
at async file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:27257:32
at async Promise.all (index 7)
at async TransformPluginContext.transform (file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:27225:4)
at async EnvironmentPluginContainer.transform (file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:28877:14)
at async loadAndTransform (file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:22746:26)
at async viteTransformMiddleware (file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:24622:20)
[ErrorBoundary] {
message: 'Failed to fetch dynamically imported module: http://localhost:5173/src/App.jsx?t=1791549812397',
stack: 'TypeError: Failed to fetch dynamically imported module: http://localhost:5173/src/App.jsx?t=1791549812397',
componentStack: '\n' +
' at Lazy (<anonymous>)\n' +
' at Suspense (<anonymous>)\n' +
' at GlobalErrorHandler (http://localhost:5173/src/components/GlobalErrorHandler.jsx:6:5)',
timestamp: 1791549842466,
errorId: 'error-1791549842438-4wshpf2'
}
7:44:45 PM [vite] Internal server error: Failed to resolve import "../drop/css/externaldropOverlay.css" from "src/renderer/src/features/Explorer/ExplorerModals.tsx". Does the file exist?
Plugin: vite:import-analysis
File: B:/electron/lumina/src/renderer/src/features/Explorer/ExplorerModals.tsx:25:7
6 | import Confirm from "../modals/Confirm";
7 | import ContextMenu from "../modals/ContextMenu";
8 | import "../drop/css/externaldropOverlay.css";
| ^
9 | export const ExplorerModals = ({
10 | activeListDragItem,
at TransformPluginContext._formatLog (file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:29079:43)
at TransformPluginContext.error (file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:29076:14)
at normalizeUrl (file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:27199:18)
at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
at async file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:27257:32
at async Promise.all (index 7)
at async TransformPluginContext.transform (file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:27225:4)
at async EnvironmentPluginContainer.transform (file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:28877:14)
at async loadAndTransform (file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:22746:26)
at async viteTransformMiddleware (file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:24622:20) (x2)
[ErrorBoundary] {
message: 'Failed to fetch dynamically imported module: http://localhost:5173/src/App.jsx?t=1791549812397',
stack: 'TypeError: Failed to fetch dynamically imported module: http://localhost:5173/src/App.jsx?t=1791549812397',
componentStack: '\n' +
' at Lazy (<anonymous>)\n' +
' at Suspense (<anonymous>)\n' +
' at GlobalErrorHandler (http://localhost:5173/src/components/GlobalErrorHandler.jsx:6:5)',
timestamp: 1791549886835,
errorId: 'error-1791549886818-8dmkhf1'

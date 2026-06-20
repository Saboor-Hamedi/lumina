:41:33 AM [vite] (client) Pre-transform error: Failed to resolve import "../../Icons/fileIconMapper" from "src/renderer/src/features/AI/AIChatPanel.jsx". Does the file exist?
  Plugin: vite:import-analysis
  File: B:/electron/lumina/src/renderer/src/features/AI/AIChatPanel.jsx:13:31
  25 |  import { useAIStore } from "../../core/store/useAIStore";
  26 |  import { useVaultStore } from "../../core/store/useVaultStore";
  27 |  import { getSnippetIcon } from "../../Icons/fileIconMapper";
     |                                  ^
  28 |  import { Composer } from "./Composer";
  29 |  import "../Layout/AppShell.css";
11:41:33 AM [vite] (client) Pre-transform error: Failed to resolve import "../../Icons/fileIconMapper" from "src/renderer/src/features/AI/AIChatPanel.jsx". Does the file exist?
  Plugin: vite:import-analysis
  File: B:/electron/lumina/src/renderer/src/features/AI/AIChatPanel.jsx:13:31
  25 |  import { useAIStore } from "../../core/store/useAIStore";
  26 |  import { useVaultStore } from "../../core/store/useVaultStore";
  27 |  import { getSnippetIcon } from "../../Icons/fileIconMapper";
     |                                  ^
  28 |  import { Composer } from "./Composer";
  29 |  import "../Layout/AppShell.css"; (x2)
11:41:35 AM [vite] Internal server error: Failed to resolve import "../../Icons/fileIconMapper" from "src/renderer/src/features/AI/AIChatPanel.jsx". Does the file exist?
  Plugin: vite:import-analysis
  File: B:/electron/lumina/src/renderer/src/features/AI/AIChatPanel.jsx:13:31
  25 |  import { useAIStore } from "../../core/store/useAIStore";
  26 |  import { useVaultStore } from "../../core/store/useVaultStore";
  27 |  import { getSnippetIcon } from "../../Icons/fileIconMapper";
     |                                  ^
  28 |  import { Composer } from "./Composer";
  29 |  import "../Layout/AppShell.css";
      at TransformPluginContext._formatLog (file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:29618:43)
      at TransformPluginContext.error (file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:29615:14)
      at normalizeUrl (file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:27738:18)
      at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
      at async file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:27796:32
      at async Promise.all (index 8)
      at async TransformPluginContext.transform (file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:27764:4)
      at async EnvironmentPluginContainer.transform (file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:29416:14)
      at async loadAndTransform (file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:23287:26)
      at async viteTransformMiddleware (file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:25159:20)
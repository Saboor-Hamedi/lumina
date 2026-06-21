12:33:02 PM [vite] (client) Pre-transform error: Failed to resolve import "../../../../core/hooks/useKeyboardShortcuts" from "src/renderer/src/features/Workspace/components/FindWidget.jsx". Does the file exist?
  Plugin: vite:import-analysis
  File: B:/electron/lumina/src/renderer/src/features/Workspace/components/FindWidget.jsx:3:37
  3  |  import React, { useState, useEffect, useRef, useCallback } from "react";
  4  |  import { Search, Replace, ReplaceAll, X, ChevronUp, ChevronDown, Type, AlignLeft, Regex, ChevronRight } from "lucide-...
  5  |  import { useKeyboardShortcuts } from "../../../../core/hooks/useKeyboardShortcuts";
     |                                        ^
  6  |  import "./FindWidget.css";
  7  |  const FindWidget = ({ editorView, onClose, initialReplaceMode = false }) => {
12:33:02 PM [vite] Internal server error: Failed to resolve import "../../../../core/hooks/useKeyboardShortcuts" from "src/renderer/src/features/Workspace/components/FindWidget.jsx". Does the file exist?
  Plugin: vite:import-analysis
  File: B:/electron/lumina/src/renderer/src/features/Workspace/components/FindWidget.jsx:3:37
  3  |  import React, { useState, useEffect, useRef, useCallback } from "react";
  4  |  import { Search, Replace, ReplaceAll, X, ChevronUp, ChevronDown, Type, AlignLeft, Regex, ChevronRight } from "lucide-...
  5  |  import { useKeyboardShortcuts } from "../../../../core/hooks/useKeyboardShortcuts";
     |                                        ^
  6  |  import "./FindWidget.css";
  7  |  const FindWidget = ({ editorView, onClose, initialReplaceMode = false }) => {
      at TransformPluginContext._formatLog (file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:29618:43)
      at TransformPluginContext.error (file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:29615:14)
      at normalizeUrl (file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:27738:18)
      at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
      at async file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:27796:32
      at async Promise.all (index 3)
      at async TransformPluginContext.transform (file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:27764:4)
      at async EnvironmentPluginContainer.transform (file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:29416:14)
      at async loadAndTransform (file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:23287:26)
      at async viteTransformMiddleware (file:///B:/electron/lumina/node_modules/vite/dist/node/chunks/config.js:25159:20)
[Main] Starting background indexing after renderer ready...
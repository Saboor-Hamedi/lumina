# ai system

## overview

lumina has a multi-provider ai system supporting cloud apis and local models. the architecture is layered:

```
composer (chat input with slash commands)
    |
    v
aichatpanel.jsx / aichatmodal.jsx (dual chat uis)
    |
    v
useaistore.js (state management, streaming, embeddings)
    |
    +--> providers/ (deepseek, openai, anthropic, ollama)
    +--> ai.worker.js (local embeddings via @xenova/transformers)
    +--> imagegenerationservice.js (huggingface image gen)

markdowneditor.jsx (inline ai / editor integration)
```

---

## 1. ai store (useaistore.js)

**path:** `src/renderer/src/core/store/useAIStore.js` (1280 lines)

the central state manager for all ai features. built with zustand.

### state

| field | type | description |
|-------|------|-------------|
| `chatMessages` | array | full chat history with roles, content, metadata |
| `chatSessions` | array | saved chat sessions stored in indexeddb (dexie) |
| `activeSessionId` | string | currently active session |
| `isGenerating` | boolean | whether ai is currently streaming |
| `streamingContent` | string | live partial response during generation |
| `aiError` | string | last error message |
| `isModelReady` | boolean | local embedding model loaded |
| `modelLoadingProgress` | number | 0-100% for local model download |
| `embeddingsCache` | object | cached embeddings keyed by snippet id |
| `pendingTasks` | map | pending worker task promises |

### key methods

```javascript
// streaming chat
sendMessage(messages, mode, options)  // sends prompt, handles streaming
cancelGeneration()                     // aborts active stream

// local embeddings (web worker)
generateEmbedding(text)               // vectorize text
searchNotes(query, threshold)         // semantic search entire vault
indexVault(snippets)                  // batch-index all notes

// image generation
generateImage(prompt)                 // huggingface inference api

// session management
saveSession()                         // persist to indexeddb
loadSessions()                        // restore from indexeddb
deleteSession(id)
```

### streaming logic

```
sendmessage()
  -> set isgenerating = true
  -> prepare context (system prompt + open snippet code)
  -> call active provider's chatstream()
  -> iterate yielded chunks, append to streamingcontent
  -> on complete: push to chatmessages, persist
  -> on error: set aierror, revert ui
```

### system prompt

the store holds a `systemPrompt` that includes:
- general instruction to be a helpful assistant
- file operation commands (lumina-create, lumina-update, lumina-delete)
- instructions for formatting code blocks with language tags

### commands parsed from ai output

the store parses ai responses for special code block languages:
- `lumina-create` — creates a new note from the code block content
- `lumina-update` — updates the currently open note
- `lumina-delete` — hides the code block from ui (delete instruction)

### chat history persistence

chats are saved to indexeddb via dexie with schema:
- session id, title, messages array, timestamp, model used
- restored on app mount, switchable via history panel

---

## 2. ai providers

**path:** `src/renderer/src/features/AI/providers/`

factory pattern: aiproviderfactory.createprovider(type, config)

### baseprovider

**path:** `src/renderer/src/features/AI/providers/BaseProvider.js` (65 lines)

abstract class with:
- `chatStream(messages, options)` — async generator, yields text chunks
- `isConfigured()` — checks if apikey is set
- `parseSSE(response)` — helper to parse server-sent events (used by openai/deepseek)

### deepseekprovider

**path:** `src/renderer/src/features/AI/providers/DeepSeekProvider.js`

- endpoint: `https://api.deepseek.com/v1/chat/completions`
- models: deepseek-chat (v3), deepseek-reasoner (r1)
- sse streaming
- api key from settings.deepseekkey

### openaiprovider

**path:** `src/renderer/src/features/AI/providers/OpenAIProvider.js`

- endpoint: `https://api.openai.com/v1/chat/completions`
- model: gpt-4o
- sse streaming
- api key from settings.openaikey

### anthropicprovider

**path:** `src/renderer/src/features/AI/providers/AnthropicProvider.js`

- endpoint: anthropic api
- model: claude 3.5 sonnet
- api key from settings.anthropickey

### ollamaprovider

**path:** `src/renderer/src/features/AI/providers/OllamaProvider.js`

- endpoint: configurable (default `http://localhost:11434/api/chat`)
- fully local, no api key needed
- supports any model served by ollama

### provider registration

**path:** `src/renderer/src/features/AI/providers/index.js`

```javascript
aiproviderfactory.createprovider(type, config)
  -> 'deepseek' -> deepseekprovider
  -> 'openai'   -> openaiprovider
  -> 'anthropic' -> anthropicprovider
  -> 'ollama'   -> ollamaprovider
```

settings.activeprovider controls which is used.
settings changed in settingsmodal → ai models tab.

---

## 3. ai worker (local embeddings)

**path:** `src/renderer/src/core/ai/ai.worker.js`

web worker for running @xenova/transformers off the main thread.

### responsibilities
- load `Xenova/all-MiniLM-L6-v2` embedding model (downloaded once, cached in browser)
- generate embeddings for text chunks
- compute cosine similarity between queries and vault content
- report progress via postmessage (0-100% loading)

### worker protocol

```
main thread -> worker:
  { type: 'load-model' }
  { type: 'embed', text: '...', id: requestId }

worker -> main thread:
  { type: 'progress', status: 'progress', progress: 0..100 }
  { type: 'progress', status: 'ready' }
  { type: 'result', id: requestId, status: 'complete', result: [float...] }
  { type: 'result', id: requestId, status: 'error', error: '...' }
```

### performance
- model cached in browser cache after first download (~80mb)
- embeddings cached in `embeddingsCache` object in aistore
- only new/changed notes re-indexed

---

## 4. chat uis

lumina has **two** chat ui implementations that share the same store:

### aichatpanel.jsx

**path:** `src/renderer/src/features/AI/AIChatPanel.jsx` (908 lines)

used as a sidebar panel (right sidebar). features:
- chat bubble rendering with react-markdown + remark-gfm
- code blocks with copy and apply buttons
- code blocks with `lumina-delete` language are hidden from display
- message feedback (thumbs up/down)
- chat history list
- empty state when no messages
- dark/theme-aware styling

### aichatmodal.jsx

**path:** `src/renderer/src/features/Overlays/AIChatModal.jsx` (954 lines)

a full modal overlay for ai chat. features:
- modal header with close/minimize
- floating mode (detached window via floatingwindowmanager)
- same chat bubble rendering as the panel
- history panel within the modal
- keyboard shortcut support

### composer.jsx

**path:** `src/renderer/src/features/AI/Composer.jsx` (162 lines)

the input area shared by both chat uis:
- auto-resizing textarea (max 140px height)
- mode selector dropdown
- slash command detection (`/` prefix)
- enter to send, shift+enter for newline
- cancel button during generation

### slashcommandmenu.jsx

**path:** `src/renderer/src/features/AI/SlashCommandMenu.jsx` (112 lines)

triggered by typing `/` in the composer:

| command | id | action |
|---------|----|--------|
| fast mode | fast | short concise answers |
| thinking mode | think | step-by-step reasoning (cot) |
| creative | creative | storytelling, higher temperature |
| coder | code | specialized for programming |
| generate image | image | pre-fills `/image ` prefix |
| clear chat | clear | dispatches clear-chat-context event |

---

## 5. image generation

**path:** `src/renderer/src/features/AI/imageGenerationService.js`

uses huggingface inference api:
- endpoint: configurable (default huggingface text-to-image models)
- api key from settings.huggingfacekey
- generates images via main process ipc (bypasses csp)
- images can be saved to vault assets

settings for image generation are in settingsmodal → ai models tab → image generation section.

---

## 6. ai settings

**path:** settings are in `useSettingsStore` + `SettingsModal.jsx`

### provider settings

| setting | key | used by |
|---------|-----|---------|
| active provider | activeprovider | all (deepseek\|openai\|anthropic\|ollama) |
| active model | activemodel | all (null = provider default) |
| deepseek key | deepseekkey | deepseek |
| deepseek model | deepseekmodel | deepseek (deepseek-chat / deepseek-reasoner) |
| openai key | openaikey | openai |
| anthropic key | anthropickey | anthropic |
| ollama url | ollamaurl | ollama (default http://localhost:11434/api/chat) |
| huggingface key | huggingfacekey | image generation |

### local ai settings

| setting | key | description |
|---------|-----|-------------|
| enable semantic indexing | enablelocalai | toggle rag context for provider (default true) |

---

## 7. editor integration

**path:** `src/renderer/src/features/Workspace/MarkdownEditor.jsx`

the markdown editor includes inline ai features:
- inline ai modal (`/overlays/inlineaimodal.jsx`) triggered by `ctrl+k`
- ghost text / autocomplete suggestions (future)
- context-aware: sends current file content as context to ai

---

## 8. correct state flow for agent operations

when the ai creates/updates/deletes notes, the correct flow is:

```
1. ai emits codeblock with special language tag
2. aistore parses the response, detects command
3. calls usevaultstore.saveSnippet / deleteSnippet
4. vaultstore does optimistic ui update
5. vaultstore sends ipc to main process
6. vaultmanager writes .md file to disk
7. vaultmanager's chokidar watcher detects change
8. re-scans vault, notifies renderer
9. vaultstore merges fresh data
```

**important:** always use `useVaultStore.getState()` methods for file operations. do not write files directly in renderer.

---

## 9. key files reference

| file | lines | purpose |
|------|-------|---------|
| `src/renderer/src/core/store/useAIStore.js` | 1280 | ai state, streaming, embeddings, commands |
| `src/renderer/src/features/AI/AIChatPanel.jsx` | 908 | chat ui sidebar panel |
| `src/renderer/src/features/Overlays/AIChatModal.jsx` | 954 | chat ui modal overlay |
| `src/renderer/src/features/AI/Composer.jsx` | 162 | chat input with slash commands |
| `src/renderer/src/features/AI/SlashCommandMenu.jsx` | 112 | slash command menu |
| `src/renderer/src/features/AI/providers/BaseProvider.js` | 65 | abstract provider base |
| `src/renderer/src/features/AI/providers/DeepSeekProvider.js` | - | deepseek implementation |
| `src/renderer/src/features/AI/providers/OpenAIProvider.js` | - | openai implementation |
| `src/renderer/src/features/AI/providers/AnthropicProvider.js` | - | anthropic implementation |
| `src/renderer/src/features/AI/providers/OllamaProvider.js` | - | ollama implementation |
| `src/renderer/src/features/AI/providers/index.js` | 30 | provider factory |
| `src/renderer/src/core/ai/ai.worker.js` | - | web worker for local embeddings |
| `src/renderer/src/features/AI/imageGenerationService.js` | - | huggingface image generation |
| `src/renderer/src/features/Overlays/InlineAIModal.jsx` | - | inline ai in editor |
| `src/renderer/src/features/Settings/SettingsModal.jsx` | 841 | ai settings in modal |

---

## 10. adding a new provider

1. create `providers/NewProvider.js` extending `BaseProvider`
2. implement `async *chatStream(messages, options)` — yield string chunks
3. register in `providers/index.js` `aiproviderfactory`
4. add api key setting to `usesettingsstore` defaults
5. add config ui in `settingsmodal.jsx` ai models tab
6. update settings `activeprovider` select options

# Guide: Updating the AI in Lumina

If you want to update the AI's behavior, features, or UI, you will primarily need to edit these 4 files:

### 1. The AI Store (Logic & Prompts)
**Path:** `src/renderer/src/core/store/useAIStore.js`
* **What it does:** This is the "brain" of the AI integration. It manages the chat history, holds the `systemPrompt`, and parses the AI's output for commands (like `lumina-create`, `lumina-update`, and `lumina-delete`).
* **Edit this if:** You want to change the system prompt, add new commands, or tweak how the AI applies changes to files.

### 2. The Chat UI (Appearance)
**Path:** `src/renderer/src/features/AI/AIChatPanel.jsx`
* **What it does:** This is the visual interface for the AI. It renders the chat bubbles, avatars, empty states, and special UI components (like hiding the buttons for `lumina-delete` code blocks).
* **Edit this if:** You want to change how the chat looks, add new buttons, or change how AI code blocks are rendered on screen.

### 3. The AI Worker (RAG & Engine)
**Path:** `src/renderer/src/core/ai/ai.worker.js`
* **What it does:** This is the background worker that handles heavy lifting like generating embeddings, searching the vault for RAG (Retrieval-Augmented Generation), and communicating with the model.
* **Edit this if:** You want to improve how the AI searches your vault, change the embedding models, or update the local AI engine.

### 4. The Editor Integration (Inline AI)
**Path:** `src/renderer/src/features/Workspace/MarkdownEditor.jsx`
* **What it does:** This handles the AI features directly inside the text editor (like auto-complete or inline generation).
* **Edit this if:** You want to add ghost text, inline AI commands, or improve how the AI interacts with the user's cursor.

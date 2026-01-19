# Lumina

> A premium, vault-based knowledge management application built with Electron, React, and CodeMirror 6.

![Lumina](https://img.shields.io/badge/version-1.0.2-blue)
![Tests](https://img.shields.io/badge/tests-93%20passed-success)
![License](https://img.shields.io/badge/license-MIT-green)

Lumina provides a sophisticated markdown editing experience with live preview, WikiLinks, advanced theming, AI-powered semantic search, and file-system-based storage. Perfect for developers, writers, and knowledge workers who value privacy and performance.

## ✨ Features

### 🎯 Core Features

- **Vault-First Architecture** - All notes stored as plain markdown files with YAML frontmatter
- **Multi-Tab Workspace** - High-performance session management with multiple notes open simultaneously
- **Live Preview** - "What You See Is What You Mean" editing with intelligent syntax hiding
- **WikiLinks** - Create connections between notes with `[[Link]]` syntax
- **Knowledge Graph** - Visualize your note connections with an interactive graph view
- **AI-Powered Search** - Semantic search using local AI models (privacy-first)
- **Multi-Vault Support** - Switch between different vault directories
- **Zero-Jump Performance** - Instant startup via IndexedDB caching

### 🎨 User Experience

- **Advanced Theming** - Multiple themes with custom color palettes
- **Resizable Sidebars** - Flexible layouts for custom productivity flows
- **Keyboard-First** - Comprehensive keyboard shortcuts for power users
- **Command Palette** - Quick access to all features (`Ctrl/Cmd + P`)
- **Drag & Drop** - Seamless image insertion
- **Tab Management** - Pin tabs, close others, organize your workspace

### 🔍 Search & Discovery

- **Full-Text Search** - Fast keyword-based search
- **Semantic Search** - Find notes by meaning, not just keywords
- **Tag System** - Organize with visual tag pills and autocomplete
- **File Explorer** - Navigate your vault with a familiar tree view

### 📝 Editor Features

- **CodeMirror 6** - Advanced text editor with syntax highlighting
- **Markdown Support** - Full markdown syntax with extensions
- **Code Blocks** - Syntax highlighting for 100+ languages
- **Auto-save** - Never lose your work
- **Caret Position Persistence** - Remembers where you left off

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** (or your package manager of choice)
- **Git**

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/lumina.git
   cd lumina
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run in development mode**
   ```bash
   npm run dev
   ```

### Building

Build for your platform:

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

## 📖 Usage

### Creating Your First Note

1. Press `Ctrl/Cmd + N` to create a new note
2. Start typing - your note auto-saves
3. Use markdown syntax for formatting

### Linking Notes

Create connections between notes using WikiLinks:

```markdown
This note references [[Another Note]] and [[Yet Another Note|Display Text]].
```

### Using the Graph View

1. Click the graph icon in the activity bar
2. Explore your note connections visually
3. Click nodes to navigate to notes

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + N` | New note |
| `Ctrl/Cmd + P` | Command palette |
| `Ctrl/Cmd + S` | Save |
| `Ctrl/Cmd + Delete` | Delete note |
| `Ctrl/Cmd + K` | Quick actions |
| `Escape` | Close modals |

See the full list in Settings → Keyboard Shortcuts.

## 🛠️ Development

### Project Structure

```
lumina/
├── src/
│   ├── main/           # Electron main process
│   │   ├── index.js    # Main entry point
│   │   ├── VaultManager.js
│   │   ├── VaultSearch.js
│   │   └── VaultIndexer.js
│   ├── preload/        # Preload scripts
│   └── renderer/       # React application
│       └── src/
│           ├── components/  # UI components
│           ├── core/        # Core logic (stores, hooks, utils)
│           └── features/    # Feature modules
├── scripts/            # Build scripts
└── build/             # Build artifacts
```

### Available Scripts

```bash
# Development
npm run dev              # Start development server
npm start               # Preview production build

# Building
npm run build           # Build for current platform
npm run build:win       # Build for Windows
npm run build:mac       # Build for macOS
npm run build:linux     # Build for Linux

# Testing
npm test                # Run tests in watch mode
npm run test:run        # Run tests once
npm run test:coverage   # Generate coverage report
npm run test:ui         # Run tests with UI

# Performance
npm run workbench       # Run performance workbench

# Code Quality
npm run lint            # Run ESLint
npm run format          # Format with Prettier
```

### Technology Stack

**Main Process:**
- Electron 39.2.4
- better-sqlite3 (legacy migration)
- chokidar (file watching)
- gray-matter (YAML frontmatter)

**Renderer Process:**
- React 19.1.1
- CodeMirror 6
- Zustand (state management)
- Dexie (IndexedDB)
- @xenova/transformers (AI embeddings)
- react-force-graph-2d (graph visualization)

**Build Tools:**
- Vite 7.1.6
- electron-vite
- Vitest (testing)
- Tailwind CSS

## 🧪 Testing

The project includes comprehensive test coverage:

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- src/renderer/src/components/atoms/Button.test.jsx
```

**Current Coverage:**
- 93 tests across 8 test files
- Components, hooks, stores, utilities, and main process modules

See [ROADMAP.md](./ROADMAP.md) for testing improvements planned.

## 📚 Documentation

- **[ROADMAP.md](./ROADMAP.md)** - Project roadmap and future plans
- **[notes/doc.md](./notes/doc.md)** - Technical documentation
- **[notes/suggestions.md](./notes/suggestions.md)** - Feature suggestions and implementations

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Make your changes**
4. **Add tests** for new features
5. **Run tests** (`npm test`)
6. **Commit your changes** (`git commit -m 'Add amazing feature'`)
7. **Push to the branch** (`git push origin feature/amazing-feature`)
8. **Open a Pull Request**

### Development Guidelines

- Follow the existing code style
- Write tests for new features
- Update documentation as needed
- Keep commits atomic and well-described

## 🐛 Troubleshooting

### Common Issues

**App won't start:**
```bash
# Rebuild native modules
npm run rebuild
```

**Tests failing:**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Build errors:**
```bash
# Clean build directory
rm -rf out dist
npm run build
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE.md](./LICENSE.md) file for details.

## 🙏 Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- UI powered by [React](https://react.dev/)
- Editor by [CodeMirror](https://codemirror.net/)
- Icons from [Lucide](https://lucide.dev/)

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/your-username/lumina/issues)
- **Discussions:** [GitHub Discussions](https://github.com/your-username/lumina/discussions)

---

**Made with ❤️ for knowledge workers who value privacy and performance.**

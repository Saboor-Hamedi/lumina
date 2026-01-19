import {
  Settings,
  Cog,
  FileJson,
  FileCode,
  Hash,
  ImageIcon,
  FileText,
  Folder,
  FolderCode,
  Database,
  Key,
  Lock,
  Package,
  Terminal,
  Book,
  FileCheck,
  FileX,
  File,
  FileType,
  Code,
  Globe,
  Server,
  Shield,
  Wrench,
  Zap,
  Box
} from 'lucide-react'

/**
 * File Icon Mapper
 * Maps file names, patterns, and extensions to appropriate Lucide React icons
 * Used for displaying contextual icons in the sidebar file explorer
 */

const getFileIcon = (title, language) => {
  const titleLower = (title || '').toLowerCase().trim()
  const lang = (language || 'markdown').toLowerCase()

  // Exact filename matches (highest priority)
  const exactMatches = {
    // Settings & Config
    'settings': Settings,
    'setting': Settings,
    'config': Cog,
    'configuration': Cog,
    '.env': Key,
    'env': Key,
    '.env.local': Key,
    '.env.production': Key,
    '.env.development': Key,
    'package.json': Package,
    'package-lock.json': Package,
    'yarn.lock': Package,
    'pnpm-lock.yaml': Package,

    // Common config files
    'tsconfig.json': FileJson,
    'jsconfig.json': FileJson,
    'webpack.config.js': Cog,
    'vite.config.js': Cog,
    'rollup.config.js': Cog,
    'tailwind.config.js': Cog,
    'postcss.config.js': Cog,
    'eslint.config.js': Cog,
    'prettier.config.js': Cog,
    '.prettierrc': Cog,
    '.eslintrc': Cog,
    '.gitignore': File,
    '.gitattributes': File,
    'dockerfile': Terminal,
    '.dockerignore': File,
    'docker-compose.yml': Terminal,
    'docker-compose.yaml': Terminal,

    // Documentation
    'readme.md': Book,
    'readme': Book,
    'license': FileText,
    'license.md': FileText,
    'changelog': FileText,
    'changelog.md': FileText,
    'contributing.md': Book,
    'contributing': Book,

    // Security
    '.htaccess': Shield,
    'robots.txt': File,
    '.security': Shield,

    // Build & Deploy
    'build': FolderCode,
    'dist': FolderCode,
    'out': FolderCode,
    '.next': FolderCode,
    '.nuxt': FolderCode,
    '.cache': Folder,

    // Source directories
    'src': FolderCode,
    'source': FolderCode,
    'lib': FolderCode,
    'libs': FolderCode,
    'components': FolderCode,
    'utils': FolderCode,
    'helpers': FolderCode,
    'hooks': FolderCode,
    'stores': Database,
    'store': Database,
    'state': Database,
    'api': Server,
    'routes': Globe,
    'pages': File,
    'views': File,
    'templates': File,
    'assets': ImageIcon,
    'public': Globe,
    'static': Globe,
    'styles': FileCode,
    'css': FileCode,
    'themes': Zap,
    'theme': Zap,

    // Test directories
    'test': FileCheck,
    'tests': FileCheck,
    'spec': FileCheck,
    '__tests__': FileCheck,
    '__mocks__': File,

    // Documentation directories
    'docs': Book,
    'documentation': Book,
    'wiki': Book,
    'notes': Book,
    'notes.md': Book,

    // Data & Database
    'data': Database,
    'db': Database,
    'database': Database,
    'models': Database,
    'schema': Database,
    'migrations': Database,

    // Scripts
    'scripts': Terminal,
    'bin': Terminal,
    'tools': Wrench,
    'cli': Terminal,

    // Other common folders
    'node_modules': Package,
    'vendor': Package,
    'dependencies': Package,
    'modules': Box,
    'plugins': Zap,
    'extensions': Zap
  }

  // Check exact matches first
  if (exactMatches[titleLower]) {
    const Icon = exactMatches[titleLower]
    return Icon
  }

  // Pattern matches (contains)
  const patternMatches = [
    { pattern: /^\.env/, icon: Key },
    { pattern: /config/, icon: Cog },
    { pattern: /setting/, icon: Settings },
    { pattern: /^src/, icon: FolderCode },
    { pattern: /^lib/, icon: FolderCode },
    { pattern: /component/, icon: FolderCode },
    { pattern: /^test/, icon: FileCheck },
    { pattern: /^spec/, icon: FileCheck },
    { pattern: /^doc/, icon: Book },
    { pattern: /^note/, icon: Book },
    { pattern: /^readme/, icon: Book },
    { pattern: /^license/, icon: FileText },
    { pattern: /^changelog/, icon: FileText },
    { pattern: /package/, icon: Package },
    { pattern: /docker/, icon: Terminal },
    { pattern: /^\.git/, icon: File },
    { pattern: /^\.docker/, icon: Terminal },
    { pattern: /security/, icon: Shield },
    { pattern: /secret/, icon: Lock },
    { pattern: /key/, icon: Key },
    { pattern: /credential/, icon: Lock },
    { pattern: /password/, icon: Lock },
    { pattern: /api/, icon: Server },
    { pattern: /route/, icon: Globe },
    { pattern: /page/, icon: File },
    { pattern: /view/, icon: File },
    { pattern: /template/, icon: File },
    { pattern: /asset/, icon: ImageIcon },
    { pattern: /style/, icon: FileCode },
    { pattern: /theme/, icon: Zap },
    { pattern: /model/, icon: Database },
    { pattern: /schema/, icon: Database },
    { pattern: /migration/, icon: Database },
    { pattern: /script/, icon: Terminal },
    { pattern: /tool/, icon: Wrench },
    { pattern: /plugin/, icon: Zap },
    { pattern: /extension/, icon: Zap }
  ]

  for (const { pattern, icon } of patternMatches) {
    if (pattern.test(titleLower)) {
      return icon
    }
  }

  // File extension matches
  const extension = titleLower.split('.').pop()
  const extensionMap = {
    // Code files
    'js': FileCode,
    'jsx': FileCode,
    'ts': FileCode,
    'tsx': FileCode,
    'py': FileCode,
    'java': FileCode,
    'cpp': FileCode,
    'c': FileCode,
    'cs': FileCode,
    'go': FileCode,
    'rs': FileCode,
    'php': FileCode,
    'rb': FileCode,
    'swift': FileCode,
    'kt': FileCode,
    'scala': FileCode,
    'sh': Terminal,
    'bash': Terminal,
    'zsh': Terminal,
    'fish': Terminal,
    'ps1': Terminal,
    'bat': Terminal,
    'cmd': Terminal,

    // Web files
    'html': FileCode,
    'htm': FileCode,
    'css': FileCode,
    'scss': FileCode,
    'sass': FileCode,
    'less': FileCode,
    'styl': FileCode,

    // Data files
    'json': FileJson,
    'xml': FileJson,
    'yaml': FileJson,
    'yml': FileJson,
    'toml': FileJson,
    'ini': FileJson,
    'csv': FileJson,

    // Markdown
    'md': Hash,
    'markdown': Hash,
    'mdx': Hash,

    // Images
    'png': ImageIcon,
    'jpg': ImageIcon,
    'jpeg': ImageIcon,
    'gif': ImageIcon,
    'svg': ImageIcon,
    'webp': ImageIcon,
    'ico': ImageIcon,
    'bmp': ImageIcon,
    'tiff': ImageIcon,

    // Documents
    'pdf': FileText,
    'doc': FileText,
    'docx': FileText,
    'txt': FileText,
    'rtf': FileText,

    // Archives
    'zip': Package,
    'tar': Package,
    'gz': Package,
    'rar': Package,
    '7z': Package,

    // Database
    'sql': Database,
    'db': Database,
    'sqlite': Database,
    'mdb': Database,

    // Config files
    'conf': Cog,
    'config': Cog,
    'cfg': Cog,
    'properties': Cog,

    // Other
    'log': FileText,
    'lock': Lock,
    'key': Key,
    'pem': Key,
    'cert': Shield,
    'crt': Shield
  }

  if (extension && extensionMap[extension]) {
    return extensionMap[extension]
  }

  // Language-based fallback
  const languageMap = {
    'javascript': FileCode,
    'js': FileCode,
    'jsx': FileCode,
    'typescript': FileCode,
    'ts': FileCode,
    'tsx': FileCode,
    'python': FileCode,
    'py': FileCode,
    'html': FileCode,
    'css': FileCode,
    'json': FileJson,
    'markdown': Hash,
    'md': Hash
  }

  if (languageMap[lang]) {
    return languageMap[lang]
  }

  // Default fallback
  return FileText
}

/**
 * Get icon component for a snippet
 * @param {Object} snippet - The snippet object with title and language
 * @param {number} size - Icon size (default: 14)
 * @param {string} className - CSS class name (default: 'item-icon')
 * @returns {React.Component} Icon component
 */
export const getSnippetIcon = (snippet, size = 14, className = 'item-icon') => {
  const Icon = getFileIcon(snippet.title, snippet.language)
  return <Icon size={size} className={className} />
}

export default getFileIcon

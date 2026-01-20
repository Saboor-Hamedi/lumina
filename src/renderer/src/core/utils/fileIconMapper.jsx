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
  FolderOpen,
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
  Box,
  Heart,
  Users,
  ShoppingBag,
  Brain,
  Network,
  BarChart3,
  Github,
  Twitter,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  MessageCircle,
  Send,
  Share2,
  Sparkles,
  Layers
} from 'lucide-react'

/**
 * File Icon Mapper
 * Maps file names, patterns, and extensions to appropriate Lucide React icons
 * Used for displaying contextual icons in the sidebar file explorer
 */

const getFileIcon = (title, language) => {
  const titleLower = (title || '').toLowerCase().trim()
  const lang = (language || 'markdown').toLowerCase()

  // Strip .md extension for base name matching (since most snippets are .md)
  const baseName = titleLower.endsWith('.md')
    ? titleLower.slice(0, -3).trim()
    : titleLower

  // Exact filename matches (highest priority) - check full filename first
  const exactMatches = {
    // Settings & Config
    'settings': Settings,
    'setting': Settings,
    'settings.md': Settings,
    'setting.md': Settings,
    'config': Cog,
    'configuration': Cog,
    'config.md': Cog,
    'configuration.md': Cog,
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
    'src.md': FolderCode,
    'lib': FolderCode,
    'libs': FolderCode,
    'lib.md': FolderCode,
    'components': FolderCode,
    'components.md': FolderCode,
    'utils': FolderCode,
    'utils.md': FolderCode,
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

    // Literature & Academic
    'literature review': Book,
    'literature-review': Book,
    'literature': Book,
    'literature.md': Book,
    'review': Book,
    'review.md': Book,
    'thesis': Book,
    'thesis.md': Book,
    'journals': Book,
    'journal': Book,
    'journals.md': Book,
    'journal.md': Book,
    'daily': FileText,
    'daily.md': FileText,

    // Personal & Love
    'saboor': Heart,
    'saboor.md': Heart,
    'note': Heart,
    'note.md': Heart,
    'node': Heart,
    'node.md': Heart,
    'shopping': ShoppingBag,
    'shopping.md': ShoppingBag,

    // Family & Friends
    'family': Users,
    'family.md': Users,
    'friends': Users,
    'friends.md': Users,

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

  // Check exact matches first (full filename)
  if (exactMatches[titleLower]) {
    const Icon = exactMatches[titleLower]
    return Icon
  }

  // Check base name (without .md extension) for exact matches
  if (baseName !== titleLower && exactMatches[baseName]) {
    const Icon = exactMatches[baseName]
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
    { pattern: /^note/, icon: Heart },
    { pattern: /^readme/, icon: Book },
    { pattern: /literature/, icon: Book },
    { pattern: /review/, icon: Book },
    { pattern: /thesis/, icon: Book },
    { pattern: /journal/, icon: Book },
    { pattern: /daily/, icon: FileText },
    { pattern: /saboor/, icon: Heart },
    { pattern: /shopping/, icon: ShoppingBag },
    { pattern: /family/, icon: Users },
    { pattern: /friend/, icon: Users },
    { pattern: /^ai$|artificial.?intelligence|machine.?learning|^ml$|deep.?learning/, icon: Brain },
    { pattern: /^gnn$|graph.?neural|neural.?network|neural/, icon: Network },
    { pattern: /^pandas$|data.?science|datascience/, icon: BarChart3 },
    { pattern: /^xia$/, icon: Heart },
    { pattern: /^github$|^gh$/, icon: Github },
    { pattern: /^twitter$|^x$/, icon: Twitter },
    { pattern: /^facebook$|^fb$/, icon: Facebook },
    { pattern: /^instagram$|^ig$/, icon: Instagram },
    { pattern: /^linkedin$|linked.?in/, icon: Linkedin },
    { pattern: /^youtube$|^yt$/, icon: Youtube },
    { pattern: /social.?media|^social$/, icon: Share2 },
    { pattern: /^lumina$/, icon: Sparkles },
    { pattern: /^snippet/, icon: Layers },
    { pattern: /^dev$|^development$/, icon: Code },
    { pattern: /^html$|^htm$/, icon: FileCode },
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

  // Check patterns on full filename first
  for (const { pattern, icon } of patternMatches) {
    if (pattern.test(titleLower)) {
      return icon
    }
  }

  // Check patterns on base name (without .md)
  if (baseName !== titleLower) {
    for (const { pattern, icon } of patternMatches) {
      if (pattern.test(baseName)) {
        return icon
      }
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
 * Get icon color based on icon type
 */
const getIconColor = (iconType, title) => {
  const titleLower = (title || '').toLowerCase()

  // Love/Personal icons
  if (['saboor', 'note', 'node', 'xia'].some(name => titleLower.includes(name))) {
    return 'var(--icon-love, var(--text-accent))'
  }

  // AI & ML icons
  if (['ai', 'artificial intelligence', 'machine learning', 'ml', 'deep learning', 'neural'].some(name => titleLower.includes(name))) {
    return 'var(--icon-primary, var(--text-accent))'
  }

  // GNN & Graph Neural Networks
  if (['gnn', 'graph neural', 'neural network'].some(name => titleLower.includes(name))) {
    return 'var(--icon-secondary, #10b981)'
  }

  // Data Science & Pandas
  if (['pandas', 'data science', 'datascience'].some(name => titleLower.includes(name))) {
    return 'var(--icon-tertiary, #f59e0b)'
  }

  // Social Media icons
  if (['github', 'gh'].some(name => titleLower.includes(name))) {
    return 'var(--icon-primary, var(--text-accent))'
  }
  if (['twitter', 'x'].some(name => titleLower.includes(name))) {
    return 'var(--icon-primary, #1da1f2)'
  }
  if (['facebook', 'fb'].some(name => titleLower.includes(name))) {
    return 'var(--icon-primary, #1877f2)'
  }
  if (['instagram', 'ig'].some(name => titleLower.includes(name))) {
    return 'var(--icon-love, #e4405f)'
  }
  if (['linkedin', 'linked-in'].some(name => titleLower.includes(name))) {
    return 'var(--icon-primary, #0077b5)'
  }
  if (['youtube', 'yt'].some(name => titleLower.includes(name))) {
    return 'var(--icon-danger, #ff0000)'
  }
  if (['social', 'social media'].some(name => titleLower.includes(name))) {
    return 'var(--icon-primary, var(--text-accent))'
  }

  // Settings/Config icons
  if (['settings', 'config', 'setting'].some(name => titleLower.includes(name))) {
    return 'var(--icon-primary, var(--text-accent))'
  }

  // Code/Development icons
  if (['src', 'lib', 'components', 'utils', 'code'].some(name => titleLower.includes(name))) {
    return 'var(--icon-secondary, #10b981)'
  }

  // Documentation icons
  if (['readme', 'docs', 'literature', 'thesis', 'journal'].some(name => titleLower.includes(name))) {
    return 'var(--icon-tertiary, #f59e0b)'
  }

  // Default accent color
  return 'var(--icon-primary, var(--text-accent))'
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
  const iconColor = getIconColor(Icon, snippet.title)
  return <Icon size={size} className={className} style={{ color: iconColor }} />
}

export default getFileIcon

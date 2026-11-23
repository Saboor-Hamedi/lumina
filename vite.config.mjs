import fs from 'fs'
import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

function tsDevServerPlugin() {
  const isMigratedModule = (str) => {
    if (!str || typeof str !== 'string') return false
    if (str.includes('html-proxy') || str.includes('node_modules')) return false
    return (
      str.includes('features/Navigation') ||
      str.includes('features\\Navigation') ||
      str.includes('features/Explorer') ||
      str.includes('features\\Explorer') ||
      str.includes('features/media') ||
      str.includes('features\\media') ||
      str.includes('features/AI') ||
      str.includes('features\\AI') ||
      str.includes('features/profile') ||
      str.includes('features\\profile') ||
      str.includes('features/preview') ||
      str.includes('features\\preview') ||
      str.includes('features/commandpalette') ||
      str.includes('features\\commandpalette') ||
      str.includes('features/Layout') ||
      str.includes('features\\Layout') ||
      str.includes('features/Editor') ||
      str.includes('features\\Editor') ||
      str.includes('features/theme') ||
      str.includes('features\\theme') ||
      str.includes('Welcome') ||
      str.includes('useFontSettings')
    )
  }

  return {
    name: 'ts-dev-server-plugin',
    apply: 'serve',
    enforce: 'pre',
    resolveId(source, importer) {
      if (isMigratedModule(source) && importer) {
        const dir = resolve(importer, '..')
        if (source.endsWith('.jsx')) {
          const targetJsx = resolve(dir, source)
          const targetTsx = resolve(dir, source.replace(/\.jsx$/, '.tsx'))
          if (!fs.existsSync(targetJsx) && fs.existsSync(targetTsx)) {
            return this.resolve(source.replace(/\.jsx$/, '.tsx'), importer, { skipSelf: true })
          }
        }
        if (source.endsWith('.js')) {
          const targetJs = resolve(dir, source)
          const targetTs = resolve(dir, source.replace(/\.js$/, '.ts'))
          if (!fs.existsSync(targetJs) && fs.existsSync(targetTs)) {
            return this.resolve(source.replace(/\.js$/, '.ts'), importer, { skipSelf: true })
          }
        }
      }
      return null
    }
  }
}

export default defineConfig(({ mode }) => ({
  root: resolve('src/renderer'),
  base: './',
  worker: {
    format: 'es'
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.mjs', '.js', '.jsx', '.json'],
    alias: {
      '@renderer': resolve('src/renderer/src')
    }
  },
  plugins: [
    tsDevServerPlugin(),
    react(),
    mode === 'analyze' &&
      visualizer({
        filename: 'stats-renderer.html',
        open: true
      })
  ],
  css: {
    postcss: resolve('postcss.config.js')
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      overlay: false
    }
  },
  build: {
    outDir: resolve('out/renderer'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('node_modules/mermaid') || id.includes('node_modules/@mermaid-js') || id.includes('node_modules/cytoscape') || id.includes('node_modules/dagre') || id.includes('node_modules/elkjs')) {
            return 'vendor-mermaid'
          }
          if (id.includes('node_modules/react-force-graph') || id.includes('node_modules/three') || id.includes('node_modules/force-graph') || id.includes('node_modules/d3-')) {
            return 'vendor-graph'
          }
          if (id.includes('node_modules/@codemirror') || id.includes('node_modules/codemirror') || id.includes('node_modules/@lezer') || id.includes('node_modules/@atomic-editor')) {
            return 'vendor-codemirror'
          }
          if (id.includes('node_modules/katex')) {
            return 'vendor-katex'
          }
          if (id.includes('node_modules/highlight.js')) {
            return 'vendor-highlight'
          }
          if (id.includes('node_modules/@xterm')) {
            return 'vendor-xterm'
          }
          if (id.includes('node_modules/@xenova/transformers') || id.includes('node_modules/onnxruntime')) {
            return 'vendor-ai-wasm'
          }
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/react-router')) {
            return 'vendor-react'
          }
          if (id.includes('node_modules/marked') || id.includes('node_modules/react-markdown') || id.includes('node_modules/remark') || id.includes('node_modules/unified') || id.includes('node_modules/micromark')) {
            return 'vendor-markdown'
          }
          if (id.includes('node_modules/@dnd-kit')) {
            return 'vendor-dnd'
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons'
          }
          return undefined
        }
      }
    }
  }
}))

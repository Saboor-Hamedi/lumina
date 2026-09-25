/* Force Restart Timestamp: 19 */
import fs from 'fs'
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

/**
 * TypeScript Dev Server Fallback Plugin
 * 
 * Safely handles dev-server fallback resolution from .jsx -> .tsx and .js -> .ts
 * only for migrated renderer feature directories (Navigation, Explorer, AI, and useFontSettings).
 */
function tsDevServerPlugin() {
  const isMigratedModule = (str) => {
    if (!str || typeof str !== 'string') return false
    if (str.includes('html-proxy') || str.includes('node_modules')) return false
    return (
      str.includes('features/Navigation') ||
      str.includes('features\\Navigation') ||
      str.includes('features/Explorer') ||
      str.includes('features\\Explorer') ||
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
      str.includes('Welcome') ||
      str.includes('useFontSettings')
    )
  }

  return {
    name: 'ts-dev-server-plugin',
    apply: 'serve',
    enforce: 'pre',
    resolveId(source) {
      if (isMigratedModule(source)) {
        if (source.endsWith('.jsx')) {
          return this.resolve(source.replace(/\.jsx$/, '.tsx'), undefined, { skipSelf: true })
        }
        if (source.endsWith('.js')) {
          return this.resolve(source.replace(/\.js$/, '.ts'), undefined, { skipSelf: true })
        }
      }
      return null
    },
    load(id) {
      const cleanId = id.split('?')[0]
      if (isMigratedModule(cleanId)) {
        if (cleanId.endsWith('.jsx')) {
          const tsxId = cleanId.replace(/\.jsx$/, '.tsx')
          if (fs.existsSync(tsxId)) {
            return fs.readFileSync(tsxId, 'utf-8')
          }
        }
        if (cleanId.endsWith('.js')) {
          const tsId = cleanId.replace(/\.js$/, '.ts')
          if (fs.existsSync(tsId)) {
            return fs.readFileSync(tsId, 'utf-8')
          }
        }
      }
      return null
    },
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url && isMigratedModule(req.url)) {
          if (/\.jsx(\?.*)?$/.test(req.url)) {
            req.url = req.url.replace(/\.jsx(\?.*)?$/, (_m, q) => `.tsx${q || ''}`)
          } else if (/\.js(\?.*)?$/.test(req.url)) {
            req.url = req.url.replace(/\.js(\?.*)?$/, (_m, q) => `.ts${q || ''}`)
          }
        }
        next()
      })
    }
  }
}

export default defineConfig(({ mode }) => ({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        external: ['electron'],
        input: {
          index: resolve('src/main/index.js'),
          'indexer-worker': resolve('src/main/indexer-worker.js')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
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
      postcss: './postcss.config.js'
    },
    server: {
      hmr: {
        overlay: false
      }
    }
  }
}))

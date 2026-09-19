/* Force Restart Timestamp: 15 */
import fs from 'fs'
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

function aiTsDevServerPlugin() {
  return {
    name: 'ai-ts-dev-server-plugin',
    enforce: 'pre',
    resolveId(source, importer) {
      if (source.includes('features/AI') || (importer && importer.includes('features/AI'))) {
        if (source.endsWith('.jsx')) {
          return this.resolve(source.replace(/\.jsx$/, '.tsx'), importer, { skipSelf: true })
        }
        if (source.endsWith('.js')) {
          return this.resolve(source.replace(/\.js$/, '.ts'), importer, { skipSelf: true })
        }
      }
      return null
    },
    load(id) {
      const cleanId = id.split('?')[0]
      if (cleanId.includes('features/AI') || cleanId.includes('features\\AI')) {
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
        if (req.url && (req.url.includes('/features/AI/') || req.url.includes('features/AI'))) {
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
      aiTsDevServerPlugin(),
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
    },
    optimizeDeps: {
      include: ['react-window']
    }
  }
}))

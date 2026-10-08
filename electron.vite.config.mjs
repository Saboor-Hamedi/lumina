/* Force Restart Timestamp: 24 */
import fs from 'fs'
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

/**
 * TypeScript Dev Server Fallback Plugin
 * 
 * Safely handles dev-server fallback resolution from .jsx -> .tsx and .js -> .ts
 * only when the target TypeScript file exists and the JavaScript file does not.
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
    },
    load(id) {
      const cleanId = id.split('?')[0]
      if (isMigratedModule(cleanId)) {
        if (cleanId.endsWith('.jsx') && !fs.existsSync(cleanId)) {
          const tsxId = cleanId.replace(/\.jsx$/, '.tsx')
          if (fs.existsSync(tsxId)) {
            return fs.readFileSync(tsxId, 'utf-8')
          }
        }
        if (cleanId.endsWith('.js') && !fs.existsSync(cleanId)) {
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
          const pathname = req.url.split('?')[0]
          const rootDir = server.config.root || resolve(process.cwd(), 'src/renderer')
          const cleanPath = pathname.startsWith('/') ? pathname.slice(1) : pathname
          const diskPath = resolve(rootDir, cleanPath)

          if (/\.jsx$/.test(pathname)) {
            const diskTsx = diskPath.replace(/\.jsx$/, '.tsx')
            if (!fs.existsSync(diskPath) && fs.existsSync(diskTsx)) {
              req.url = req.url.replace(/\.jsx(\?.*)?$/, (_m, q) => `.tsx${q || ''}`)
            }
          } else if (/\.js$/.test(pathname)) {
            const diskTs = diskPath.replace(/\.js$/, '.ts')
            if (!fs.existsSync(diskPath) && fs.existsSync(diskTs)) {
              req.url = req.url.replace(/\.js(\?.*)?$/, (_m, q) => `.ts${q || ''}`)
            }
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
      postcss: './postcss.config.js'
    },
    server: {
      hmr: {
        overlay: false
      }
    }
  }
}))

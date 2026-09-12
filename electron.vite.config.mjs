/* Force Restart Timestamp: 2 */
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

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
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [
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

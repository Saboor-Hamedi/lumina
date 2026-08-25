// electron.vite.config.mjs
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
var electron_vite_config_default = defineConfig(({ mode }) => ({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        external: ['electron', 'better-sqlite3'],
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
    optimizeDeps: {
      include: ['react-window']
    }
  }
}))
export { electron_vite_config_default as default }

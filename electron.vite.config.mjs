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
        external: ['electron', 'better-sqlite3']
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
      mode === 'analyze' && visualizer({
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

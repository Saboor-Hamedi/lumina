import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

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

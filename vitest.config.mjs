import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: [
      '**/*.{test,spec}.{js,jsx}',
      'src/**/*.test.{js,jsx}',
      'src/main/**/*.test.js',
      'src/renderer/**/*.test.{js,jsx}'
    ],
    exclude: ['node_modules', 'out', 'build', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.config.{js,mjs}',
        '**/index.{js,jsx}',
        '**/*.d.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src')
    }
  }
})

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    testTimeout: 20000,
    setupFiles: ['./src/test/setup.js'],
    include: [
      '**/*.{test,spec}.{js,jsx,ts,tsx}',
      'src/**/*.test.{js,jsx,ts,tsx}',
      'src/main/**/*.test.{js,ts}',
      'src/renderer/**/*.test.{js,jsx,ts,tsx}'
    ],
    exclude: ['node_modules', 'out', 'build', 'dist', 'test/e2e'],
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

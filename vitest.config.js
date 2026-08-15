import { resolve } from 'path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'renderer',
          environment: 'jsdom',
          include: ['test/renderer/**/*.test.{js,jsx}']
        },
        resolve: {
          alias: {
            '@renderer': resolve('src/renderer/src')
          }
        },
        plugins: [react()]
      },
      {
        test: {
          name: 'main',
          environment: 'node',
          include: ['test/main/**/*.test.js']
        }
      }
    ]
  }
})

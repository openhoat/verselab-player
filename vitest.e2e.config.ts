import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    watch: false,
    setupFiles: [],
  },
  ssr: {
    noExternal: [],
    external: ['@midival/node', 'jzz']
  }
})

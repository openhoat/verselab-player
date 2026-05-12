import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    watch: false,
    setupFiles: [],
    env: {
      MIDI_SKIP_HARDWARE_TESTS: 'true'
    }
  },
  ssr: {
    noExternal: [],
    external: ['@midival/node', 'jzz']
  }
})

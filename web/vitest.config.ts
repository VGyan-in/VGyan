import { defineConfig } from 'vitest/config'

// Separate from vite.config.ts: Vitest bundles its own Vite major, so its config is not part of the app build.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    env: { VITE_API_BASE_URL: 'https://api.test' },
  },
})

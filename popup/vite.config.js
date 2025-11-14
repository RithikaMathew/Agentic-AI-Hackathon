import { defineConfig } from 'vite'

// Use a relative base so built assets are referenced relatively (works with Chrome extension file://)
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
  },
})

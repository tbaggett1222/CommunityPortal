import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Use relative asset URLs so static hosting under a subpath (e.g. GitHub Pages project site) works.
  base: './',
  plugins: [react()],
})

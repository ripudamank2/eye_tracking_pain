import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: './', // Relative base path mandatory for Electron file:/// loading
  plugins: [react(), tailwindcss()],
  build: {
    // Electron loads the built page over file://, where a `crossorigin` module
    // script fails the CORS check and silently never executes.
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: {
        // Studio app + the standalone desktop eye widget
        main: 'index.html',
        widget: 'widget.html',
      },
    },
  },
})

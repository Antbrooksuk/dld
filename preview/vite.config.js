import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react({ include: "**/*.{jsx,tsx}" })],
  server: {
    port: 5174,
    host: 'localhost',
    cors: true,
    open: false,
    hmr: {
      overlay: false
    },
    fs: {
      // Allow serving files from outside the root
      allow: ['..', '/Users/an.brooks/Projects']
    }
  },
  css: {
    postcss: {
      plugins: [
        require('@tailwindcss/postcss')
      ]
    }
  },
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx']
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'index.jsx'
    }
  }
})
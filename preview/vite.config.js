import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
      allow: ['..', '/Users/an.brooks/Projects/dld-skeleton']
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
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
    alias: {
      '@dld-skeleton': '/Users/an.brooks/Projects/dld-skeleton/src'
    }
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'index.jsx'
    }
  }
})
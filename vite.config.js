import process from 'node:process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Fewer, fuller chunks: React in one, every lucide icon in one, nothing under 24 KB on its own.
    rolldownOptions: {
      output: {
        codeSplitting: {
          minSize: 24_000,
          groups: [
            { name: 'react', test: /node_modules[/\\](react|react-dom|scheduler|react-router|react-router-dom)[/\\]/, priority: 20 },
            { name: 'icons', test: /node_modules[/\\]lucide-react[/\\]/, priority: 10, minSize: 0 },
          ],
        },
      },
    },
  },
  define: {
    // Which deploy an error came from (Vercel sets the commit; local builds say "local").
    'import.meta.env.VITE_RELEASE': JSON.stringify((process.env.VERCEL_GIT_COMMIT_SHA || 'local').slice(0, 7)),
  },
})

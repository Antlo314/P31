import process from 'node:process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Which deploy an error came from (Vercel sets the commit; local builds say "local").
    'import.meta.env.VITE_RELEASE': JSON.stringify((process.env.VERCEL_GIT_COMMIT_SHA || 'local').slice(0, 7)),
  },
})

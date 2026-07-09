import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      'hyrr.shared': resolve(__dirname, '../hyrr.shared/src/index.ts'),
      'hyrr.shared/src/styles/index.css': resolve(__dirname, '../hyrr.shared/src/styles/index.css'),
    },
  },
})

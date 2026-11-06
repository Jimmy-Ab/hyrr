import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { resolve } from "path"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5174, strictPort: true },
  preview: { port: 5174, strictPort: true },
  resolve: {
    alias: {
      "hyrr.shared": resolve(__dirname, "../hyrr.shared/src/index.ts"),
      "hyrr.shared/src/styles/index.css": resolve(__dirname, "../hyrr.shared/src/styles/index.css"),
    },
  },
})

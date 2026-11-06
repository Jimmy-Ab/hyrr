import { QueryClientProvider } from "@tanstack/react-query"
import { initSentry, installPointerEffects } from "hyrr.shared"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./App.tsx"
import "./index.css"
import { queryClient } from "./lib/api"

initSentry("admin")
installPointerEffects()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
)

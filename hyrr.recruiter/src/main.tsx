import { initSentry, installPointerEffects } from "hyrr.shared"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./App.tsx"
import "./index.css"

initSentry("recruiter")
installPointerEffects()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
)

import { initSentry, installPointerEffects } from "hyrr.shared"
import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./index.css"

initSentry("jobseeker")
installPointerEffects()

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

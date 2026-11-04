import { initSentry } from "hyrr.shared"
import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./index.css"

initSentry("jobseeker")

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

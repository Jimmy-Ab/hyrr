/// <reference types="vite/client" />

// Augment ImportMeta so that import.meta.env is typed
// in the hyrr.shared package (which has no direct Vite dependency).
interface ImportMetaEnv {
  readonly VITE_SOCKET_URL?: string
  // Add other VITE_ variables used across shared code here
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

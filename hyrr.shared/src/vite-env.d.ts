/// <reference types="vite/client" />

// Augment ImportMeta so that import.meta.env is typed
// in the hyrr.shared package (which has no direct Vite dependency).
interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_SOCKET_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

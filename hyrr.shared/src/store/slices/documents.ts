import type { StateCreator } from "zustand"
import { apiFetch } from "../../lib/api"
import { mapDocument, toError } from "../mappers"
import type { JobState } from "../types"

export type DocumentsSlice = Pick<
  JobState,
  | "documents"
  | "documentsLoading"
  | "fetchDocuments"
  | "uploadDocument"
  | "toggleDocumentActive"
  | "deleteDocument"
>

export const createDocumentsSlice: StateCreator<JobState, [], [], DocumentsSlice> = (set, get) => ({
  // ── Documents ──────────────────────────────────────────────────────────────

  documents: [],
  documentsLoading: false,

  fetchDocuments: async () => {
    set({ documentsLoading: true })
    try {
      const data = await apiFetch("/documents")
      set({ documents: (data || []).map(mapDocument) })
    } catch (e) {
      console.warn("Failed to load documents.", e)
    } finally {
      set({ documentsLoading: false })
    }
  },

  uploadDocument: async (meta) => {
    const created = await apiFetch("/documents", {
      method: "POST",
      body: JSON.stringify(meta),
    })
    const doc = mapDocument({ ...created, size: created?.size || meta.size })
    set((state) => ({
      documents: [
        doc,
        // Backend deactivates other resumes when a new resume is uploaded.
        ...state.documents.map((d) =>
          doc.type === "resume" && d.type === "resume" ? { ...d, active: false } : d
        ),
      ],
    }))
  },

  toggleDocumentActive: async (id) => {
    const previous = get().documents
    const target = previous.find((d) => d.id === id)
    if (!target) return
    const activating = !target.active
    set({
      documents: previous.map((d) => {
        if (d.id === id) return { ...d, active: activating }
        if (activating && target.type === "resume" && d.type === "resume") {
          return { ...d, active: false }
        }
        return d
      }),
    })
    try {
      await apiFetch(`/documents/${id}/toggle`, { method: "PUT" })
    } catch (err) {
      set({ documents: previous })
      throw toError(err, "Failed to update document")
    }
  },

  deleteDocument: async (id) => {
    const previous = get().documents
    set({ documents: previous.filter((d) => d.id !== id) })
    try {
      await apiFetch(`/documents/${id}`, { method: "DELETE" })
    } catch (err) {
      set({ documents: previous })
      throw toError(err, "Failed to delete document")
    }
  },
})

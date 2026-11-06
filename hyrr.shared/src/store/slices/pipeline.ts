import type { StateCreator } from "zustand"
import { apiFetch } from "../../lib/api"
import { APPLICATION_STATUS, applicationStatusLabel } from "../../lib/contracts"
import { mapCompanyProfile, mapLabel, mapNote, mapScreeningQuestion, toError } from "../mappers"
import type { Candidate, CandidateLabel, JobState } from "../types"

export type PipelineSlice = Pick<
  JobState,
  | "fetchJobQuestions"
  | "saveJobQuestions"
  | "fetchNotes"
  | "addNote"
  | "updateNote"
  | "deleteNote"
  | "labels"
  | "fetchLabels"
  | "createLabel"
  | "updateLabel"
  | "deleteLabel"
  | "setCandidateLabels"
  | "labelFilter"
  | "setLabelFilter"
  | "bulkUpdateCandidates"
  | "funnelAnalytics"
  | "fetchFunnelAnalytics"
  | "companyProfile"
  | "fetchCompanyProfile"
  | "updateCompanyProfile"
>

/** noteId → applicationId, so deleteNote can keep the candidate's notesCount in sync. */
const noteOwners = new Map<string, string>()

/** Friendly text for per-item bulk error codes (unknown codes pass through). */
const BULK_ERROR_TEXT: Record<string, string> = {
  APPLICATION_WITHDRAWN: "The candidate withdrew this application",
  CONVERSATION_CLOSED: "The conversation is closed",
  APPLICATION_NOT_FOUND: "Application not found",
  NOT_FOUND: "Application not found",
  FORBIDDEN: "You don't have access to this application",
  LABEL_NOT_FOUND: "Label not found",
}

const stripCount = ({ id, name, color }: CandidateLabel): CandidateLabel => ({ id, name, color })

export const createPipelineSlice: StateCreator<JobState, [], [], PipelineSlice> = (set, get) => {
  const patchCandidate = (id: string, fn: (c: Candidate) => Candidate) =>
    set((state) => ({ candidates: state.candidates.map((c) => (c.id === id ? fn(c) : c)) }))

  const bumpNotes = (applicationId: string, delta: number) =>
    patchCandidate(applicationId, (c) => ({ ...c, notesCount: Math.max(0, c.notesCount + delta) }))

  return {
    // ── Screening questions ────────────────────────────────────────────────
    fetchJobQuestions: async (jobId) => {
      const data = await apiFetch(`/jobs/${encodeURIComponent(jobId)}/questions`)
      return (Array.isArray(data) ? data : []).map(mapScreeningQuestion)
    },

    saveJobQuestions: async (jobId, questions) => {
      const data = await apiFetch(`/jobs/${encodeURIComponent(jobId)}/questions`, {
        method: "PUT",
        body: JSON.stringify({
          questions: questions.map((q) => ({
            ...(q.id ? { id: q.id } : {}),
            question: q.question.trim(),
            required: q.required,
          })),
        }),
      })
      return (Array.isArray(data) ? data : []).map(mapScreeningQuestion)
    },

    // ── Notes ──────────────────────────────────────────────────────────────
    fetchNotes: async (applicationId) => {
      const data = await apiFetch(`/applications/${encodeURIComponent(applicationId)}/notes`)
      const notes = (Array.isArray(data) ? data : []).map(mapNote)
      notes.forEach((n) => noteOwners.set(n.id, applicationId))
      // Self-heal the badge count with the authoritative list.
      patchCandidate(applicationId, (c) => ({ ...c, notesCount: notes.length }))
      return notes
    },

    addNote: async (applicationId, body) => {
      bumpNotes(applicationId, 1)
      try {
        const created = await apiFetch(`/applications/${encodeURIComponent(applicationId)}/notes`, {
          method: "POST",
          body: JSON.stringify({ body }),
        })
        const note = mapNote({ mine: true, ...created })
        noteOwners.set(note.id, applicationId)
        return note
      } catch (err) {
        bumpNotes(applicationId, -1)
        throw toError(err, "Failed to add note")
      }
    },

    updateNote: async (noteId, body) => {
      const updated = await apiFetch(`/applications/notes/${encodeURIComponent(noteId)}`, {
        method: "PATCH",
        body: JSON.stringify({ body }),
      })
      return mapNote({ mine: true, ...updated })
    },

    deleteNote: async (noteId) => {
      const applicationId = noteOwners.get(noteId)
      if (applicationId) bumpNotes(applicationId, -1)
      try {
        await apiFetch(`/applications/notes/${encodeURIComponent(noteId)}`, { method: "DELETE" })
        noteOwners.delete(noteId)
      } catch (err) {
        if (applicationId) bumpNotes(applicationId, 1)
        throw toError(err, "Failed to delete note")
      }
    },

    // ── Labels ─────────────────────────────────────────────────────────────
    labels: [],
    labelFilter: null,
    setLabelFilter: (labelId) => set({ labelFilter: labelId }),

    fetchLabels: async () => {
      const data = await apiFetch("/labels")
      const labels = (Array.isArray(data) ? data : []).map(mapLabel)
      set((state) => ({
        labels,
        labelFilter:
          state.labelFilter && !labels.some((l) => l.id === state.labelFilter)
            ? null
            : state.labelFilter,
      }))
    },

    createLabel: async (name, color) => {
      const created = mapLabel(
        await apiFetch("/labels", { method: "POST", body: JSON.stringify({ name, color }) })
      )
      const label = { ...created, count: created.count ?? 0 }
      set((state) => ({ labels: [...state.labels.filter((l) => l.id !== label.id), label] }))
      return label
    },

    updateLabel: async (id, patch) => {
      const prevLabels = get().labels
      const prevCandidates = get().candidates
      const apply = (l: CandidateLabel) => (l.id === id ? { ...l, ...patch } : l)
      set((state) => ({
        labels: state.labels.map(apply),
        candidates: state.candidates.map((c) =>
          c.labels.some((l) => l.id === id) ? { ...c, labels: c.labels.map(apply) } : c
        ),
      }))
      try {
        const updated = await apiFetch(`/labels/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        })
        if (updated?.id) {
          const mapped = mapLabel(updated)
          set((state) => ({
            labels: state.labels.map((l) =>
              l.id === id ? { ...mapped, count: mapped.count ?? l.count } : l
            ),
            candidates: state.candidates.map((c) =>
              c.labels.some((l) => l.id === id)
                ? {
                    ...c,
                    labels: c.labels.map((l) => (l.id === id ? stripCount(mapped) : l)),
                  }
                : c
            ),
          }))
        }
      } catch (err) {
        set({ labels: prevLabels, candidates: prevCandidates })
        throw toError(err, "Failed to update label")
      }
    },

    deleteLabel: async (id) => {
      const prevLabels = get().labels
      const prevCandidates = get().candidates
      const prevFilter = get().labelFilter
      set((state) => ({
        labels: state.labels.filter((l) => l.id !== id),
        candidates: state.candidates.map((c) =>
          c.labels.some((l) => l.id === id)
            ? { ...c, labels: c.labels.filter((l) => l.id !== id) }
            : c
        ),
        labelFilter: state.labelFilter === id ? null : state.labelFilter,
      }))
      try {
        await apiFetch(`/labels/${encodeURIComponent(id)}`, { method: "DELETE" })
      } catch (err) {
        set({ labels: prevLabels, candidates: prevCandidates, labelFilter: prevFilter })
        throw toError(err, "Failed to delete label")
      }
    },

    setCandidateLabels: async (applicationId, labelIds) => {
      const candidate = get().candidates.find((c) => c.id === applicationId)
      const previous = candidate?.labels
      const prevLabels = get().labels
      const known = new Map(get().labels.map((l) => [l.id, l]))
      if (candidate) {
        const next = labelIds.map((id) => known.get(id)).filter((l): l is CandidateLabel => !!l)
        patchCandidate(applicationId, (c) => ({ ...c, labels: next.map(stripCount) }))
        const before = new Set(previous?.map((l) => l.id))
        const after = new Set(labelIds)
        // Keep label usage counts roughly in sync.
        set((state) => ({
          labels: state.labels.map((l) => {
            if (typeof l.count !== "number") return l
            const delta = (after.has(l.id) ? 1 : 0) - (before.has(l.id) ? 1 : 0)
            return delta ? { ...l, count: Math.max(0, l.count + delta) } : l
          }),
        }))
      }
      try {
        const res = await apiFetch(`/applications/${encodeURIComponent(applicationId)}/labels`, {
          method: "PUT",
          body: JSON.stringify({ labelIds }),
        })
        if (Array.isArray(res?.labels)) {
          const labels = res.labels.map(mapLabel).map(stripCount)
          patchCandidate(applicationId, (c) => ({ ...c, labels }))
        }
      } catch (err) {
        if (candidate && previous) {
          patchCandidate(applicationId, (c) => ({ ...c, labels: previous }))
          set({ labels: prevLabels })
        }
        throw toError(err, "Failed to update labels")
      }
    },

    // ── Bulk ───────────────────────────────────────────────────────────────
    bulkUpdateCandidates: async (input) => {
      const res = await apiFetch("/applications/bulk", {
        method: "POST",
        body: JSON.stringify({
          applicationIds: input.applicationIds,
          action: input.action,
          ...(input.status ? { status: input.status } : {}),
          ...(input.labelId ? { labelId: input.labelId } : {}),
          ...(input.message ? { message: input.message } : {}),
        }),
      })
      const results = (Array.isArray(res?.results) ? res.results : []).map((r: any) => ({
        applicationId: String(r.applicationId),
        ok: !!r.ok,
        ...(r.error ? { error: BULK_ERROR_TEXT[String(r.error)] ?? String(r.error) } : {}),
      }))
      const okIds = new Set(results.filter((r: any) => r.ok).map((r: any) => r.applicationId))
      if (okIds.size === 0) return results

      const label = input.labelId ? get().labels.find((l) => l.id === input.labelId) : undefined
      let labelDelta = 0
      set((state) => ({
        candidates: state.candidates.map((c) => {
          if (!okIds.has(c.id)) return c
          switch (input.action) {
            case "MOVE":
              return input.status ? { ...c, status: applicationStatusLabel(input.status) } : c
            case "ARCHIVE":
              return { ...c, status: applicationStatusLabel(APPLICATION_STATUS.ARCHIVED) }
            case "ADD_LABEL":
              if (!label || c.labels.some((l) => l.id === label.id)) return c
              labelDelta++
              return { ...c, labels: [...c.labels, stripCount(label)] }
            case "REMOVE_LABEL":
              if (!c.labels.some((l) => l.id === input.labelId)) return c
              labelDelta--
              return { ...c, labels: c.labels.filter((l) => l.id !== input.labelId) }
            default:
              return c
          }
        }),
      }))
      if (labelDelta && input.labelId) {
        set((state) => ({
          labels: state.labels.map((l) =>
            l.id === input.labelId && typeof l.count === "number"
              ? { ...l, count: Math.max(0, l.count + labelDelta) }
              : l
          ),
        }))
      }
      return results
    },

    // ── Analytics ──────────────────────────────────────────────────────────
    funnelAnalytics: null,

    fetchFunnelAnalytics: async (jobId) => {
      const qs = jobId ? `?jobId=${encodeURIComponent(jobId)}` : ""
      const data = await apiFetch(`/jobs/analytics${qs}`)
      set({
        funnelAnalytics: data
          ? {
              ...data,
              funnel: Array.isArray(data.funnel) ? data.funnel : [],
              timeToHireDays: data.timeToHireDays ?? { median: null, average: null },
              timeInStageDays: data.timeInStageDays ?? {},
              bySource: { DIRECT: 0, GUEST: 0, RECRUITER_ADDED: 0, ...(data.bySource ?? {}) },
              perJob: Array.isArray(data.perJob) ? data.perJob : [],
              monthlyApplications: Array.isArray(data.monthlyApplications)
                ? data.monthlyApplications
                : [],
            }
          : null,
      })
    },

    // ── Company profile ────────────────────────────────────────────────────
    companyProfile: null,

    fetchCompanyProfile: async () => {
      const data = await apiFetch("/profile/company")
      set({ companyProfile: data ? mapCompanyProfile(data) : null })
    },

    updateCompanyProfile: async (patch) => {
      const previous = get().companyProfile
      const prevName = get().workspaceName
      if (previous) set({ companyProfile: { ...previous, ...patch } })
      if (patch.name) set({ workspaceName: patch.name })
      try {
        const updated = await apiFetch("/profile/company", {
          method: "PUT",
          body: JSON.stringify(patch),
        })
        if (updated && typeof updated === "object") {
          const mapped = mapCompanyProfile(updated)
          set({ companyProfile: mapped, ...(mapped.name ? { workspaceName: mapped.name } : {}) })
        }
      } catch (err) {
        set({ companyProfile: previous, workspaceName: prevName })
        throw toError(err, "Failed to update company profile")
      }
    },
  }
}

import type { StateCreator } from "zustand"
import type { JobState } from "../types"

export type UiSlice = Pick<
  JobState,
  | "activeView"
  | "setActiveView"
  | "careerSelectedJobId"
  | "workspaceName"
  | "isAddCandidateOpen"
  | "addCandidateColumn"
  | "setAddCandidateOpen"
  | "isAddJobOpen"
  | "setAddJobOpen"
  | "selectedCandidateId"
  | "setSelectedCandidateId"
  | "searchQuery"
  | "setSearchQuery"
  | "candidateActiveView"
  | "setCandidateActiveView"
>

export const createUiSlice: StateCreator<JobState, [], [], UiSlice> = (set) => ({
  // ── Recruiter workspace state ─────────────────────────────────────────────
  activeView: "Applications",
  setActiveView: (view) => set({ activeView: view, searchQuery: "" }),
  careerSelectedJobId: "",
  workspaceName: "",
  isAddCandidateOpen: false,
  addCandidateColumn: "Applied",
  isAddJobOpen: false,
  selectedCandidateId: null,
  setSelectedCandidateId: (id) => set({ selectedCandidateId: id }),
  candidateActiveView: "Dashboard",
  setCandidateActiveView: (view) => set({ candidateActiveView: view, searchQuery: "" }),
  searchQuery: "",

  setSearchQuery: (query) => set({ searchQuery: query }),

  setAddCandidateOpen: (open, col = "Applied") =>
    set({ isAddCandidateOpen: open, addCandidateColumn: col }),
  setAddJobOpen: (open) => set({ isAddJobOpen: open }),
})

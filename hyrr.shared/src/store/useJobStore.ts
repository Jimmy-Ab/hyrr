import { create } from "zustand"
import { createAiSlice } from "./slices/ai"
import { createApplicationsSlice } from "./slices/applications"
import { createAuthSlice } from "./slices/auth"
import { createBootstrapSlice } from "./slices/bootstrap"
import { createCalendarSlice } from "./slices/calendar"
import { createCandidatesSlice } from "./slices/candidates"
import { createDiscoverSlice } from "./slices/discover"
import { createDocumentsSlice } from "./slices/documents"
import { createJobsSlice } from "./slices/jobs"
import { createMessagesSlice } from "./slices/messages"
import { createNotificationsSlice } from "./slices/notifications"
import { createPipelineSlice } from "./slices/pipeline"
import { createSeekerToolsSlice } from "./slices/seekerTools"
import { createSettingsSlice } from "./slices/settings"
import { createTeamSlice } from "./slices/team"
import { createUiSlice } from "./slices/ui"
import type { JobState } from "./types"

// Composition root. Each domain lives in ./slices/<domain>.ts; shared module-level state
// (timers, sequence tokens, the initial-load promise) lives in ./session.ts.

export { formatDateTime, notificationConversationId, toIsoFromLocal } from "./mappers"
export * from "./types"

// ─── Store ────────────────────────────────────────────────────────────────────

export const useJobStore = create<JobState>()((...a) => ({
  ...createAuthSlice(...a),
  ...createBootstrapSlice(...a),
  ...createUiSlice(...a),
  ...createSettingsSlice(...a),
  ...createJobsSlice(...a),
  ...createCandidatesSlice(...a),
  ...createTeamSlice(...a),
  ...createNotificationsSlice(...a),
  ...createApplicationsSlice(...a),
  ...createDiscoverSlice(...a),
  ...createCalendarSlice(...a),
  ...createDocumentsSlice(...a),
  ...createMessagesSlice(...a),
  ...createAiSlice(...a),
  ...createSeekerToolsSlice(...a),
  ...createPipelineSlice(...a),
}))

import { ApplicationSource, ApplicationStatus } from "@prisma/client"

export const FUNNEL_STAGES = ["APPLIED", "IN_PROCESS", "INTERVIEWING", "OFFER"] as const
export type FunnelStage = (typeof FUNNEL_STAGES)[number]

const RANK: Partial<Record<ApplicationStatus, number>> = {
  APPLIED: 0,
  IN_PROCESS: 1,
  INTERVIEWING: 2,
  OFFER: 3,
}

const DAY_MS = 24 * 60 * 60 * 1000

export type FunnelApplication = {
  id: string
  jobId: string
  status: ApplicationStatus
  source: ApplicationSource
  appliedAt: Date
}

export type FunnelEvent = {
  applicationId: string
  toStatus: ApplicationStatus
  createdAt: Date
}

export type FunnelJob = { id: string; title: string }

export type FunnelAnalytics = {
  funnel: { stage: FunnelStage; reached: number; conversionFromPrevious: number }[]
  timeToHireDays: { median: number | null; average: number | null }
  timeInStageDays: Record<FunnelStage, number | null>
  bySource: Record<ApplicationSource, number>
  perJob: {
    jobId: string
    title: string
    applicants: number
    inProcess: number
    interviewing: number
    offers: number
  }[]
}

const round1 = (n: number) => Math.round(n * 10) / 10
const average = (xs: number[]) =>
  xs.length ? round1(xs.reduce((a, b) => a + b, 0) / xs.length) : null
function median(xs: number[]) {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return round1(s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2)
}

/**
 * Pure funnel maths over non-SAVED applications and their stage events.
 * - reached[stage]: applications that ever entered that stage or a later one (events + current
 *   status; every application counts as APPLIED).
 * - conversionFromPrevious: reached[stage] / reached[previous] (APPLIED: 1 when non-empty).
 * - timeToHireDays: first APPLIED (event, else appliedAt) → first OFFER event.
 * - timeInStageDays: average length of completed stays (event → next event) per stage.
 */
export function computeFunnelAnalytics(
  applications: FunnelApplication[],
  events: FunnelEvent[],
  jobs: FunnelJob[]
): FunnelAnalytics {
  const byApp = new Map<string, FunnelEvent[]>()
  for (const e of events) {
    const list = byApp.get(e.applicationId)
    if (list) list.push(e)
    else byApp.set(e.applicationId, [e])
  }

  const reached = [0, 0, 0, 0]
  const hireDays: number[] = []
  const stays: Record<FunnelStage, number[]> = {
    APPLIED: [],
    IN_PROCESS: [],
    INTERVIEWING: [],
    OFFER: [],
  }
  const bySource: Record<ApplicationSource, number> = { DIRECT: 0, GUEST: 0, RECRUITER_ADDED: 0 }
  const perJob = new Map<string, FunnelAnalytics["perJob"][number]>()
  for (const job of jobs)
    perJob.set(job.id, {
      jobId: job.id,
      title: job.title,
      applicants: 0,
      inProcess: 0,
      interviewing: 0,
      offers: 0,
    })

  for (const app of applications) {
    if (app.status === ApplicationStatus.SAVED) continue
    const appEvents = (byApp.get(app.id) || [])
      .filter((e) => e.toStatus !== ApplicationStatus.SAVED)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

    let maxRank = Math.max(0, RANK[app.status] ?? 0)
    for (const e of appEvents) maxRank = Math.max(maxRank, RANK[e.toStatus] ?? 0)
    for (let r = 0; r <= maxRank; r++) reached[r]++

    const start = appEvents.find((e) => e.toStatus === ApplicationStatus.APPLIED)?.createdAt
    const offer = appEvents.find((e) => e.toStatus === ApplicationStatus.OFFER)?.createdAt
    if (offer) {
      const from = (start ?? app.appliedAt).getTime()
      if (offer.getTime() >= from) hireDays.push((offer.getTime() - from) / DAY_MS)
    }
    for (let i = 0; i < appEvents.length - 1; i++) {
      const stage = appEvents[i].toStatus as FunnelStage
      if (!(stage in stays)) continue
      stays[stage].push(
        (appEvents[i + 1].createdAt.getTime() - appEvents[i].createdAt.getTime()) / DAY_MS
      )
    }

    bySource[app.source] = (bySource[app.source] ?? 0) + 1
    const job = perJob.get(app.jobId)
    if (job) {
      job.applicants++
      if (app.status === ApplicationStatus.IN_PROCESS) job.inProcess++
      if (app.status === ApplicationStatus.INTERVIEWING) job.interviewing++
      if (app.status === ApplicationStatus.OFFER) job.offers++
    }
  }

  return {
    funnel: FUNNEL_STAGES.map((stage, i) => ({
      stage,
      reached: reached[i],
      conversionFromPrevious:
        i === 0
          ? reached[0] > 0
            ? 1
            : 0
          : reached[i - 1] > 0
            ? Math.round((reached[i] / reached[i - 1]) * 1000) / 1000
            : 0,
    })),
    timeToHireDays: { median: median(hireDays), average: average(hireDays) },
    timeInStageDays: {
      APPLIED: average(stays.APPLIED),
      IN_PROCESS: average(stays.IN_PROCESS),
      INTERVIEWING: average(stays.INTERVIEWING),
      OFFER: average(stays.OFFER),
    },
    bySource,
    perJob: [...perJob.values()],
  }
}

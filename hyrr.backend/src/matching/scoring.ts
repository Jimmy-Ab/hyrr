import { EmploymentType } from "@prisma/client"

/** Job fields used by the rule-based matcher. */
export type ScorableJob = {
  title: string
  description?: string | null
  requirements?: string[] | null
  skills?: string[] | null
  location?: string | null
  remote?: boolean | null
  type?: EmploymentType | string | null
  categoryId?: string | null
}

/** Seeker profile fields used by the matcher and the profile-strength meter. */
export type ScorableProfile = {
  title?: string | null
  location?: string | null
  bio?: string | null
  skills?: string[] | null
  languages?: string[] | null
  preferredType?: string | null
  preferredLocations?: string[] | null
  yearsOfExperience?: string | null
  interests?: { id: string }[] | null
  experiences?: { role?: string | null }[] | null
  educations?: unknown[] | null
}

export type JobMatch = { score: number; reasons: string[] }

export const MATCH_WEIGHTS = {
  skills: 40,
  title: 20,
  location: 15,
  type: 10,
  category: 10,
  experience: 5,
} as const

const MAX_REASONS = 4

const STOPWORDS = new Set([
  "and",
  "or",
  "the",
  "of",
  "for",
  "in",
  "at",
  "a",
  "an",
  "to",
  "with",
  "m",
  "f",
  "d",
  "w",
])

/** Lower-cases and strips punctuation that never distinguishes skills ("Node.js" = "nodejs"). */
export function normalizeSkill(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.(?=js\b)/g, "")
    .replace(/[^a-z0-9+#]+/g, " ")
    .trim()
}

function tokens(value: string | null | undefined): string[] {
  return normalizeSkill(value || "")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
}

const includesText = (haystack: string, needle: string) =>
  !!needle && ` ${haystack} `.includes(` ${needle} `)

const TYPE_ALIASES: Record<string, EmploymentType> = {
  "full time": "FULL_TIME",
  "full-time": "FULL_TIME",
  full_time: "FULL_TIME",
  fulltime: "FULL_TIME",
  "part time": "PART_TIME",
  "part-time": "PART_TIME",
  part_time: "PART_TIME",
  parttime: "PART_TIME",
  contract: "CONTRACT",
  freelance: "CONTRACT",
  remote: "REMOTE",
}

/** "Full Time" / "FULL_TIME" / "full-time" → EmploymentType (null when unknown). */
export function toEmploymentType(value: string | null | undefined): EmploymentType | null {
  if (!value) return null
  const key = value.trim().toLowerCase()
  return TYPE_ALIASES[key] ?? null
}

const TYPE_LABELS: Record<EmploymentType, string> = {
  FULL_TIME: "full-time",
  PART_TIME: "part-time",
  CONTRACT: "contract",
  REMOTE: "remote",
}

function wantsRemote(profile: ScorableProfile): boolean {
  if (toEmploymentType(profile.preferredType) === "REMOTE") return true
  return (profile.preferredLocations || []).some((l) => l.trim().toLowerCase() === "remote")
}

function locationMatch(job: ScorableJob, profile: ScorableProfile): string | null {
  const jobLocation = (job.location || "").toLowerCase()
  if (!jobLocation.trim()) return null
  const places = [profile.location, ...(profile.preferredLocations || [])]
    .map((p) => (p || "").trim())
    .filter((p) => p && p.toLowerCase() !== "remote")
  for (const place of places) {
    const lower = place.toLowerCase()
    if (jobLocation.includes(lower) || lower.includes(jobLocation.trim())) return place
    // "Berlin, Germany" vs "Berlin": compare the city part
    const city = lower.split(",")[0].trim()
    if (city.length > 2 && jobLocation.includes(city)) return place
  }
  return null
}

function parseYears(value: string | null | undefined): number | null {
  const match = String(value || "").match(/\d+(\.\d+)?/)
  return match ? Number(match[0]) : null
}

const SENIOR = /\b(senior|sr|lead|principal|staff|head|director)\b/i
const JUNIOR = /\b(junior|jr|intern|internship|trainee|graduate|entry)\b/i

/**
 * Rule-based job ↔ profile match (pure; no I/O). Score 0-100 with weights ≈ skills 40, title 20,
 * location/remote 15, employment type 10, category interests 10, experience 5. Reasons are short,
 * human-readable and ordered by contribution (max 4).
 */
export function scoreJobForProfile(job: ScorableJob, profile: ScorableProfile): JobMatch {
  const parts: { points: number; reason: string | null }[] = []

  // ─── Skills (40) ──────────────────────────────────────────────
  const seekerSkills = (profile.skills || []).map((s) => s.trim()).filter(Boolean)
  const seekerSet = new Set(seekerSkills.map(normalizeSkill).filter(Boolean))
  const jobSkills = Array.from(
    new Map(
      (job.skills || [])
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => [normalizeSkill(s), s] as const)
    )
  ).filter(([key]) => key)
  if (seekerSet.size) {
    if (jobSkills.length) {
      const matched = jobSkills.filter(([key]) => seekerSet.has(key)).map(([, label]) => label)
      if (matched.length) {
        const ratio = matched.length / jobSkills.length
        parts.push({
          points: MATCH_WEIGHTS.skills * Math.min(1, ratio * 1.25),
          reason: `${matched.length} of ${jobSkills.length} skills match: ${matched.slice(0, 3).join(", ")}`,
        })
      }
    } else {
      // No structured skills on the job: look for the seeker's skills in its text.
      const text = normalizeSkill(
        [job.title, ...(job.requirements || []), job.description || ""].join(" ")
      )
      const found = seekerSkills.filter((s) => includesText(text, normalizeSkill(s)))
      if (found.length) {
        parts.push({
          points: MATCH_WEIGHTS.skills * Math.min(1, found.length / 3),
          reason: `Mentions your skills: ${found.slice(0, 3).join(", ")}`,
        })
      }
    }
  }

  // ─── Title (20) ───────────────────────────────────────────────
  const jobTitle = normalizeSkill(job.title || "")
  const titles = [profile.title, ...(profile.experiences || []).map((e) => e?.role)]
    .map((t) => (t || "").trim())
    .filter(Boolean)
  let titlePoints = 0
  let titleReason: string | null = null
  for (const [index, title] of titles.entries()) {
    const own = normalizeSkill(title)
    const jobTokens = tokens(job.title)
    const ownTokens = new Set(tokens(title))
    let ratio = 0
    if (own && (includesText(jobTitle, own) || includesText(own, jobTitle))) ratio = 1
    else if (jobTokens.length && ownTokens.size)
      ratio = jobTokens.filter((t) => ownTokens.has(t)).length / jobTokens.length
    // Past roles count a little less than the current headline.
    const points = MATCH_WEIGHTS.title * ratio * (index === 0 && profile.title ? 1 : 0.75)
    if (points > titlePoints) {
      titlePoints = points
      titleReason =
        index === 0 && profile.title
          ? `Fits your title (${title})`
          : `Similar to your experience as ${title}`
    }
  }
  if (titlePoints >= 5) parts.push({ points: titlePoints, reason: titleReason })
  else if (titlePoints > 0) parts.push({ points: titlePoints, reason: null })

  // ─── Location / remote (15) ───────────────────────────────────
  const place = locationMatch(job, profile)
  if (job.remote && wantsRemote(profile)) {
    parts.push({ points: MATCH_WEIGHTS.location, reason: "Remote, as you prefer" })
  } else if (place) {
    parts.push({ points: MATCH_WEIGHTS.location, reason: `Located in ${place}` })
  } else if (job.remote) {
    parts.push({ points: MATCH_WEIGHTS.location * 0.7, reason: "Remote friendly" })
  }

  // ─── Employment type (10) ─────────────────────────────────────
  const preferred = toEmploymentType(profile.preferredType)
  if (preferred && job.type) {
    const jobType = toEmploymentType(String(job.type)) ?? (job.type as EmploymentType)
    if (preferred === jobType || (preferred === "REMOTE" && job.remote)) {
      parts.push({
        points: MATCH_WEIGHTS.type,
        reason: `${TYPE_LABELS[jobType] ? capitalize(TYPE_LABELS[jobType]) : "Job type"} role, as you prefer`,
      })
    }
  }

  // ─── Category interests (10) ──────────────────────────────────
  if (job.categoryId && (profile.interests || []).some((i) => i.id === job.categoryId)) {
    parts.push({ points: MATCH_WEIGHTS.category, reason: "In a category you follow" })
  }

  // ─── Experience (5) ───────────────────────────────────────────
  const years = parseYears(profile.yearsOfExperience)
  if (years !== null) {
    const senior = SENIOR.test(job.title || "")
    const junior = JUNIOR.test(job.title || "")
    if (senior && years >= 5) {
      parts.push({ points: MATCH_WEIGHTS.experience, reason: `${years}+ years fits a senior role` })
    } else if (junior && years <= 3) {
      parts.push({ points: MATCH_WEIGHTS.experience, reason: null })
    } else if (!senior && !junior && years >= 1) {
      parts.push({ points: MATCH_WEIGHTS.experience, reason: null })
    }
  }

  const total = parts.reduce((sum, p) => sum + p.points, 0)
  const reasons = parts
    .filter((p) => p.reason)
    .sort((a, b) => b.points - a.points)
    .slice(0, MAX_REASONS)
    .map((p) => p.reason as string)
  return { score: Math.max(0, Math.min(100, Math.round(total))), reasons }
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** True when there is too little to match on (no skills and no title). */
export function isThinProfile(profile: ScorableProfile | null | undefined): boolean {
  if (!profile) return true
  const hasSkills = (profile.skills || []).some((s) => s.trim())
  return !hasSkills && !(profile.title || "").trim()
}

/** Completeness items: weight + label shown to the seeker when missing (weights sum to 100). */
const STRENGTH_ITEMS: { weight: number; label: string; done: (p: ScorableProfile) => boolean }[] = [
  { weight: 15, label: "Job title", done: (p) => !!p.title?.trim() },
  { weight: 10, label: "Location", done: (p) => !!p.location?.trim() },
  { weight: 10, label: "Short bio", done: (p) => !!p.bio?.trim() },
  {
    weight: 20,
    label: "At least 3 skills",
    done: (p) => (p.skills || []).filter((s) => s.trim()).length >= 3,
  },
  { weight: 15, label: "Work experience", done: (p) => (p.experiences || []).length > 0 },
  { weight: 10, label: "Education", done: (p) => (p.educations || []).length > 0 },
  { weight: 5, label: "Languages", done: (p) => (p.languages || []).some((l) => l.trim()) },
  {
    weight: 5,
    label: "Job categories you're interested in",
    done: (p) => (p.interests || []).length > 0,
  },
  { weight: 5, label: "Preferred job type", done: (p) => !!p.preferredType?.trim() },
  { weight: 5, label: "Years of experience", done: (p) => !!p.yearsOfExperience?.trim() },
]

/** Profile completeness 0-100 plus the labels of what is still missing (highest weight first). */
export function computeProfileStrength(profile: ScorableProfile | null | undefined): {
  profileStrength: number
  missing: string[]
} {
  const p = profile || {}
  let score = 0
  const missing: { weight: number; label: string }[] = []
  for (const item of STRENGTH_ITEMS) {
    if (item.done(p)) score += item.weight
    else missing.push(item)
  }
  return {
    profileStrength: Math.min(100, score),
    missing: missing.sort((a, b) => b.weight - a.weight).map((m) => m.label),
  }
}

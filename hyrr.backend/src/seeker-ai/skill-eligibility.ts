import { SkillLevel } from "@prisma/client"

/** Lower-case, single-spaced key used for eligibility caching and comparisons. */
export const skillKey = (raw: string) => raw.trim().replace(/\s+/g, " ").toLowerCase()

/**
 * Personal qualities and vague traits: never get a technical test (no AI call needed).
 * Matched on the whole key or as the key's only meaningful words.
 */
export const NON_TESTABLE_SKILLS = new Set([
  "hardworking",
  "hard working",
  "hard-working",
  "team player",
  "teamwork",
  "team work",
  "communication",
  "communication skills",
  "good communication",
  "leadership",
  "motivated",
  "self-motivated",
  "self motivated",
  "punctual",
  "punctuality",
  "honest",
  "honesty",
  "reliable",
  "reliability",
  "fast learner",
  "quick learner",
  "creative",
  "creativity",
  "passionate",
  "detail oriented",
  "detail-oriented",
  "attention to detail",
  "problem solving",
  "problem-solving",
  "critical thinking",
  "time management",
  "flexible",
  "adaptable",
  "adaptability",
  "positive attitude",
  "friendly",
  "dedicated",
  "multitasking",
  "work ethic",
  "interpersonal skills",
  "people skills",
])

export const NOT_TESTABLE_REASON =
  "This is a personal quality, not a skill a knowledge test can verify."

/** Experience → test level: years plus senior/lead/junior/intern in role titles. */
export function levelForProfile(
  profile: {
    yearsOfExperience?: string | null
    experiences?: { role?: string | null }[] | null
  } | null
): SkillLevel {
  const years = Number.parseInt(String(profile?.yearsOfExperience ?? "").replace(/\D+/g, ""), 10)
  const roles = (profile?.experiences ?? []).map((e) => (e.role ?? "").toLowerCase())
  const senior = roles.some((r) => /\b(senior|sr\.?|lead|principal|staff|head|architect)\b/.test(r))
  const junior = roles.some((r) => /\b(junior|jr\.?|intern|trainee|graduate|entry)\b/.test(r))
  if (senior || (Number.isFinite(years) && years >= 6)) return SkillLevel.ADVANCED
  if ((Number.isFinite(years) && years >= 2) || (roles.length > 0 && !junior))
    return SkillLevel.INTERMEDIATE
  return SkillLevel.BEGINNER
}

export const LEVEL_LABEL: Record<SkillLevel, string> = {
  BEGINNER: "beginner",
  INTERMEDIATE: "intermediate",
  ADVANCED: "advanced",
}

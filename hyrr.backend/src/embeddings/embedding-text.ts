import { createHash } from "crypto"
import { stripHtml } from "../ai/candidate-analysis"

/** Characters sent per embedding (well under the 8k-token input limit). */
export const MAX_EMBEDDING_CHARS = 8000

export type EmbeddableJob = {
  title: string
  skills?: string[] | null
  requirements?: string[] | null
  description?: string | null
}

export type EmbeddableProfile = {
  title?: string | null
  bio?: string | null
  skills?: string[] | null
  experiences?: { role?: string | null; company?: string | null; desc?: string | null }[] | null
  educations?: { degree?: string | null; school?: string | null }[] | null
}

const clean = (value: string | null | undefined) => (value || "").replace(/\s+/g, " ").trim()
const list = (values: (string | null | undefined)[] | null | undefined) =>
  (values || []).map(clean).filter(Boolean)

function compose(lines: [string, string][]): string {
  return lines
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n")
    .slice(0, MAX_EMBEDDING_CHARS)
}

/** Job text: title, skills, requirements, description (HTML stripped). */
export function jobEmbeddingText(job: EmbeddableJob): string {
  return compose([
    ["Title", clean(job.title)],
    ["Skills", list(job.skills).join(", ")],
    ["Requirements", list(job.requirements).join("; ")],
    ["Description", clean(stripHtml(job.description))],
  ])
}

/** Profile text: title, bio, skills, experiences, educations. */
export function profileEmbeddingText(profile: EmbeddableProfile): string {
  const experiences = (profile.experiences || [])
    .map((e) =>
      [
        clean(e.role),
        clean(e.company) && `at ${clean(e.company)}`,
        clean(e.desc) && `(${clean(e.desc)})`,
      ]
        .filter(Boolean)
        .join(" ")
    )
    .filter(Boolean)
  const educations = (profile.educations || [])
    .map((e) => [clean(e.degree), clean(e.school)].filter(Boolean).join(", "))
    .filter(Boolean)
  return compose([
    ["Title", clean(profile.title)],
    ["Bio", clean(profile.bio)],
    ["Skills", list(profile.skills).join(", ")],
    ["Experience", experiences.join("; ")],
    ["Education", educations.join("; ")],
  ])
}

export function contentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex")
}

/** Cosine similarity clamped to 0..1 (null when the vectors can't be compared). */
export function cosineSimilarity(a: ArrayLike<number>, b: ArrayLike<number>): number | null {
  if (!a.length || a.length !== b.length) return null
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (!normA || !normB) return null
  const cos = dot / (Math.sqrt(normA) * Math.sqrt(normB))
  return Math.max(0, Math.min(1, cos))
}

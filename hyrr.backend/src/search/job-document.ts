import { Prisma } from "@prisma/client"

export const JOBS_INDEX_SETTINGS = {
  // Rank order matters: Meili's `attribute` rule prefers matches in earlier attributes.
  searchableAttributes: [
    "title",
    "skills",
    "companyName",
    "categoryName",
    "location",
    "requirements",
    "description",
  ],
  filterableAttributes: ["type", "remote", "categorySlug", "featuredUntilTs", "companyId"],
  sortableAttributes: ["publishedAtTs", "featuredUntilTs"],
}

export const DESCRIPTION_MAX_CHARS = 5000

/** Prisma select for everything a search document needs. */
export const JOB_DOCUMENT_SELECT = {
  id: true,
  title: true,
  description: true,
  skills: true,
  requirements: true,
  location: true,
  remote: true,
  type: true,
  status: true,
  companyId: true,
  publishedAt: true,
  featuredUntil: true,
  company: { select: { name: true } },
  category: { select: { slug: true, name: true } },
} satisfies Prisma.JobSelect

export type JobDocumentSource = Prisma.JobGetPayload<{ select: typeof JOB_DOCUMENT_SELECT }>

export type JobDocument = {
  id: string
  title: string
  description: string
  skills: string[]
  requirements: string[]
  location: string
  remote: boolean
  type: string
  categorySlug: string | null
  categoryName: string | null
  companyName: string | null
  companyId: string
  publishedAtTs: number
  featuredUntilTs: number
}

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
}

/** Plain text from (possibly) HTML: tags become spaces, common entities decoded, whitespace collapsed. */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return ""
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(nbsp|amp|lt|gt|quot|apos|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/\s+/g, " ")
    .trim()
}

const epochSeconds = (d: Date | string | null | undefined) =>
  d ? Math.floor(new Date(d).getTime() / 1000) : 0

export function toJobDocument(job: JobDocumentSource): JobDocument {
  return {
    id: job.id,
    title: job.title,
    description: stripHtml(job.description).slice(0, DESCRIPTION_MAX_CHARS),
    skills: job.skills ?? [],
    requirements: job.requirements ?? [],
    location: job.location ?? "",
    remote: !!job.remote,
    type: job.type,
    categorySlug: job.category?.slug ?? null,
    categoryName: job.category?.name ?? null,
    companyName: job.company?.name ?? null,
    companyId: job.companyId,
    publishedAtTs: epochSeconds(job.publishedAt),
    featuredUntilTs: epochSeconds(job.featuredUntil),
  }
}

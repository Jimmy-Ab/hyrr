/** schema.org JobPosting (Google for Jobs) from the public job API payload. */

const EMPLOYMENT: Record<string, string> = {
  FULL_TIME: "FULL_TIME",
  PART_TIME: "PART_TIME",
  CONTRACT: "CONTRACTOR",
  REMOTE: "FULL_TIME",
}
const UNIT: Record<string, string> = { YEAR: "YEAR", MONTH: "MONTH", HOUR: "HOUR" }

export function jobPostingJsonLd(job: any, pageUrl: string) {
  const posted = job.publishedAt ?? job.createdAt
  const validThrough = posted
    ? new Date(new Date(posted).getTime() + 60 * 86_400_000).toISOString()
    : undefined
  const parts = String(job.location ?? "")
    .split(",")
    .map((p: string) => p.trim())
    .filter(Boolean)
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: job.title,
    description: job.description,
    datePosted: posted,
    validThrough,
    employmentType: EMPLOYMENT[job.type] ?? "OTHER",
    directApply: true,
    url: pageUrl,
    identifier: { "@type": "PropertyValue", name: "Hyrr", value: job.id },
    hiringOrganization: {
      "@type": "Organization",
      name: job.company?.name ?? "Company",
      ...(job.company?.website ? { sameAs: job.company.website } : {}),
      ...(job.company?.logo && /^https?:\/\//.test(job.company.logo)
        ? { logo: job.company.logo }
        : {}),
    },
  }
  if (job.remote) {
    ld.jobLocationType = "TELECOMMUTE"
    ld.applicantLocationRequirements = {
      "@type": "Country",
      name: parts[parts.length - 1] || "Worldwide",
    }
  } else if (parts.length) {
    ld.jobLocation = {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: parts[0],
        ...(parts.length > 1 ? { addressCountry: parts[parts.length - 1] } : {}),
      },
    }
  }
  if (job.salaryCurrency && (job.salaryMin || job.salaryMax))
    ld.baseSalary = {
      "@type": "MonetaryAmount",
      currency: job.salaryCurrency,
      value: {
        "@type": "QuantitativeValue",
        ...(job.salaryMin ? { minValue: job.salaryMin } : {}),
        ...(job.salaryMax ? { maxValue: job.salaryMax } : {}),
        unitText: UNIT[job.salaryPeriod] ?? "YEAR",
      },
    }
  return ld
}

const PENDING_KEY = "hyrr.pendingJob"
/** The public job page remembers which job to open in Discover after sign-in. */
export const rememberPendingJob = (id: string) => {
  try {
    sessionStorage.setItem(PENDING_KEY, id)
  } catch {
    // storage blocked: Discover simply opens normally
  }
}
export const takePendingJob = (peek = false) => {
  try {
    const id = sessionStorage.getItem(PENDING_KEY)
    if (id && !peek) sessionStorage.removeItem(PENDING_KEY)
    return id
  } catch {
    return null
  }
}

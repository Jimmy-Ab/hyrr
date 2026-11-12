import {
  BrandMark,
  Button,
  Card,
  RichTextRenderer,
  apiFetch,
  errorMessage,
  jobPostingJsonLd,
  rememberPendingJob,
  useJobStore,
} from "hyrr.shared"
import { Briefcase, Loader2, MapPin } from "lucide-react"
import { useEffect, useState } from "react"

/** Public job page (/jobs/:id): readable without an account, with Google for Jobs data. */
export function PublicJobPage({ id }: { id: string }) {
  const isAuthenticated = useJobStore((s) => s.isAuthenticated)
  const [job, setJob] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiFetch(`/jobs/public/${id}`, { skipAuth: true })
      .then(setJob)
      .catch((err) => setError(errorMessage(err, "This job is no longer available.")))
  }, [id])

  useEffect(() => {
    if (!job) return
    document.title = `${job.title} at ${job.company?.name ?? "Hyrr"} · Hyrr`
    const script = document.createElement("script")
    script.type = "application/ld+json"
    script.id = "job-posting-ld"
    script.text = JSON.stringify(jobPostingJsonLd(job, window.location.href)).replace(
      /</g,
      "\\u003c"
    )
    document.getElementById("job-posting-ld")?.remove()
    document.head.appendChild(script)
    return () => script.remove()
  }, [job])

  const apply = () => {
    rememberPendingJob(id)
    window.location.assign("/discover")
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="flex h-[64px] items-center justify-between border-b border-bg-border/70 px-4 md:px-6">
        <a href="/" aria-label="Hyrr home">
          <BrandMark app="Careers" />
        </a>
        {!isAuthenticated && (
          <a href="/" className="text-[13px] font-semibold text-primary hover:underline">
            Sign in
          </a>
        )}
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        {error ? (
          <Card className="p-8 text-center">
            <p className="text-[15px] font-semibold text-txt-heading">{error}</p>
            <a
              href="/discover"
              className="mt-3 inline-block text-[13px] font-semibold text-primary"
            >
              Browse open jobs
            </a>
          </Card>
        ) : !job ? (
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
        ) : (
          <Card className="p-6 sm:p-8">
            <p className="text-[13px] font-semibold text-txt-caption">{job.company?.name}</p>
            <h1 className="mt-1 text-[26px] font-extrabold tracking-tight text-txt-title">
              {job.title}
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-txt-body">
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" /> {job.remote ? "Remote" : job.location}
              </span>
              {job.salary && (
                <span className="flex items-center gap-1">
                  <Briefcase className="h-4 w-4" /> {job.salary}
                </span>
              )}
            </p>
            <Button onClick={apply} className="mt-5 h-11 px-6">
              Apply on Hyrr
            </Button>
            <div className="mt-6 text-[14px] leading-relaxed text-txt-body">
              <RichTextRenderer content={job.description} />
            </div>
            {job.requirements?.length > 0 && (
              <section className="mt-6">
                <h2 className="text-[15px] font-semibold text-txt-heading">Requirements</h2>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[14px] text-txt-body">
                  {job.requirements.map((r: string) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </section>
            )}
          </Card>
        )}
      </main>
    </div>
  )
}

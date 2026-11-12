import {
  apiFetch,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  errorMessage,
  isApiError,
  useJobStore,
  type CvSuggestions,
} from "hyrr.shared"
import { AlertTriangle, FileText, Loader2, Sparkles, Upload } from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"

interface ReviewSection {
  id: CvSection
  label: string
  body: ReactNode
}

export type CvSection =
  "title" | "bio" | "yearsOfExperience" | "skills" | "languages" | "experiences" | "educations"

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const ACCEPT = ".pdf,.doc,.docx"

function importErrorMessage(err: unknown): string {
  if (isApiError(err)) {
    if (err.errorCode === "AI_DISABLED" || err.status === 503) {
      return "CV import isn't available right now. You can still fill in your profile by hand."
    }
    if (err.errorCode === "CV_UNREADABLE" || err.status === 422) {
      return "We couldn't read any text from that file. Try a PDF or Word file with selectable text (not a scan)."
    }
    if (err.status === 429) {
      return "You've imported a lot of CVs in a short time. Please wait a minute and try again."
    }
  }
  return errorMessage(err, "Could not read your CV. Please try again.")
}

interface CvImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Receives only the sections the seeker kept checked. */
  onApply: (suggestions: CvSuggestions, sections: Set<CvSection>) => void
  /**
   * "linkedin": guided import of the PDF LinkedIn exports (Profile → More → Save to PDF). Same
   * upload + AI extraction as a CV; no scraping, no LinkedIn API, no OAuth.
   */
  variant?: "cv" | "linkedin"
}

export function CvImportDialog({
  open,
  onOpenChange,
  onApply,
  variant = "cv",
}: CvImportDialogProps) {
  const linkedin = variant === "linkedin"
  const documents = useJobStore((s) => s.documents)
  const importProfileFromCv = useJobStore((s) => s.importProfileFromCv)
  const resumes = documents.filter((d) => d.type === "resume")
  const fileRef = useRef<HTMLInputElement>(null)

  const [source, setSource] = useState<string>("") // document id, or "upload"
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<CvSuggestions | null>(null)
  const [selected, setSelected] = useState<Set<CvSection>>(() => new Set())

  useEffect(() => {
    if (!open) return
    const active = resumes.find((d) => d.active) ?? resumes[0]
    setSource(linkedin ? "upload" : (active?.id ?? "upload"))
    setFile(null)
    setError(null)
    setSuggestions(null)
    setBusy(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const pickFile = (f: File | undefined) => {
    if (!f) return
    const ext = f.name.split(".").pop()?.toLowerCase() ?? ""
    if (linkedin ? ext !== "pdf" : !["pdf", "doc", "docx"].includes(ext)) {
      setError(
        linkedin ? "Choose the PDF you saved from LinkedIn." : "Choose a PDF or Word document."
      )
      return
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      setError("That file is larger than 10 MB.")
      return
    }
    setError(null)
    setFile(f)
  }

  const runImport = async () => {
    setBusy(true)
    setError(null)
    try {
      let input: { documentId?: string; url?: string }
      if (source === "upload") {
        if (!file) {
          setError("Choose a file to upload.")
          return
        }
        const form = new FormData()
        form.append("file", file)
        const uploaded = await apiFetch("/uploads", { method: "POST", body: form })
        input = { url: uploaded.url }
      } else {
        input = { documentId: source }
      }
      const result = await importProfileFromCv(input)
      const available = new Set<CvSection>()
      if (result.title) available.add("title")
      if (result.bio) available.add("bio")
      if (result.yearsOfExperience) available.add("yearsOfExperience")
      if (result.skills.length) available.add("skills")
      if (result.languages.length) available.add("languages")
      if (result.experiences.length) available.add("experiences")
      if (result.educations.length) available.add("educations")
      if (available.size === 0) {
        setError("We read your CV but found nothing to suggest. Try another file.")
        return
      }
      setSuggestions(result)
      setSelected(available)
    } catch (err) {
      setError(importErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const toggle = (section: CvSection) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })

  const apply = () => {
    if (!suggestions) return
    onApply(suggestions, selected)
    onOpenChange(false)
  }

  const sections: ReviewSection[] = suggestions
    ? (
        [
          suggestions.title && {
            id: "title" as const,
            label: "Title",
            body: <p>{suggestions.title}</p>,
          },
          suggestions.bio && {
            id: "bio" as const,
            label: "Bio",
            body: <p className="line-clamp-4 whitespace-pre-line">{suggestions.bio}</p>,
          },
          suggestions.yearsOfExperience && {
            id: "yearsOfExperience" as const,
            label: "Years of experience",
            body: <p>{suggestions.yearsOfExperience}</p>,
          },
          suggestions.skills.length > 0 && {
            id: "skills" as const,
            label: `Skills (${suggestions.skills.length})`,
            body: <p>{suggestions.skills.join(", ")}</p>,
          },
          suggestions.languages.length > 0 && {
            id: "languages" as const,
            label: `Languages (${suggestions.languages.length})`,
            body: <p>{suggestions.languages.join(", ")}</p>,
          },
          suggestions.experiences.length > 0 && {
            id: "experiences" as const,
            label: `Work experience (${suggestions.experiences.length})`,
            body: (
              <ul className="space-y-1">
                {suggestions.experiences.map((e, i) => (
                  <li key={i}>
                    <span className="font-semibold text-txt-heading">{e.role}</span>
                    {e.company ? ` · ${e.company}` : ""}
                    {e.duration ? ` · ${e.duration}` : ""}
                  </li>
                ))}
              </ul>
            ),
          },
          suggestions.educations.length > 0 && {
            id: "educations" as const,
            label: `Education (${suggestions.educations.length})`,
            body: (
              <ul className="space-y-1">
                {suggestions.educations.map((e, i) => (
                  <li key={i}>
                    <span className="font-semibold text-txt-heading">{e.degree}</span>
                    {e.school ? ` · ${e.school}` : ""}
                    {e.duration ? ` · ${e.duration}` : ""}
                  </li>
                ))}
              </ul>
            ),
          },
        ] as (ReviewSection | false | "" | undefined)[]
      ).filter((x): x is ReviewSection => !!x)
    : []

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
            {suggestions
              ? "Review suggestions"
              : linkedin
                ? "Import your LinkedIn profile"
                : "Import from CV"}
          </DialogTitle>
          <DialogDescription>
            {suggestions
              ? "Choose what to copy into your profile. Nothing is saved until you press Save Profile."
              : linkedin
                ? "Save your LinkedIn profile as a PDF, upload it here, and review what we found."
                : "We'll read your CV and suggest profile details for you to review."}
          </DialogDescription>
        </DialogHeader>

        {!suggestions ? (
          <div className="mt-4 flex flex-col gap-3">
            {linkedin && (
              <ol
                aria-label="How to save your LinkedIn profile as a PDF"
                className="flex flex-col gap-2 rounded-2xl border border-bg-border bg-bg-secondary p-4 text-[13px] text-txt-body"
              >
                {[
                  "Open LinkedIn and sign in.",
                  "Go to your profile (Me → View profile).",
                  "Select More (or Resources) under your name.",
                  "Select Save to PDF. LinkedIn downloads the file.",
                ].map((step, i) => (
                  <li key={step} className="flex gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-light text-[11px] font-bold text-primary">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            )}
            <fieldset className={linkedin ? "hidden" : "flex flex-col gap-2"}>
              <legend className="mb-1 text-[13px] font-semibold text-txt-heading">Which CV?</legend>
              {resumes.map((d) => (
                <label
                  key={d.id}
                  className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer ${
                    source === d.id ? "border-primary bg-primary-light" : "border-bg-border"
                  }`}
                >
                  <input
                    type="radio"
                    name="cv-source"
                    value={d.id}
                    checked={source === d.id}
                    onChange={() => setSource(d.id)}
                    className="accent-primary"
                  />
                  <FileText className="h-4 w-4 shrink-0 text-txt-caption" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-txt-heading">
                    {d.name}
                  </span>
                  {d.active && <span className="text-[11px] text-txt-caption">active</span>}
                </label>
              ))}
              <label
                className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer ${
                  source === "upload" ? "border-primary bg-primary-light" : "border-bg-border"
                }`}
              >
                <input
                  type="radio"
                  name="cv-source"
                  value="upload"
                  checked={source === "upload"}
                  onChange={() => setSource("upload")}
                  className="accent-primary"
                />
                <Upload className="h-4 w-4 shrink-0 text-txt-caption" aria-hidden="true" />
                <span className="text-[13px] text-txt-heading">Upload a file</span>
              </label>
            </fieldset>
            {source === "upload" && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept={linkedin ? ".pdf" : ACCEPT}
                  className="sr-only"
                  aria-label={linkedin ? "LinkedIn PDF" : "CV file"}
                  onChange={(e) => {
                    pickFile(e.target.files?.[0])
                    e.target.value = ""
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                >
                  Choose file
                </Button>
                <span className="min-w-0 truncate text-[12.5px] text-txt-caption">
                  {file
                    ? file.name
                    : linkedin
                      ? "The LinkedIn PDF, up to 10 MB"
                      : "PDF or Word, up to 10 MB"}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            {sections.map((sec) => (
              <label
                key={sec.id}
                className="flex gap-3 rounded-xl border border-bg-border p-3 cursor-pointer hover:bg-bg-hover"
              >
                <input
                  type="checkbox"
                  checked={selected.has(sec.id)}
                  onChange={() => toggle(sec.id)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-txt-heading">
                    {sec.label}
                  </span>
                  <span className="mt-0.5 block text-[12.5px] text-txt-body">{sec.body}</span>
                </span>
              </label>
            ))}
            <p className="text-[12px] text-txt-caption">
              Title, bio and years replace what you have; skills, languages, experience and
              education are added to it.
            </p>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-3 flex items-start gap-2 text-[13px] text-sec-red">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          {suggestions ? (
            <Button size="sm" onClick={apply} disabled={selected.size === 0}>
              Apply to profile
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={runImport}
              disabled={busy || !source || (source === "upload" && !file)}
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              {busy
                ? linkedin
                  ? "Reading your LinkedIn PDF…"
                  : "Reading your CV…"
                : linkedin
                  ? "Read PDF"
                  : "Read CV"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

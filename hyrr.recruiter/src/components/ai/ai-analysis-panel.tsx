import { AI_RECOMMENDATION_LABEL, Badge, Button, useToast, type Candidate } from "hyrr.shared"
import {
  AlertCircle,
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  FileText,
  Loader2,
  RotateCw,
  Sparkles,
} from "lucide-react"
import { useState } from "react"
import { errorMessage } from "../../lib/recruiter"
import { useJobStore } from "../../store/useJobStore"
import { RECOMMENDATION_VARIANT, relativeTime } from "./ai-score"

function ScoreRing({ score }: { score: number }) {
  const radius = 30
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, score))
  const color =
    clamped >= 75 ? "text-sec-green" : clamped >= 50 ? "text-sec-orange" : "text-sec-red"
  return (
    <div
      className="relative w-[76px] h-[76px] shrink-0"
      role="img"
      aria-label={`AI match score ${clamped} out of 100`}
    >
      <svg viewBox="0 0 76 76" className="w-full h-full -rotate-90">
        <circle cx="38" cy="38" r={radius} strokeWidth="7" className="stroke-bg-border fill-none" />
        <circle
          cx="38"
          cy="38"
          r={radius}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          className={`fill-none stroke-current transition-[stroke-dashoffset] duration-700 ${color}`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[19px] font-extrabold text-txt-heading">
        {clamped}
      </span>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[11.5px] font-bold text-txt-caption uppercase tracking-wider mb-2">
      {children}
    </h4>
  )
}

function BulletList({ items, icon }: { items: string[]; icon: "check" | "warn" }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-[13px] text-txt-body leading-relaxed">
          {icon === "check" ? (
            <CheckCircle2 className="w-4 h-4 text-sec-green shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-sec-orange shrink-0 mt-0.5" />
          )}
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

/** AI tab of the candidate dialog: structured report, status states and (re-)run action. */
export function AiAnalysisPanel({ candidate }: { candidate: Candidate }) {
  const analyzeCandidate = useJobStore((s) => s.analyzeCandidate)
  const { toast } = useToast()
  const [starting, setStarting] = useState(false)

  const pending = candidate.aiStatus === "PENDING"
  const analysis = candidate.aiAnalysis
  const hasResult = candidate.aiScore != null

  const run = async () => {
    setStarting(true)
    try {
      await analyzeCandidate(candidate.id)
      toast("Analysis started", "The report updates automatically when it's ready.", "success")
    } catch (err) {
      toast("Could not start analysis", errorMessage(err), "error")
    } finally {
      setStarting(false)
    }
  }

  const runButton = (label: string) => (
    <Button
      type="button"
      size="sm"
      variant={hasResult ? "secondary" : "primary"}
      onClick={run}
      disabled={pending || starting}
      className="gap-1.5 cursor-pointer"
    >
      {pending || starting ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : hasResult ? (
        <RotateCw className="w-3.5 h-3.5" />
      ) : (
        <Sparkles className="w-3.5 h-3.5" />
      )}
      {label}
    </Button>
  )

  const statusBanner = pending ? (
    <div className="flex items-center gap-2 p-3 rounded-[14px] border border-primary-border/40 bg-primary-light/50 text-[12.5px] text-txt-heading font-medium">
      <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
      Analyzing… this usually takes a few seconds.
    </div>
  ) : candidate.aiStatus === "FAILED" ? (
    <div className="flex items-start gap-2 p-3 rounded-[14px] border border-sec-red/30 bg-sec-red/5 text-[12.5px] text-txt-heading">
      <AlertCircle className="w-4 h-4 text-sec-red shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold">The last analysis failed.</p>
        {candidate.aiError && (
          <p className="text-txt-caption mt-0.5 break-words">{candidate.aiError}</p>
        )}
      </div>
      {runButton("Retry")}
    </div>
  ) : null

  if (candidate.aiStatus === "DISABLED" && !hasResult) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-bg-primary flex items-center justify-center">
          <Sparkles className="w-7 h-7 text-txt-disabled" />
        </div>
        <div>
          <h4 className="text-[15px] font-bold text-txt-heading">AI analysis is not configured</h4>
          <p className="text-[12.5px] text-txt-caption mt-1 max-w-sm leading-relaxed">
            No AI provider key is set up on the server, so candidates can't be analyzed yet.
          </p>
        </div>
      </div>
    )
  }

  if (!hasResult) {
    return (
      <div className="space-y-4">
        {candidate.aiStatus === "FAILED" && statusBanner}
        <div className="flex flex-col items-center justify-center py-10 text-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary-light flex items-center justify-center">
            {pending ? (
              <Loader2 className="w-7 h-7 text-primary animate-spin" />
            ) : (
              <Sparkles className="w-7 h-7 text-primary" />
            )}
          </div>
          <div>
            <h4 className="text-[15px] font-bold text-txt-heading">
              {pending ? "Analyzing…" : "Not analyzed yet"}
            </h4>
            <p className="text-[12.5px] text-txt-caption mt-1 max-w-sm leading-relaxed">
              {pending
                ? "The AI is comparing this candidate's profile and CV with the job. The report appears here when it's ready."
                : "Run an AI fit analysis against the job's requirements, using the candidate's profile and CV."}
            </p>
          </div>
          {!pending && candidate.aiStatus !== "FAILED" && runButton("Analyze")}
        </div>
      </div>
    )
  }

  const rec = analysis?.recommendation
  const summary = analysis?.summary || candidate.aiSummary || ""

  return (
    <div className="space-y-5">
      {statusBanner}

      {/* Score + recommendation */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 bg-gradient-to-r from-bg-secondary to-bg-primary/30 border border-bg-border/60 rounded-[18px]">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <ScoreRing score={candidate.aiScore ?? 0} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-[14.5px] font-bold text-txt-heading">AI match</h4>
              {rec && (
                <Badge variant={RECOMMENDATION_VARIANT[rec]} className="text-[11px]">
                  {AI_RECOMMENDATION_LABEL[rec]}
                </Badge>
              )}
            </div>
            <p className="text-[11.5px] text-txt-caption mt-1 font-medium flex items-center gap-1 flex-wrap">
              <FileText className="w-3.5 h-3.5" />
              {analysis
                ? analysis.cvUsed
                  ? "Based on profile + CV"
                  : "Profile only"
                : "Score only"}
            </p>
            {analysis?.cvNote && (
              <p className="text-[11.5px] text-txt-caption mt-0.5">{analysis.cvNote}</p>
            )}
            {(candidate.aiModel || candidate.aiScoredAt) && (
              <p className="text-[11px] text-txt-caption mt-0.5">
                {candidate.aiModel}
                {candidate.aiModel && candidate.aiScoredAt ? " · " : ""}
                {candidate.aiScoredAt && (
                  <time dateTime={candidate.aiScoredAt}>
                    analyzed {relativeTime(candidate.aiScoredAt)}
                  </time>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="shrink-0">{runButton(pending ? "Analyzing…" : "Re-run analysis")}</div>
      </div>

      {summary && (
        <div>
          <SectionTitle>Summary</SectionTitle>
          <p className="p-4 rounded-[14px] border border-bg-border/60 bg-bg-secondary text-[13px] text-txt-body leading-relaxed">
            {summary}
          </p>
        </div>
      )}

      {analysis && (analysis.matchedSkills.length > 0 || analysis.missingSkills.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <SectionTitle>Matched skills</SectionTitle>
            {analysis.matchedSkills.length ? (
              <div className="flex flex-wrap gap-1.5">
                {analysis.matchedSkills.map((skill) => (
                  <Badge key={skill} variant="success" className="text-[11px]">
                    {skill}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-txt-caption">None identified</p>
            )}
          </div>
          <div>
            <SectionTitle>Missing skills</SectionTitle>
            {analysis.missingSkills.length ? (
              <div className="flex flex-wrap gap-1.5">
                {analysis.missingSkills.map((skill) => (
                  <Badge key={skill} variant="warning" className="text-[11px]">
                    {skill}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-txt-caption">None</p>
            )}
          </div>
        </div>
      )}

      {analysis && analysis.strengths.length > 0 && (
        <div>
          <SectionTitle>Strengths</SectionTitle>
          <BulletList items={analysis.strengths} icon="check" />
        </div>
      )}

      {analysis && analysis.concerns.length > 0 && (
        <div>
          <SectionTitle>Concerns</SectionTitle>
          <BulletList items={analysis.concerns} icon="warn" />
        </div>
      )}

      {analysis?.experienceFit && (
        <div>
          <SectionTitle>Experience fit</SectionTitle>
          <p className="flex items-start gap-2 text-[13px] text-txt-body leading-relaxed">
            <Briefcase className="w-4 h-4 text-txt-caption shrink-0 mt-0.5" />
            {analysis.experienceFit}
          </p>
        </div>
      )}
    </div>
  )
}

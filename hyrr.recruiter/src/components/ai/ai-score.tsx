import {
  AI_RECOMMENDATION_LABEL,
  Badge,
  date,
  type AiRecommendation,
  type Candidate,
} from "hyrr.shared"
import { AlertCircle, Loader2, Sparkles } from "lucide-react"

export const RECOMMENDATION_VARIANT: Record<
  AiRecommendation,
  "success" | "warning" | "destructive"
> = {
  STRONG_FIT: "success",
  POSSIBLE_FIT: "warning",
  NOT_A_FIT: "destructive",
}

export function scoreVariant(score: number): "success" | "warning" | "destructive" {
  if (score >= 75) return "success"
  if (score >= 50) return "warning"
  return "destructive"
}

/** "just now", "5 min ago", "3 h ago", "2 d ago", or a date. */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return ""
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ""
  const diff = Math.max(0, Date.now() - then)
  const min = Math.round(diff / 60000)
  if (min < 1) return "just now"
  if (min < 60) return `${min} min ago`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  if (d < 30) return `${d} d ago`
  return date(iso)
}

/** Compact AI indicator for cards and tables: spinner while analysing, else score + fit chip. */
export function AiScoreChips({
  candidate,
  showEmpty = true,
}: {
  candidate: Candidate
  showEmpty?: boolean
}) {
  if (candidate.aiStatus === "PENDING") {
    return (
      <Badge
        variant="info"
        className="flex items-center gap-1 shrink-0 py-0.5 px-2 text-[10.5px]"
        title="AI analysis in progress"
      >
        <Loader2 className="w-3 h-3 animate-spin" />
        Analyzing
      </Badge>
    )
  }
  if (candidate.aiScore != null) {
    const rec = candidate.aiAnalysis?.recommendation
    return (
      <span className="inline-flex items-center gap-1 flex-wrap">
        <Badge
          variant={scoreVariant(candidate.aiScore)}
          className="flex items-center gap-1 shrink-0 py-0.5 px-2 text-[10.5px]"
          title="AI match score"
        >
          <Sparkles className="w-3 h-3" />
          {candidate.aiScore}%
        </Badge>
        {rec && (
          <Badge
            variant={RECOMMENDATION_VARIANT[rec]}
            className="shrink-0 py-0.5 px-2 text-[10.5px]"
          >
            {AI_RECOMMENDATION_LABEL[rec]}
          </Badge>
        )}
      </span>
    )
  }
  if (candidate.aiStatus === "FAILED") {
    return (
      <span
        className="inline-flex items-center gap-1 text-[10.5px] text-sec-red"
        title={candidate.aiError || "AI analysis failed"}
      >
        <AlertCircle className="w-3 h-3" /> Analysis failed
      </span>
    )
  }
  if (!showEmpty) return null
  return <span className="text-[10.5px] text-txt-caption">Not scored yet</span>
}

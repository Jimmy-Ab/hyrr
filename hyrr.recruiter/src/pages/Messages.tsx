import { MessagesView } from "hyrr.shared"
import { useMemo } from "react"
import { JobFilter } from "../components/jobs/job-filter"
import { useJobStore } from "../store/useJobStore"

export function Messages() {
  const setActiveView = useJobStore((s) => s.setActiveView)
  const selectedJobId = useJobStore((s) => s.selectedJobId)
  const conversations = useJobStore((s) => s.conversations)
  const counts = useMemo(() => {
    const out: Record<string, number> = {}
    for (const c of conversations) if (c.jobId) out[c.jobId] = (out[c.jobId] ?? 0) + 1
    return out
  }, [conversations])

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <JobFilter id="messages" counts={counts} total={conversations.length} />
      <MessagesView
        side="RECRUITER"
        jobId={selectedJobId || undefined}
        emptyAction={{ label: "Go to Candidates", onClick: () => setActiveView("Candidates") }}
        className="h-[calc(100dvh-190px)] md:h-[calc(100dvh-250px)] min-h-[420px]"
      />
    </div>
  )
}

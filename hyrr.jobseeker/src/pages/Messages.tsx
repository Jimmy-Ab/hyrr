import { MessagesView, SEEKER_VIEW, useJobStore } from "hyrr.shared"

export function CandidateMessages() {
  const setCandidateActiveView = useJobStore((s) => s.setCandidateActiveView)
  return (
    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300 relative">
      {/* Ambient glows */}
      <div className="ambient-glow-1" />
      <div className="ambient-glow-2" />
      <div>
        <h1 className="text-[21px] font-bold tracking-tight text-txt-title">Messages</h1>
        <p className="text-[12px] text-txt-caption mt-0.5 font-medium">
          Your conversations with recruiters and hiring teams.
        </p>
      </div>

      <MessagesView
        side="SEEKER"
        showDetailsPanel
        emptyAction={{
          label: "Go to Applications",
          onClick: () => setCandidateActiveView(SEEKER_VIEW.APPLICATIONS),
        }}
        className="h-[calc(100dvh-150px)] min-h-[480px] max-h-[680px]"
      />
    </div>
  )
}

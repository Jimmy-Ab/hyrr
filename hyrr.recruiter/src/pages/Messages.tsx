import { MessagesView } from "hyrr.shared"
import { useJobStore } from "../store/useJobStore"

export function Messages() {
  const setActiveView = useJobStore((s) => s.setActiveView)
  return (
    <MessagesView
      side="RECRUITER"
      emptyAction={{ label: "Go to Candidates", onClick: () => setActiveView("Candidates") }}
      className="h-[calc(100dvh-140px)] md:h-[calc(100dvh-200px)] min-h-[420px] animate-in fade-in slide-in-from-bottom-2 duration-300"
    />
  )
}

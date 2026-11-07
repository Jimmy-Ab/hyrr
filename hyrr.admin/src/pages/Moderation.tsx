import {
  Button,
  EmptyState,
  FilterChips,
  PageHeader,
  RichTextRenderer,
  Skeleton,
  TonePill,
  VerifiedBadge,
  jobStatusTone,
} from "hyrr.shared"
import { Ban, CheckCircle2, Eraser, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react"
import * as React from "react"
import {
  DataTable,
  ErrorBlock,
  LoadMore,
  LoadingRows,
  RowButton,
  td,
} from "../components/ui/common"
import { ReasonDialog } from "../components/ui/reason-dialog"
import { KeyValues, SheetSection, SideSheet } from "../components/ui/side-sheet"
import { api, useAdminAction, useAdminQuery, useCursorList } from "../lib/api"
import { ago, date, dateTime, humanize, num } from "../lib/format"
import { useNav } from "../lib/nav"
import { companyStatusTone } from "../lib/tones"
import type { ModerationDetail, ModerationItem } from "../lib/types"

type Status = "open" | "all"

export function Moderation() {
  const focus = useNav((s) => s.focus)
  const clearFocus = useNav((s) => s.clearFocus)
  const [status, setStatus] = React.useState<Status>("open")
  const [openId, setOpenId] = React.useState<string | null>(null)
  const list = useCursorList<ModerationItem>("/moderation", { status })

  React.useEffect(() => {
    if (focus?.view === "moderation") {
      setOpenId(focus.id)
      clearFocus()
    }
  }, [focus, clearFocus])

  return (
    <div className="flex flex-col gap-6 pb-10">
      <PageHeader
        title="Moderation"
        icon={ShieldAlert}
        tone="amber"
        subtitle="Flagged and reported jobs, newest first"
        actions={
          <FilterChips
            id="moderation-status"
            label="Queue"
            options={[
              { value: "open", label: "Open", tone: "amber" },
              { value: "all", label: "All", tone: "slate" },
            ]}
            value={status}
            onChange={setStatus}
          />
        }
      />

      {list.error && !list.data ? (
        <ErrorBlock error={list.error} onRetry={() => void list.refetch()} />
      ) : list.isLoading ? (
        <LoadingRows />
      ) : list.items.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          tone="emerald"
          title={status === "open" ? "Queue is clear" : "No reports yet"}
          description={
            status === "open"
              ? "No flagged jobs or pending reports. New reports show up here."
              : "Jobs that were flagged or reported appear here."
          }
          action={
            status === "open" ? (
              <Button size="sm" variant="secondary" onClick={() => setStatus("all")}>
                Show resolved
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div>
          <DataTable head={["Job", "Company", "Status", "Reports", "Top reasons", "Last report"]}>
            {list.items.map((it) => (
              <RowButton
                key={it.job.id}
                label={`Open ${it.job.title}`}
                onOpen={() => setOpenId(it.job.id)}
              >
                <td className={td}>
                  <span className="font-semibold text-txt-heading">{it.job.title}</span>
                  <span className="block text-[11.5px] text-txt-caption">
                    Published {date(it.job.publishedAt)}
                  </span>
                </td>
                <td className={td}>
                  <span className="inline-flex items-center gap-1.5 text-txt-heading">
                    {it.job.company.name}
                    {it.job.company.verified && <VerifiedBadge focusable={false} />}
                  </span>
                  {it.job.company.status === "SUSPENDED" && (
                    <TonePill tone="rose" className="ml-0 mt-1">
                      Suspended
                    </TonePill>
                  )}
                </td>
                <td className={td}>
                  <TonePill tone={jobStatusTone(it.job.status)}>{humanize(it.job.status)}</TonePill>
                </td>
                <td className={`${td} tabular-nums`}>
                  <span className="font-semibold text-txt-heading">{num(it.reports.total)}</span>
                  {it.reports.pending > 0 && (
                    <span className="ml-1.5 text-[12px] text-txt-caption">
                      {num(it.reports.pending)} pending
                    </span>
                  )}
                </td>
                <td className={`${td} max-w-[260px]`}>
                  <span className="line-clamp-2 text-[12.5px] text-txt-body">
                    {it.reports.reasons
                      .slice(0, 3)
                      .map((r) => `${humanize(r.reason)} (${r.count})`)
                      .join(", ") || "—"}
                  </span>
                </td>
                <td className={`${td} whitespace-nowrap text-txt-caption`}>
                  {ago(it.reports.lastAt)}
                </td>
              </RowButton>
            ))}
          </DataTable>
          <LoadMore
            shown={list.items.length}
            hasMore={!!list.hasNextPage}
            loading={list.isFetchingNextPage}
            onClick={() => void list.fetchNextPage()}
          />
        </div>
      )}

      <ModerationSheet jobId={openId} onClose={() => setOpenId(null)} />
    </div>
  )
}

type Action = "restore" | "remove" | "dismiss" | "suspend"

function ModerationSheet({ jobId, onClose }: { jobId: string | null; onClose: () => void }) {
  const { data, error, isLoading, refetch } = useAdminQuery<ModerationDetail>(
    `/moderation/${jobId}`,
    undefined,
    { enabled: !!jobId }
  )
  const [action, setAction] = React.useState<Action | null>(null)
  const act = useAdminAction(({ kind, body }: { kind: Action; body: object }) =>
    kind === "suspend"
      ? api.post(`/companies/${data?.job.company?.id}/suspend`, body)
      : api.post(`/moderation/${jobId}/${kind}`, body)
  )
  const detail = data && data.job.id === jobId ? data : undefined
  const job = detail?.job
  const pending = detail?.reports.filter((r) => r.status === "PENDING").length ?? 0

  const dialogs: Record<
    Action,
    {
      title: string
      description: string
      confirm: string
      success: string
      mode: "reason" | "note"
      destructive: boolean
    }
  > = {
    restore: {
      title: "Restore this job?",
      description:
        "The job goes back to Active and its pending reports are dismissed. The poster is notified.",
      confirm: "Restore job",
      success: "Job restored",
      mode: "note",
      destructive: false,
    },
    dismiss: {
      title: "Dismiss pending reports?",
      description: "The reports are closed; the job itself is not changed.",
      confirm: "Dismiss reports",
      success: "Reports dismissed",
      mode: "note",
      destructive: false,
    },
    remove: {
      title: "Remove this job?",
      description:
        "The job is closed and the recruiter can't reopen or edit it. Reports are resolved, seekers' unreviewed applications are refunded, and the poster, refunded seekers and reporters are notified (the poster gets your reason).",
      confirm: "Remove job",
      success: "Job removed",
      mode: "reason",
      destructive: true,
    },
    suspend: {
      title: `Suspend ${job?.company?.name ?? "this company"}?`,
      description:
        "Its jobs leave search and members can't post or edit until you reactivate it. The reason is recorded.",
      confirm: "Suspend company",
      success: "Company suspended",
      mode: "reason",
      destructive: true,
    },
  }
  const d = action ? dialogs[action] : null

  return (
    <SideSheet
      open={!!jobId}
      onOpenChange={(o) => !o && onClose()}
      title={job?.title ?? "Report"}
      subtitle={job?.company?.name}
      header={
        job && (
          <>
            <TonePill tone={jobStatusTone(job.status)}>{humanize(job.status)}</TonePill>
            {pending > 0 && <TonePill tone="amber">{pending} pending reports</TonePill>}
          </>
        )
      }
      footer={
        job && (
          <>
            {job.company?.id && detail?.companyHistory.status !== "SUSPENDED" && (
              <Button size="sm" variant="ghost" onClick={() => setAction("suspend")}>
                <Ban className="h-3.5 w-3.5" /> Suspend company
              </Button>
            )}
            {pending > 0 && (
              <Button size="sm" variant="secondary" onClick={() => setAction("dismiss")}>
                <Eraser className="h-3.5 w-3.5" /> Dismiss reports
              </Button>
            )}
            {job.status !== "ACTIVE" && job.status !== "CLOSED" && (
              <Button size="sm" variant="secondary" onClick={() => setAction("restore")}>
                <CheckCircle2 className="h-3.5 w-3.5" /> Restore
              </Button>
            )}
            {job.status === "ACTIVE" && pending > 0 && (
              <Button size="sm" variant="secondary" onClick={() => setAction("restore")}>
                <CheckCircle2 className="h-3.5 w-3.5" /> Keep live
              </Button>
            )}
            {job.status !== "CLOSED" && (
              <Button size="sm" variant="danger" onClick={() => setAction("remove")}>
                <Trash2 className="h-3.5 w-3.5" /> Remove job
              </Button>
            )}
          </>
        )
      }
    >
      {error && !detail ? (
        <ErrorBlock error={error} onRetry={() => void refetch()} />
      ) : isLoading || !detail || !job ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        <>
          <SheetSection title={`Reports (${detail.reports.length})`}>
            <ul className="flex flex-col gap-2">
              {detail.reports.map((r) => (
                <li
                  key={r.id}
                  className="rounded-2xl border border-bg-border/70 bg-bg-primary/50 p-3.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold text-txt-heading">
                      {humanize(r.reason)}
                    </span>
                    <TonePill tone={r.status === "PENDING" ? "amber" : "slate"}>
                      {humanize(r.status)}
                    </TonePill>
                  </div>
                  {r.details && <p className="mt-1.5 text-[13px] text-txt-body">{r.details}</p>}
                  <p className="mt-1.5 text-[11.5px] text-txt-caption">
                    {r.reporter?.name ?? "Unknown"} · {dateTime(r.createdAt)}
                  </p>
                </li>
              ))}
              {detail.reports.length === 0 && (
                <li className="text-[13px] text-txt-caption">No reports: flagged automatically.</li>
              )}
            </ul>
          </SheetSection>

          <SheetSection title="Company">
            <KeyValues
              rows={[
                [
                  "Name",
                  <span key="name" className="inline-flex items-center gap-1.5">
                    {job.company?.name ?? "—"}
                    {detail.companyHistory.verified && <VerifiedBadge focusable={false} />}
                  </span>,
                ],
                [
                  "Status",
                  <TonePill key="status" tone={companyStatusTone(detail.companyHistory.status)}>
                    {humanize(detail.companyHistory.status)}
                  </TonePill>,
                ],
                ["Earlier flags", num(detail.companyHistory.flaggedJobs)],
                ["Removed jobs", num(detail.companyHistory.removedJobs)],
                [
                  "Posted by",
                  job.recruiter ? `${job.recruiter.name} · ${job.recruiter.email}` : "—",
                ],
              ]}
            />
          </SheetSection>

          <SheetSection title="Job">
            <KeyValues
              rows={[
                ["Published", date(job.publishedAt ?? null)],
                ["Location", (job.location as string) || "—"],
              ]}
            />
            {job.description && (
              <div className="mt-3 rounded-2xl border border-bg-border/70 p-4">
                <RichTextRenderer content={String(job.description)} />
              </div>
            )}
          </SheetSection>
        </>
      )}

      {d && action && (
        <ReasonDialog
          open
          onOpenChange={(o) => !o && setAction(null)}
          title={d.title}
          description={d.description}
          confirmLabel={d.confirm}
          successTitle={d.success}
          mode={d.mode}
          destructive={d.destructive}
          onConfirm={(body) => act.run({ kind: action, body })}
        />
      )}
    </SideSheet>
  )
}

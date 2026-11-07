import {
  Button,
  EmptyState,
  FilterChips,
  PageHeader,
  Skeleton,
  TonePill,
  VerifiedBadge,
  jobStatusTone,
} from "hyrr.shared"
import {
  BadgeCheck,
  BadgeX,
  Ban,
  Building2,
  Coins,
  Crown,
  Mail,
  RotateCcw,
  UserPlus,
} from "lucide-react"
import * as React from "react"
import { ActionConfirm } from "../components/ui/action-confirm"
import { AuditList } from "../components/ui/audit-list"
import {
  Avatar,
  DataTable,
  ErrorBlock,
  LoadMore,
  LoadingRows,
  RowButton,
  SearchBox,
  td,
} from "../components/ui/common"
import { ReasonDialog } from "../components/ui/reason-dialog"
import { KeyValues, SheetSection, SideSheet } from "../components/ui/side-sheet"
import { api, useAdminAction, useAdminQuery, useCursorList } from "../lib/api"
import { date, dateTime, humanize, money, num } from "../lib/format"
import { useNav } from "../lib/nav"
import { companyStatusTone, paymentStatusTone, userStatusTone } from "../lib/tones"
import type { AdminCompany, AdminCompanyDetail, CompanyStatus } from "../lib/types"

type StatusFilter = "ALL" | CompanyStatus

export function Companies() {
  const focus = useNav((s) => s.focus)
  const clearFocus = useNav((s) => s.clearFocus)
  const [q, setQ] = React.useState("")
  const [status, setStatus] = React.useState<StatusFilter>("ALL")
  const [openId, setOpenId] = React.useState<string | null>(null)
  const list = useCursorList<AdminCompany>("/companies", {
    q,
    status: status === "ALL" ? undefined : status,
  })

  React.useEffect(() => {
    if (focus?.view === "companies") {
      setOpenId(focus.id)
      clearFocus()
    }
  }, [focus, clearFocus])

  const filtered = !!q || status !== "ALL"

  return (
    <div className="flex flex-col gap-6 pb-10">
      <PageHeader
        title="Companies"
        icon={Building2}
        tone="blue"
        subtitle="Hiring teams, verification and credits"
        actions={
          <SearchBox
            value={q}
            onChange={setQ}
            placeholder="Search companies"
            label="Search companies"
          />
        }
      />
      <FilterChips
        id="companies-status"
        label="Status"
        value={status}
        onChange={setStatus}
        className="self-start"
        options={[
          { value: "ALL", label: "All", tone: "slate" },
          { value: "VERIFIED", label: "Verified", tone: "emerald" },
          { value: "PENDING", label: "Pending", tone: "amber" },
          { value: "SUSPENDED", label: "Suspended", tone: "rose" },
        ]}
      />

      {list.error && !list.data ? (
        <ErrorBlock error={list.error} onRetry={() => void list.refetch()} />
      ) : list.isLoading ? (
        <LoadingRows />
      ) : list.items.length === 0 ? (
        <EmptyState
          icon={Building2}
          tone="blue"
          title={filtered ? "No matching companies" : "No companies yet"}
          description={
            filtered ? "Try another name or status." : "Companies appear when recruiters sign up."
          }
          action={
            filtered ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setQ("")
                  setStatus("ALL")
                }}
              >
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div>
          <DataTable head={["Company", "Status", "Members", "Jobs", "Credits", "Plan", "Joined"]}>
            {list.items.map((c) => (
              <RowButton key={c.id} label={`Open ${c.name}`} onOpen={() => setOpenId(c.id)}>
                <td className={td}>
                  <span className="flex items-center gap-3">
                    <Avatar name={c.name} src={c.logo} />
                    <span className="inline-flex items-center gap-1.5 font-semibold text-txt-heading">
                      {c.name}
                      {c.verified && <VerifiedBadge focusable={false} />}
                    </span>
                  </span>
                </td>
                <td className={td}>
                  <TonePill tone={companyStatusTone(c.status)}>{humanize(c.status)}</TonePill>
                </td>
                <td className={`${td} tabular-nums`}>{num(c.members)}</td>
                <td className={`${td} tabular-nums`}>
                  <span className="font-semibold text-txt-heading">{num(c.liveJobs)}</span>
                  <span className="text-txt-caption"> live / {num(c.jobs)}</span>
                </td>
                <td className={`${td} tabular-nums font-semibold text-txt-heading`}>
                  {num(c.balance)}
                </td>
                <td className={`${td} text-txt-body`}>{c.plan ? humanize(c.plan) : "—"}</td>
                <td className={`${td} whitespace-nowrap text-txt-body`}>{date(c.joinedAt)}</td>
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

      <CompanySheet companyId={openId} onClose={() => setOpenId(null)} />
    </div>
  )
}

type Pending = "verify" | "unverify" | "suspend" | "reactivate" | "credits" | "owner" | null

function CompanySheet({ companyId, onClose }: { companyId: string | null; onClose: () => void }) {
  const go = useNav((s) => s.go)
  const { data, error, isLoading, refetch } = useAdminQuery<AdminCompanyDetail>(
    `/companies/${companyId}`,
    undefined,
    { enabled: !!companyId }
  )
  const [pending, setPending] = React.useState<Pending>(null)
  const [newOwner, setNewOwner] = React.useState<{ id: string; name: string } | null>(null)
  const act = useAdminAction(({ path, body }: { path: string; body?: object }) =>
    api.post(`/companies/${companyId}/${path}`, body)
  )
  const c = data && data.id === companyId ? data : undefined
  const planName = c?.subscription?.plan?.name ?? c?.subscription?.planCode ?? c?.plan

  return (
    <SideSheet
      open={!!companyId}
      onOpenChange={(o) => !o && onClose()}
      title={c?.name ?? "Company"}
      subtitle={c?.website ?? undefined}
      header={
        c && (
          <>
            <TonePill tone={companyStatusTone(c.status)}>{humanize(c.status)}</TonePill>
            {c.verified && <TonePill tone="emerald">Verified badge</TonePill>}
            {planName && <TonePill tone="violet">{humanize(String(planName))}</TonePill>}
          </>
        )
      }
      footer={
        c && (
          <>
            {c.verified ? (
              <Button size="sm" variant="ghost" onClick={() => setPending("unverify")}>
                <BadgeX className="h-3.5 w-3.5" /> Remove badge
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setPending("verify")}>
                <BadgeCheck className="h-3.5 w-3.5" /> Verify
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => setPending("credits")}>
              <Coins className="h-3.5 w-3.5" /> Adjust credits
            </Button>
            {c.status === "SUSPENDED" ? (
              <Button size="sm" onClick={() => setPending("reactivate")}>
                <RotateCcw className="h-3.5 w-3.5" /> Reactivate
              </Button>
            ) : (
              <Button size="sm" variant="danger" onClick={() => setPending("suspend")}>
                <Ban className="h-3.5 w-3.5" /> Suspend
              </Button>
            )}
          </>
        )
      }
    >
      {error && !c ? (
        <ErrorBlock error={error} onRetry={() => void refetch()} />
      ) : isLoading || !c ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        <>
          <SheetSection title="Profile">
            <KeyValues
              rows={[
                ["Joined", date(c.joinedAt)],
                ["Website", c.website || "—"],
                ["Verified domain", c.verifiedDomain || "—"],
                [
                  "Plan",
                  planName
                    ? `${humanize(String(planName))}${c.subscription?.status ? ` · ${humanize(c.subscription.status)}` : ""}`
                    : "—",
                ],
              ]}
            />
          </SheetSection>

          <SheetSection title="Wallet">
            <div className="tone-violet mb-3 flex items-baseline gap-2 rounded-2xl border border-bg-border/70 bg-[var(--tone-bg)] p-4">
              <span className="text-[26px] font-bold tabular-nums text-txt-title">
                {num(c.wallet?.balance ?? c.balance)}
              </span>
              <span className="text-[12.5px] text-txt-body">credits</span>
            </div>
            {c.wallet?.recent.length ? (
              <ul className="divide-y divide-bg-border/60 rounded-2xl border border-bg-border/70">
                {c.wallet.recent.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[12.5px]"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium text-txt-heading">{humanize(t.type)}</span>
                      <span className="block truncate text-[11.5px] text-txt-caption">
                        {t.note ? `${t.note} · ` : ""}
                        {dateTime(t.createdAt)}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 font-semibold tabular-nums ${t.amount >= 0 ? "tone-emerald" : "tone-rose"} text-[var(--tone-fg)]`}
                    >
                      {t.amount > 0 ? "+" : ""}
                      {num(t.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-txt-caption">No ledger entries yet.</p>
            )}
          </SheetSection>

          <SheetSection title={`Members (${c.members.length})`}>
            <ul className="flex flex-col gap-1.5">
              {c.members.map((m) => (
                <li key={m.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      onClose()
                      go("users", { focusId: m.id })
                    }}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-bg-hover/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  >
                    <Avatar name={m.name} size={28} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-txt-heading">
                        {m.name}
                      </span>
                      <span className="block truncate text-[11.5px] text-txt-caption">
                        {m.email}
                      </span>
                    </span>
                    <span className="text-[11.5px] text-txt-caption">{humanize(m.role)}</span>
                    {m.status !== "ACTIVE" && (
                      <TonePill tone={userStatusTone(m.status)}>{humanize(m.status)}</TonePill>
                    )}
                  </button>
                  {m.role !== "OWNER" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setNewOwner({ id: m.id, name: m.name })
                        setPending("owner")
                      }}
                      aria-label={`Make ${m.name} the owner`}
                    >
                      <Crown className="h-3.5 w-3.5" /> Make owner
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </SheetSection>

          {(c.invites?.length > 0 || c.joinRequests?.length > 0) && (
            <SheetSection title="Pending invites and join requests">
              <ul className="flex flex-col gap-1.5 text-[13px]">
                {c.invites.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 px-2 py-1">
                    <Mail className="h-4 w-4 shrink-0 text-txt-caption" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-txt-heading">{i.email}</span>
                    <span className="text-[11.5px] text-txt-caption">{humanize(i.role)}</span>
                    <TonePill tone={i.expired ? "slate" : "blue"}>
                      {i.expired ? "Invite expired" : "Invited"}
                    </TonePill>
                  </li>
                ))}
                {c.joinRequests.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-2 py-1">
                    <UserPlus className="h-4 w-4 shrink-0 text-txt-caption" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-txt-heading">
                      {r.user.name} <span className="text-txt-caption">· {r.user.email}</span>
                    </span>
                    <TonePill tone="amber">Asked to join</TonePill>
                  </li>
                ))}
              </ul>
            </SheetSection>
          )}

          <SheetSection title={`Jobs (${c.jobs.length})`}>
            {c.jobs.length ? (
              <ul className="divide-y divide-bg-border/60 rounded-2xl border border-bg-border/70">
                {c.jobs.map((j) => (
                  <li
                    key={j.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[12.5px]"
                  >
                    <span className="truncate font-medium text-txt-heading">{j.title}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="tabular-nums text-txt-caption">
                        {num(j.applicants)} applicants
                      </span>
                      <TonePill tone={jobStatusTone(j.status)}>{humanize(j.status)}</TonePill>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-txt-caption">No jobs yet.</p>
            )}
          </SheetSection>

          <SheetSection title="Payments">
            {c.payments.length ? (
              <ul className="divide-y divide-bg-border/60 rounded-2xl border border-bg-border/70">
                {c.payments.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[12.5px]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-txt-heading">
                        {p.description || humanize(p.kind)}
                      </span>
                      <span className="block text-[11.5px] text-txt-caption">
                        {humanize(p.provider)} · {dateTime(p.paidAt ?? p.createdAt)}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="font-semibold tabular-nums text-txt-heading">
                        {money(p.amount, p.currency)}
                      </span>
                      <TonePill tone={paymentStatusTone(p.status)}>{humanize(p.status)}</TonePill>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-txt-caption">No payments yet.</p>
            )}
          </SheetSection>

          <SheetSection title="Admin history">
            <AuditList rows={c.audit} />
          </SheetSection>
        </>
      )}

      <ActionConfirm
        open={pending === "verify"}
        onOpenChange={(o) => !o && setPending(null)}
        title={`Verify ${c?.name ?? "company"}?`}
        description="The verified badge shows on their jobs and company page."
        confirmLabel="Verify"
        successTitle="Company verified"
        run={() => act.run({ path: "verify" })}
      />
      <ReasonDialog
        open={pending === "unverify"}
        onOpenChange={(o) => !o && setPending(null)}
        title="Remove the verified badge?"
        description="The badge disappears from their jobs. The company stays active."
        confirmLabel="Remove badge"
        successTitle="Badge removed"
        onConfirm={(body) => act.run({ path: "unverify", body })}
      />
      <ReasonDialog
        open={pending === "suspend"}
        onOpenChange={(o) => !o && setPending(null)}
        title={`Suspend ${c?.name ?? "company"}?`}
        description="Its jobs leave search, publishing is blocked and members can't make changes until you reactivate it."
        confirmLabel="Suspend company"
        successTitle="Company suspended"
        onConfirm={(body) => act.run({ path: "suspend", body })}
      />
      <ActionConfirm
        open={pending === "reactivate"}
        onOpenChange={(o) => !o && setPending(null)}
        title={`Reactivate ${c?.name ?? "company"}?`}
        description="Its jobs return to search and members can work again."
        confirmLabel="Reactivate"
        successTitle="Company reactivated"
        run={() => act.run({ path: "reactivate" })}
      />
      <ReasonDialog
        open={pending === "owner"}
        onOpenChange={(o) => !o && setPending(null)}
        destructive={false}
        title={`Make ${newOwner?.name ?? "this member"} the owner?`}
        description="Use this when the current owner is gone. Other owners become Recruiters. Everyone in the company is notified."
        confirmLabel="Transfer ownership"
        successTitle="Ownership transferred"
        onConfirm={(body) => act.run({ path: "owner", body: { ...body, userId: newOwner?.id } })}
      />
      <ReasonDialog
        open={pending === "credits"}
        onOpenChange={(o) => !o && setPending(null)}
        mode="credits"
        destructive={false}
        title="Adjust credits"
        description={`Current balance: ${num(c?.wallet?.balance ?? c?.balance ?? 0)} credits. The change is written to the ledger and the audit log.`}
        confirmLabel="Apply adjustment"
        successTitle="Credits adjusted"
        onConfirm={(body) => act.run({ path: "credits", body })}
      />
    </SideSheet>
  )
}

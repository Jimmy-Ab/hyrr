import {
  Button,
  EmptyState,
  FilterChips,
  PageHeader,
  Skeleton,
  TonePill,
  useJobStore,
} from "hyrr.shared"
import {
  BadgeCheck,
  Ban,
  Building2,
  KeyRound,
  MailCheck,
  RotateCcw,
  ShieldCheck,
  ShieldOff,
  Users as UsersIcon,
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
import { ago, date, humanize, num, pct } from "../lib/format"
import { useNav } from "../lib/nav"
import { roleTone, userStatusTone } from "../lib/tones"
import type { AdminUser, AdminUserDetail, UserRole, UserStatus } from "../lib/types"

type RoleFilter = "ALL" | UserRole
type StatusFilter = "ALL" | UserStatus

export function Users() {
  const focus = useNav((s) => s.focus)
  const clearFocus = useNav((s) => s.clearFocus)
  const [q, setQ] = React.useState("")
  const [role, setRole] = React.useState<RoleFilter>("ALL")
  const [status, setStatus] = React.useState<StatusFilter>("ALL")
  const [openId, setOpenId] = React.useState<string | null>(null)
  const list = useCursorList<AdminUser>("/users", {
    q,
    role: role === "ALL" ? undefined : role,
    status: status === "ALL" ? undefined : status,
  })

  React.useEffect(() => {
    if (focus?.view === "users") {
      setOpenId(focus.id)
      clearFocus()
    }
  }, [focus, clearFocus])

  const filtered = !!q || role !== "ALL" || status !== "ALL"

  return (
    <div className="flex flex-col gap-6 pb-10">
      <PageHeader
        title="Users"
        icon={UsersIcon}
        tone="violet"
        subtitle="Seekers, recruiters and admins"
        actions={
          <SearchBox
            value={q}
            onChange={setQ}
            placeholder="Search name or e-mail"
            label="Search users"
          />
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <FilterChips
          id="users-role"
          label="Role"
          value={role}
          onChange={setRole}
          options={[
            { value: "ALL", label: "All roles", tone: "slate" },
            { value: "SEEKER", label: "Seekers", tone: "teal" },
            { value: "RECRUITER", label: "Recruiters", tone: "blue" },
            { value: "ADMIN", label: "Admins", tone: "violet" },
          ]}
        />
        <FilterChips
          id="users-status"
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "ALL", label: "Any status", tone: "slate" },
            { value: "ACTIVE", label: "Active", tone: "emerald" },
            { value: "PENDING", label: "Pending", tone: "amber" },
            { value: "SUSPENDED", label: "Suspended", tone: "rose" },
          ]}
        />
      </div>

      {list.error && !list.data ? (
        <ErrorBlock error={list.error} onRetry={() => void list.refetch()} />
      ) : list.isLoading ? (
        <LoadingRows />
      ) : list.items.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title={filtered ? "No matching users" : "No users yet"}
          description={filtered ? "Try another name, role or status." : "Sign-ups appear here."}
          action={
            filtered ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setQ("")
                  setRole("ALL")
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
          <DataTable
            head={["User", "Role", "Status", "Company", "Security", "Joined", "Last active"]}
          >
            {list.items.map((u) => (
              <RowButton key={u.id} label={`Open ${u.name}`} onOpen={() => setOpenId(u.id)}>
                <td className={td}>
                  <span className="flex items-center gap-3">
                    <Avatar name={u.name} src={u.avatar} />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-txt-heading">
                        {u.name}
                      </span>
                      <span className="block truncate text-[12px] text-txt-caption">{u.email}</span>
                    </span>
                  </span>
                </td>
                <td className={td}>
                  <TonePill tone={roleTone(u.role)}>{humanize(u.role)}</TonePill>
                </td>
                <td className={td}>
                  <TonePill tone={userStatusTone(u.status)}>{humanize(u.status)}</TonePill>
                </td>
                <td className={`${td} text-txt-body`}>{u.company?.name ?? "—"}</td>
                <td className={td}>
                  <span className="flex items-center gap-2 text-txt-caption">
                    <span title={u.emailVerified ? "E-mail verified" : "E-mail not verified"}>
                      <MailCheck
                        className={`h-4 w-4 ${u.emailVerified ? "tone-emerald text-[var(--tone-fg)]" : ""}`}
                        aria-label={u.emailVerified ? "E-mail verified" : "E-mail not verified"}
                      />
                    </span>
                    <span title={u.twoFactorEnabled ? "Two-factor on" : "Two-factor off"}>
                      {u.twoFactorEnabled ? (
                        <ShieldCheck
                          className="tone-emerald h-4 w-4 text-[var(--tone-fg)]"
                          aria-label="Two-factor on"
                        />
                      ) : (
                        <ShieldOff className="h-4 w-4" aria-label="Two-factor off" />
                      )}
                    </span>
                  </span>
                </td>
                <td className={`${td} whitespace-nowrap text-txt-body`}>{date(u.joinedAt)}</td>
                <td className={`${td} whitespace-nowrap text-txt-caption`}>
                  {ago(u.lastActiveAt)}
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

      <UserSheet userId={openId} onClose={() => setOpenId(null)} />
    </div>
  )
}

type Pending = "suspend" | "reactivate" | "verify" | "reset" | null

function UserSheet({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const me = useJobStore((s) => s.user?.id)
  const go = useNav((s) => s.go)
  const { data, error, isLoading, refetch } = useAdminQuery<AdminUserDetail>(
    `/users/${userId}`,
    undefined,
    { enabled: !!userId }
  )
  const [pending, setPending] = React.useState<Pending>(null)
  const act = useAdminAction(({ path, body }: { path: string; body?: object }) =>
    api.post(`/users/${userId}/${path}`, body)
  )
  const u = data && data.id === userId ? data : undefined
  const isSelf = !!u && u.id === me

  return (
    <SideSheet
      open={!!userId}
      onOpenChange={(o) => !o && onClose()}
      title={u?.name ?? "User"}
      subtitle={u?.email}
      header={
        u && (
          <>
            <TonePill tone={roleTone(u.role)}>{humanize(u.role)}</TonePill>
            <TonePill tone={userStatusTone(u.status)}>{humanize(u.status)}</TonePill>
            {u.twoFactorEnabled && <TonePill tone="emerald">2FA on</TonePill>}
          </>
        )
      }
      footer={
        u && (
          <>
            {!u.emailVerified && (
              <Button size="sm" variant="secondary" onClick={() => setPending("verify")}>
                <BadgeCheck className="h-3.5 w-3.5" /> Mark e-mail verified
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => setPending("reset")}>
              <KeyRound className="h-3.5 w-3.5" /> Send password reset
            </Button>
            {u.status === "SUSPENDED" ? (
              <Button size="sm" onClick={() => setPending("reactivate")}>
                <RotateCcw className="h-3.5 w-3.5" /> Reactivate
              </Button>
            ) : (
              !isSelf && (
                <Button size="sm" variant="danger" onClick={() => setPending("suspend")}>
                  <Ban className="h-3.5 w-3.5" /> Suspend
                </Button>
              )
            )}
          </>
        )
      }
    >
      {error && !u ? (
        <ErrorBlock error={error} onRetry={() => void refetch()} />
      ) : isLoading || !u ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : (
        <>
          <SheetSection title="Account">
            <KeyValues
              rows={[
                ["Joined", date(u.joinedAt)],
                ["Last active", ago(u.lastActiveAt)],
                ["E-mail", u.emailVerified ? "Verified" : "Not verified"],
                ["Two-factor", u.twoFactorEnabled ? "On" : "Off"],
                [
                  "Company",
                  u.company ? (
                    <button
                      key="company"
                      type="button"
                      onClick={() => {
                        onClose()
                        go("companies", { focusId: u.company!.id })
                      }}
                      className="inline-flex cursor-pointer items-center gap-1.5 font-semibold text-primary hover:underline"
                    >
                      <Building2 className="h-3.5 w-3.5" /> {u.company.name}
                    </button>
                  ) : (
                    "—"
                  ),
                ],
              ]}
            />
          </SheetSection>

          {u.seeker && (
            <SheetSection title="Seeker profile">
              <KeyValues
                rows={[
                  ["Headline", u.seeker.title || "—"],
                  ["Location", u.seeker.location || "—"],
                  ["Applications", num(u.seeker.applications)],
                  [
                    "Profile strength",
                    pct(
                      u.seeker.profileStrength > 1
                        ? u.seeker.profileStrength / 100
                        : u.seeker.profileStrength
                    ),
                  ],
                  ["Wallet", u.wallet ? `${num(u.wallet.balance)} credits` : "—"],
                ]}
              />
            </SheetSection>
          )}

          <SheetSection title="Recent activity">
            <div className="grid grid-cols-3 gap-2">
              {[
                ["Applications", u.recent.applications],
                ["Jobs posted", u.recent.jobsPosted],
                ["Messages (30 d)", u.recent.messages30d],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-bg-border/70 bg-bg-primary/50 p-3 text-center"
                >
                  <p className="text-[18px] font-bold tabular-nums text-txt-title">
                    {num(value as number)}
                  </p>
                  <p className="text-[11.5px] text-txt-caption">{label}</p>
                </div>
              ))}
            </div>
          </SheetSection>

          <SheetSection title="Admin history">
            <AuditList rows={u.audit} />
          </SheetSection>
        </>
      )}

      <ReasonDialog
        open={pending === "suspend"}
        onOpenChange={(o) => !o && setPending(null)}
        title={`Suspend ${u?.name ?? "user"}?`}
        description="They are signed out everywhere and can't sign in until reactivated."
        confirmLabel="Suspend user"
        successTitle="User suspended"
        onConfirm={(body) => act.run({ path: "suspend", body })}
      />
      <ActionConfirm
        open={pending === "reactivate"}
        onOpenChange={(o) => !o && setPending(null)}
        title={`Reactivate ${u?.name ?? "user"}?`}
        description="They can sign in again straight away."
        confirmLabel="Reactivate"
        successTitle="User reactivated"
        run={() => act.run({ path: "reactivate" })}
      />
      <ActionConfirm
        open={pending === "verify"}
        onOpenChange={(o) => !o && setPending(null)}
        title="Mark e-mail as verified?"
        description={`Only do this if you have confirmed ${u?.email ?? "the address"} belongs to them.`}
        confirmLabel="Mark verified"
        successTitle="E-mail marked verified"
        run={() => act.run({ path: "verify-email" })}
      />
      <ActionConfirm
        open={pending === "reset"}
        onOpenChange={(o) => !o && setPending(null)}
        title="Send a password reset?"
        description={`A reset link is e-mailed to ${u?.email ?? "the user"}. Their current password keeps working until they use it.`}
        confirmLabel="Send reset link"
        successTitle="Password reset sent"
        run={() => act.run({ path: "reset-password" })}
      />
    </SideSheet>
  )
}

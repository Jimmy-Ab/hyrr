import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  FieldError,
  Input,
  TonePill,
  VerifiedBadge,
  useToast,
  type AssignableTeamRole,
  type TeamInvite,
  type TeamMember,
} from "hyrr.shared"
import { Crown, Loader2, LogOut, Mail, RotateCw, Send, Trash2, X } from "lucide-react"
import { useEffect, useState, type FormEvent } from "react"
import { avatarFallback, errorMessage, useCompanyVerified } from "../../lib/recruiter"
import { useJobStore } from "../../store/useJobStore"
import { ConfirmDialog } from "../layout/confirm-dialog"

export const ROLE_LABEL: Record<TeamMember["role"], string> = {
  OWNER: "Owner",
  RECRUITER: "Recruiter",
  HIRING_MANAGER: "Hiring Manager",
  VIEWER: "Viewer",
}

const selectClass =
  "h-11 px-3 rounded-input border border-bg-border bg-bg-secondary text-[13px] text-txt-heading cursor-pointer"

function RoleSelect({
  id,
  value,
  onChange,
  label,
}: {
  id: string
  value: AssignableTeamRole
  onChange: (role: AssignableTeamRole) => void
  label: string
}) {
  return (
    <>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as AssignableTeamRole)}
        className={selectClass}
      >
        <option value="RECRUITER">Recruiter</option>
        <option value="HIRING_MANAGER">Hiring Manager</option>
        <option value="VIEWER">Viewer</option>
      </select>
    </>
  )
}

const daysLeft = (invite: TeamInvite) =>
  Math.max(0, Math.ceil((new Date(invite.expiresAt).getTime() - Date.now()) / 86_400_000))

const sectionTitle = "text-[12px] font-semibold text-txt-heading uppercase tracking-wider"
const iconButton =
  "p-1.5 rounded-full text-txt-caption hover:bg-bg-hover hover:text-txt-heading cursor-pointer disabled:opacity-50"

type Pending =
  | { kind: "remove"; member: TeamMember }
  | { kind: "transfer"; member: TeamMember }
  | { kind: "revoke"; invite: TeamInvite }
  | { kind: "leave" }
  | null

export function TeamDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const {
    team,
    teamInvites,
    joinRequests,
    fetchTeam,
    fetchTeamInvites,
    fetchJoinRequests,
    inviteTeamMember,
    resendInvite,
    revokeInvite,
    approveJoinRequest,
    declineJoinRequest,
    removeTeamMember,
    transferOwnership,
    leaveTeam,
    user,
    workspaceName,
  } = useJobStore()
  const companyVerified = useCompanyVerified()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<AssignableTeamRole>("RECRUITER")
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [requestRoles, setRequestRoles] = useState<Record<string, AssignableTeamRole>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending>(null)

  const isOwner = team.some((m) => m.userId === user?.id && m.role === "OWNER")

  const load = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      await fetchTeam()
      const owner = useJobStore
        .getState()
        .team.some((m) => m.userId === user?.id && m.role === "OWNER")
      if (owner) await Promise.all([fetchTeamInvites(), fetchJoinRequests()])
    } catch (err) {
      setLoadError(errorMessage(err, "Could not load your team."))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) void load()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setInviteError("Enter a valid email address, e.g. name@company.com")
      return
    }
    setInviteError(null)
    setInviting(true)
    try {
      await inviteTeamMember(trimmed, role)
      toast(
        "Invite sent",
        `We e-mailed ${trimmed} a link to join as ${ROLE_LABEL[role]}.`,
        "success"
      )
      setEmail("")
    } catch (err) {
      setInviteError(errorMessage(err))
    } finally {
      setInviting(false)
    }
  }

  /** Runs a row action with a spinner on that row and a toast. */
  const act = async (id: string, action: () => Promise<void>, ok: string, fail: string) => {
    setBusyId(id)
    try {
      await action()
      toast(ok, undefined, "success")
    } catch (err) {
      toast(fail, errorMessage(err), "error")
    } finally {
      setBusyId(null)
    }
  }

  const confirmPending = async () => {
    if (!pending) return
    try {
      if (pending.kind === "remove") {
        await removeTeamMember(pending.member.id)
        toast(
          "Member removed",
          `${pending.member.name || pending.member.email} was removed.`,
          "success"
        )
      } else if (pending.kind === "transfer") {
        await transferOwnership(pending.member.id)
        toast("Ownership transferred", `${pending.member.name} is now the owner.`, "success")
      } else if (pending.kind === "revoke") {
        await revokeInvite(pending.invite.id)
        toast(
          "Invite revoked",
          `The link sent to ${pending.invite.email} no longer works.`,
          "success"
        )
      } else {
        await leaveTeam()
        onOpenChange(false)
        toast("You left the company", "Create a company or join another team.", "success")
      }
    } catch (err) {
      toast("Something went wrong", errorMessage(err), "error")
      throw err
    }
  }

  const confirmCopy = (() => {
    if (!pending) return { title: "", description: "", label: "" }
    if (pending.kind === "remove")
      return {
        title: "Remove team member?",
        description: `${pending.member.name || pending.member.email} will lose access to your company's jobs and candidates.`,
        label: "Remove",
      }
    if (pending.kind === "transfer")
      return {
        title: `Make ${pending.member.name} the owner?`,
        description:
          "They can manage the team, billing and invites. You stay on the team as a Recruiter.",
        label: "Transfer ownership",
      }
    if (pending.kind === "revoke")
      return {
        title: "Revoke this invite?",
        description: `The link sent to ${pending.invite.email} stops working and its seat is freed.`,
        label: "Revoke",
      }
    return {
      title: `Leave ${workspaceName || "this company"}?`,
      description:
        "You lose access to its jobs, candidates and messages. You can then create a company or join another team.",
      label: "Leave company",
    }
  })()

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent variant="sheet" className="flex flex-col gap-0 overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Team</DialogTitle>
            <DialogDescription>
              People with access to{" "}
              {workspaceName ? (
                <span className="inline-flex items-center gap-1 font-semibold text-txt-heading">
                  {workspaceName}
                  {companyVerified && <VerifiedBadge />}
                </span>
              ) : (
                "your company workspace"
              )}
              .
            </DialogDescription>
          </DialogHeader>

          {/* Members */}
          <section className="mt-5 flex flex-col gap-1" aria-label="Members">
            <p className={sectionTitle}>Members</p>
            {loading && team.length === 0 ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : loadError ? (
              <div role="alert" className="flex flex-col items-center gap-2 py-6 text-center">
                <p className="text-[13px] text-sec-red">{loadError}</p>
                <Button size="sm" variant="secondary" onClick={load}>
                  Retry
                </Button>
              </div>
            ) : (
              team.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 px-2 py-2 rounded-[12px] hover:bg-bg-hover"
                >
                  <img
                    src={member.avatar || avatarFallback(member.name || member.email)}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-txt-heading truncate">
                      {member.name || member.email}
                      {member.userId === user?.id && (
                        <span className="text-txt-caption font-normal"> (you)</span>
                      )}
                    </p>
                    <p className="text-[11.5px] text-txt-caption truncate">
                      {member.email} · {ROLE_LABEL[member.role]}
                    </p>
                  </div>
                  {isOwner && member.userId !== user?.id && (
                    <>
                      <button
                        type="button"
                        onClick={() => setPending({ kind: "transfer", member })}
                        aria-label={`Make ${member.name || member.email} the owner`}
                        title="Make owner"
                        className={iconButton}
                      >
                        <Crown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPending({ kind: "remove", member })}
                        aria-label={`Remove ${member.name || member.email}`}
                        className="p-1.5 rounded-full text-txt-caption hover:text-sec-red hover:bg-sec-red/10 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              ))
            )}
          </section>

          {/* Join requests */}
          {isOwner && joinRequests.length > 0 && (
            <section className="mt-5 flex flex-col gap-1" aria-label="Join requests">
              <p className={sectionTitle}>Asking to join ({joinRequests.length})</p>
              {joinRequests.map((request) => {
                const chosen = requestRoles[request.id] ?? "RECRUITER"
                return (
                  <div
                    key={request.id}
                    className="flex flex-wrap items-center gap-2 px-2 py-2 rounded-[12px] bg-bg-hover/50"
                  >
                    <div className="flex-1 min-w-[160px]">
                      <p className="text-[13px] font-semibold text-txt-heading truncate">
                        {request.user.name}
                      </p>
                      <p className="text-[11.5px] text-txt-caption truncate">
                        {request.user.email}
                      </p>
                    </div>
                    <RoleSelect
                      id={`join-role-${request.id}`}
                      label={`Role for ${request.user.name}`}
                      value={chosen}
                      onChange={(r) => setRequestRoles((c) => ({ ...c, [request.id]: r }))}
                    />
                    <Button
                      size="sm"
                      disabled={busyId === request.id}
                      onClick={() =>
                        act(
                          request.id,
                          () => approveJoinRequest(request.id, chosen),
                          `${request.user.name} joined as ${ROLE_LABEL[chosen]}`,
                          "Could not approve"
                        )
                      }
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === request.id}
                      onClick={() =>
                        act(
                          request.id,
                          () => declineJoinRequest(request.id),
                          "Request declined",
                          "Could not decline"
                        )
                      }
                      aria-label={`Decline ${request.user.name}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )
              })}
            </section>
          )}

          {/* Pending invites */}
          {isOwner && teamInvites.length > 0 && (
            <section className="mt-5 flex flex-col gap-1" aria-label="Pending invites">
              <p className={sectionTitle}>Pending invites ({teamInvites.length})</p>
              {teamInvites.map((invite) => (
                <div key={invite.id} className="flex items-center gap-3 px-2 py-2 rounded-[12px]">
                  <Mail className="h-4 w-4 shrink-0 text-txt-caption" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-txt-heading truncate">
                      {invite.email}
                    </p>
                    <p className="text-[11.5px] text-txt-caption">
                      {ROLE_LABEL[invite.role]}
                      {!invite.expired &&
                        ` · expires in ${daysLeft(invite)} day${daysLeft(invite) === 1 ? "" : "s"}`}
                    </p>
                  </div>
                  {invite.expired && <TonePill tone="slate">Expired</TonePill>}
                  <button
                    type="button"
                    className={iconButton}
                    disabled={busyId === invite.id}
                    onClick={() =>
                      act(
                        invite.id,
                        () => resendInvite(invite.id),
                        "Invite sent again",
                        "Could not resend"
                      )
                    }
                    aria-label={`Resend the invite to ${invite.email}`}
                    title="Resend"
                  >
                    <RotateCw className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="p-1.5 rounded-full text-txt-caption hover:text-sec-red hover:bg-sec-red/10 cursor-pointer"
                    onClick={() => setPending({ kind: "revoke", invite })}
                    aria-label={`Revoke the invite to ${invite.email}`}
                    title="Revoke"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </section>
          )}

          {/* Invite */}
          {isOwner ? (
            <form
              onSubmit={handleInvite}
              className="mt-5 pt-4 border-t border-bg-border/40 flex flex-col gap-3"
            >
              <p className={sectionTitle}>Invite a colleague</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <label htmlFor="team-invite-email" className="sr-only">
                    Email
                  </label>
                  <Input
                    id="team-invite-email"
                    type="email"
                    required
                    placeholder="colleague@company.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      setInviteError(null)
                    }}
                    aria-invalid={!!inviteError || undefined}
                    aria-describedby={inviteError ? "team-invite-email-error" : undefined}
                  />
                  <FieldError id="team-invite-email-error" message={inviteError ?? undefined} />
                </div>
                <RoleSelect id="team-invite-role" label="Role" value={role} onChange={setRole} />
                <Button type="submit" disabled={inviting} className="gap-1.5">
                  {inviting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Send invite
                </Button>
              </div>
              <p className="text-[11.5px] text-txt-caption">
                We e-mail a link that's valid for 7 days. Open invites count toward your plan's
                seats.
              </p>
            </form>
          ) : (
            team.length > 0 && (
              <div className="mt-5 pt-4 border-t border-bg-border/40">
                <Button
                  variant="ghost"
                  className="gap-1.5 text-sec-red"
                  onClick={() => setPending({ kind: "leave" })}
                >
                  <LogOut className="h-4 w-4" /> Leave company
                </Button>
              </div>
            )
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title={confirmCopy.title}
        description={confirmCopy.description}
        confirmLabel={confirmCopy.label}
        onConfirm={confirmPending}
      />
    </>
  )
}

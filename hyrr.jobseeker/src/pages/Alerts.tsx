import {
  ALERT_FREQUENCY_LABEL,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EMPLOYMENT_TYPE_LABEL,
  EmptyState,
  Input,
  PageHeader,
  Skeleton,
  errorMessage,
  formatDateTime,
  isApiError,
  useJobStore,
  useToast,
  type AlertFrequency,
  type EmploymentTypeCode,
  type JobAlertInput,
  type JobAlertItem,
} from "hyrr.shared"
import { AlertTriangle, BellRing, Globe, MapPin, Pencil, Plus, Tag, Trash2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { ChipsInput } from "../components/ui/chips-input"

const MAX_ALERTS = 10
const MAX_CHIPS = 10
const FREQUENCIES = Object.keys(ALERT_FREQUENCY_LABEL) as AlertFrequency[]
const EMPLOYMENT_TYPES = Object.keys(EMPLOYMENT_TYPE_LABEL) as EmploymentTypeCode[]

const emptyForm = (): JobAlertInput => ({
  name: "",
  keywords: [],
  locations: [],
  jobTypes: [],
  remoteOnly: false,
  frequency: "DAILY",
})

function alertErrorMessage(err: unknown): string {
  if (isApiError(err) && err.errorCode === "ALERT_LIMIT") {
    return `You can have up to ${MAX_ALERTS} alerts. Delete one to create another.`
  }
  return errorMessage(err, "Please try again.")
}

// ─── Create / edit dialog ─────────────────────────────────────────────────────
function AlertDialog({
  open,
  editing,
  onClose,
}: {
  open: boolean
  editing: JobAlertItem | null
  onClose: () => void
}) {
  const createAlert = useJobStore((s) => s.createAlert)
  const updateAlert = useJobStore((s) => s.updateAlert)
  const { toast } = useToast()
  const [form, setForm] = useState<JobAlertInput>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    setForm(
      editing
        ? {
            name: editing.name,
            keywords: editing.keywords,
            locations: editing.locations,
            jobTypes: editing.jobTypes,
            remoteOnly: editing.remoteOnly,
            frequency: editing.frequency,
          }
        : emptyForm()
    )
  }, [open, editing])

  const toggleType = (code: EmploymentTypeCode) =>
    setForm((f) => ({
      ...f,
      jobTypes: f.jobTypes?.includes(code)
        ? f.jobTypes.filter((t) => t !== code)
        : [...(f.jobTypes ?? []), code],
    }))

  const submit = async () => {
    const name = form.name.trim()
    if (!name) {
      setError("Give the alert a name.")
      return
    }
    if (name.length > 80) {
      setError("The name can be at most 80 characters.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const input = { ...form, name }
      if (editing) {
        await updateAlert(editing.id, input)
        toast("Alert updated", `"${name}" was saved.`, "success")
      } else {
        await createAlert(input)
        toast("Alert created", `We'll let you know about new matching jobs.`, "success")
      }
      onClose()
    } catch (err) {
      setError(alertErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit job alert" : "New job alert"}</DialogTitle>
          <DialogDescription>
            Get notified when new jobs match these criteria. Leave a field empty to match anything.
          </DialogDescription>
        </DialogHeader>
        <form
          className="mt-4 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="alert-name" className="text-[13px] font-semibold text-txt-heading">
              Name
            </label>
            <Input
              id="alert-name"
              value={form.name}
              maxLength={80}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Remote React roles"
            />
          </div>
          <ChipsInput
            id="alert-keywords"
            label="Keywords"
            values={form.keywords ?? []}
            onChange={(keywords) => setForm((f) => ({ ...f, keywords }))}
            placeholder="React, Product designer… (Enter to add)"
            max={MAX_CHIPS}
          />
          <ChipsInput
            id="alert-locations"
            label="Locations"
            values={form.locations ?? []}
            onChange={(locations) => setForm((f) => ({ ...f, locations }))}
            placeholder="Berlin, London… (Enter to add)"
            max={MAX_CHIPS}
          />
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-[13px] font-semibold text-txt-heading">Job types</legend>
            <div className="flex flex-wrap gap-2">
              {EMPLOYMENT_TYPES.map((code) => {
                const on = form.jobTypes?.includes(code) ?? false
                return (
                  <button
                    key={code}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleType(code)}
                    className={`rounded-full border px-3 py-1 text-[12.5px] font-semibold transition-colors cursor-pointer ${
                      on
                        ? "border-primary bg-primary-light text-primary"
                        : "border-bg-border text-txt-body hover:bg-bg-hover"
                    }`}
                  >
                    {EMPLOYMENT_TYPE_LABEL[code]}
                  </button>
                )
              })}
            </div>
          </fieldset>
          <label className="flex items-center gap-2 text-[13px] font-medium text-txt-body cursor-pointer">
            <input
              type="checkbox"
              checked={!!form.remoteOnly}
              onChange={(e) => setForm((f) => ({ ...f, remoteOnly: e.target.checked }))}
              className="h-4 w-4 accent-primary"
            />
            Remote jobs only
          </label>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="alert-frequency" className="text-[13px] font-semibold text-txt-heading">
              Frequency
            </label>
            <select
              id="alert-frequency"
              value={form.frequency}
              onChange={(e) =>
                setForm((f) => ({ ...f, frequency: e.target.value as AlertFrequency }))
              }
              className="h-10 w-full rounded-xl border border-bg-border bg-bg-primary px-3 text-[13px] text-txt-heading focus:outline-none focus:border-primary/40"
            >
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {ALERT_FREQUENCY_LABEL[f]}
                </option>
              ))}
            </select>
          </div>
          {error && (
            <p role="alert" className="text-[13px] font-medium text-sec-red">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? "Saving…" : editing ? "Save alert" : "Create alert"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Alert card ───────────────────────────────────────────────────────────────
function AlertCard({
  alert,
  onEdit,
  onDelete,
}: {
  alert: JobAlertItem
  onEdit: () => void
  onDelete: () => void
}) {
  const updateAlert = useJobStore((s) => s.updateAlert)
  const { toast } = useToast()
  const [toggling, setToggling] = useState(false)

  const toggleActive = async () => {
    setToggling(true)
    try {
      await updateAlert(alert.id, { active: !alert.active })
      toast(alert.active ? "Alert paused" : "Alert resumed", alert.name, "success")
    } catch (err) {
      toast("Couldn't update alert", errorMessage(err), "error")
    } finally {
      setToggling(false)
    }
  }

  const criteria = [
    ...alert.keywords.map((k) => ({ icon: Tag, text: k })),
    ...alert.locations.map((l) => ({ icon: MapPin, text: l })),
    ...alert.jobTypes.map((t) => ({ icon: null, text: EMPLOYMENT_TYPE_LABEL[t] ?? t })),
    ...(alert.remoteOnly ? [{ icon: Globe, text: "Remote only" }] : []),
  ]

  return (
    <Card className={`p-4 sm:p-5 ${alert.active ? "" : "opacity-75"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[15px] font-semibold text-txt-heading">{alert.name}</h3>
            <Badge variant={alert.active ? "primary" : "secondary"}>
              {ALERT_FREQUENCY_LABEL[alert.frequency]}
            </Badge>
            {!alert.active && <Badge variant="secondary">Paused</Badge>}
          </div>
          <p className="mt-1 text-[12px] text-txt-caption">
            {alert.lastSentAt
              ? `Last sent ${formatDateTime(alert.lastSentAt)}`
              : "No matches sent yet"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            role="switch"
            aria-checked={alert.active}
            aria-label={`${alert.active ? "Pause" : "Resume"} ${alert.name}`}
            onClick={toggleActive}
            disabled={toggling}
            className={`relative mr-2 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              alert.active ? "bg-primary" : "bg-bg-border"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-bg-secondary shadow transition-transform ${
                alert.active ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${alert.name}`}
            className="grid h-8 w-8 place-items-center rounded-lg text-txt-caption hover:bg-bg-hover hover:text-txt-heading cursor-pointer"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${alert.name}`}
            className="grid h-8 w-8 place-items-center rounded-lg text-txt-caption hover:bg-bg-hover hover:text-sec-red cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {criteria.length === 0 ? (
          <span className="text-[12.5px] text-txt-caption">Matches every new job</span>
        ) : (
          criteria.map(({ icon: Icon, text }, i) => (
            <span
              key={`${text}-${i}`}
              className="inline-flex items-center gap-1 rounded-full border border-bg-border bg-bg-primary px-2.5 py-0.5 text-[12px] font-medium text-txt-body"
            >
              {Icon && <Icon className="h-3 w-3 text-txt-caption" aria-hidden="true" />}
              {text}
            </span>
          ))
        )}
      </div>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function AlertsPage() {
  const alerts = useJobStore((s) => s.alerts)
  const fetchAlerts = useJobStore((s) => s.fetchAlerts)
  const deleteAlert = useJobStore((s) => s.deleteAlert)
  const { toast } = useToast()
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<JobAlertItem | null>(null)
  const [pendingDelete, setPendingDelete] = useState<JobAlertItem | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      await fetchAlerts()
    } catch (err) {
      setError(errorMessage(err, "Could not load your alerts."))
    } finally {
      setLoaded(true)
    }
  }, [fetchAlerts])

  useEffect(() => {
    void load()
  }, [load])

  const atLimit = alerts.length >= MAX_ALERTS

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    try {
      await deleteAlert(pendingDelete.id)
      toast("Alert deleted", pendingDelete.name, "success")
    } catch (err) {
      toast("Couldn't delete alert", errorMessage(err), "error")
      throw err
    }
  }

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-200">
      <PageHeader
        icon={BellRing}
        tone="amber"
        title="Job Alerts"
        subtitle={
          <>
            Get new jobs that match your criteria by e-mail and in your notifications.
            {loaded && !error && (
              <span className={`ml-1.5 ${atLimit ? "text-sec-orange" : "text-txt-caption"}`}>
                {alerts.length} of {MAX_ALERTS} alerts{atLimit ? " (limit reached)" : ""}.
              </span>
            )}
          </>
        }
        actions={
          <Button size="sm" onClick={openCreate} disabled={atLimit || !!error}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New alert
          </Button>
        }
      />

      {!loaded ? (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading alerts">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : error ? (
        <Card role="alert" className="flex flex-col items-center gap-3 p-8 text-center">
          <AlertTriangle className="h-8 w-8 text-sec-orange" aria-hidden="true" />
          <p className="text-[14px] font-semibold text-txt-heading">{error}</p>
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </Card>
      ) : alerts.length === 0 ? (
        <EmptyState
          icon={BellRing}
          title="No job alerts yet"
          description="Create an alert and we'll tell you as soon as a matching job is posted."
          action={
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create your first alert
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {alerts.map((a) => (
            <AlertCard
              key={a.id}
              alert={a}
              onEdit={() => {
                setEditing(a)
                setDialogOpen(true)
              }}
              onDelete={() => setPendingDelete(a)}
            />
          ))}
        </div>
      )}

      <AlertDialog open={dialogOpen} editing={editing} onClose={() => setDialogOpen(false)} />

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="Delete job alert?"
        description={`"${pendingDelete?.name}" will stop sending you new jobs.`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
      />
    </div>
  )
}

import {
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  FilterChips,
  FormField,
  PageHeader,
  Skeleton,
  TonePill,
  describedBy,
  errorMessage,
  fieldCls,
  fieldErrorsOf,
  inputStateCls,
  useToast,
  validate,
  type FieldErrors,
} from "hyrr.shared"
import { ChevronDown, Pencil, Receipt, Wallet } from "lucide-react"
import * as React from "react"
import { DataTable, ErrorBlock, LoadMore, LoadingRows, td } from "../components/ui/common"
import { api, useAdminAction, useAdminQuery, useCursorList } from "../lib/api"
import { dateTime, humanize, money, num } from "../lib/format"
import { useNav } from "../lib/nav"
import { packageSchema, planSchema, pricingSchema } from "../lib/schemas"
import { paymentStatusTone } from "../lib/tones"
import type { AdminPayment, CreditPackage, MomentumConfig, Plan } from "../lib/types"

type Tab = "payments" | "pricing" | "catalog"

export function Money() {
  const preset = useNav((s) => s.preset)
  const [tab, setTab] = React.useState<Tab>("payments")
  return (
    <div className="flex flex-col gap-6 pb-10">
      <PageHeader
        title="Money"
        icon={Wallet}
        tone="emerald"
        subtitle="Payments, Momentum pricing, packs and plans"
        actions={
          <FilterChips
            id="money-tab"
            label="Section"
            value={tab}
            onChange={setTab}
            options={[
              { value: "payments", label: "Payments", tone: "emerald" },
              { value: "pricing", label: "Pricing", tone: "violet" },
              { value: "catalog", label: "Packs & plans", tone: "blue" },
            ]}
          />
        }
      />
      {tab === "payments" && <Payments initialStatus={preset?.status} />}
      {tab === "pricing" && <Pricing />}
      {tab === "catalog" && <Catalog />}
    </div>
  )
}

/* ─── Payments ───────────────────────────────────────────────────────────── */

const dateInputCls =
  "h-10 rounded-input border border-bg-border bg-bg-secondary px-3 text-[13px] text-txt-heading focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/15 [color-scheme:light] dark:[color-scheme:dark]"

function Payments({ initialStatus }: { initialStatus?: string }) {
  const [provider, setProvider] = React.useState("ALL")
  const [status, setStatus] = React.useState(initialStatus ?? "ALL")
  const [from, setFrom] = React.useState("")
  const [to, setTo] = React.useState("")
  const [expanded, setExpanded] = React.useState<string | null>(null)
  const list = useCursorList<AdminPayment>("/payments", {
    provider: provider === "ALL" ? undefined : provider,
    status: status === "ALL" ? undefined : status,
    from: from ? new Date(`${from}T00:00:00Z`).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59Z`).toISOString() : undefined,
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <FilterChips
          id="payments-provider"
          label="Provider"
          value={provider}
          onChange={setProvider}
          options={[
            { value: "ALL", label: "All providers", tone: "slate" },
            { value: "STRIPE", label: "Stripe", tone: "violet" },
            { value: "CHAPA", label: "Chapa", tone: "teal" },
          ]}
        />
        <FilterChips
          id="payments-status"
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "ALL", label: "Any status", tone: "slate" },
            { value: "SUCCEEDED", label: "Succeeded", tone: "emerald" },
            { value: "PENDING", label: "Pending", tone: "amber" },
            { value: "FAILED", label: "Failed", tone: "rose" },
            { value: "REFUNDED", label: "Refunded", tone: "slate" },
          ]}
        />
        <div className="flex items-end gap-2">
          <div>
            <label
              htmlFor="pay-from"
              className="mb-1 block text-[11.5px] font-semibold text-txt-caption"
            >
              From
            </label>
            <input
              id="pay-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={dateInputCls}
            />
          </div>
          <div>
            <label
              htmlFor="pay-to"
              className="mb-1 block text-[11.5px] font-semibold text-txt-caption"
            >
              To
            </label>
            <input
              id="pay-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={dateInputCls}
            />
          </div>
        </div>
      </div>

      {list.error && !list.data ? (
        <ErrorBlock error={list.error} onRetry={() => void list.refetch()} />
      ) : list.isLoading ? (
        <LoadingRows />
      ) : list.items.length === 0 ? (
        <EmptyState
          icon={Receipt}
          tone="emerald"
          title="No payments"
          description="Nothing matches these filters. Purchases appear here as soon as checkout starts."
        />
      ) : (
        <div>
          <DataTable
            head={["", "Owner", "Kind", "Amount", "Credits", "Provider", "Status", "Date"]}
          >
            {list.items.map((p) => {
              const open = expanded === p.id
              return (
                <React.Fragment key={p.id}>
                  <tr
                    className="cursor-pointer border-b border-bg-border/50 transition-colors hover:bg-bg-hover/60"
                    onClick={() => setExpanded(open ? null : p.id)}
                  >
                    <td className={`${td} w-8 pr-0`}>
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-label={open ? "Hide details" : "Show details"}
                        onClick={(e) => {
                          e.stopPropagation()
                          setExpanded(open ? null : p.id)
                        }}
                        className="cursor-pointer rounded-md p-1 text-txt-caption hover:bg-bg-hover hover:text-txt-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      >
                        <ChevronDown
                          className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                        />
                      </button>
                    </td>
                    <td className={td}>
                      <span className="block font-semibold text-txt-heading">
                        {p.owner?.name ?? "—"}
                      </span>
                      <span className="block text-[11.5px] text-txt-caption">
                        {p.owner ? (p.owner.type === "company" ? "Company" : "Seeker") : ""}
                      </span>
                    </td>
                    <td className={`${td} text-txt-body`}>{humanize(p.kind)}</td>
                    <td className={`${td} font-semibold tabular-nums text-txt-heading`}>
                      {money(p.amount, p.currency)}
                    </td>
                    <td className={`${td} tabular-nums`}>{num(p.credits)}</td>
                    <td className={`${td} text-txt-body`}>{humanize(p.provider)}</td>
                    <td className={td}>
                      <TonePill tone={paymentStatusTone(p.status)}>{humanize(p.status)}</TonePill>
                    </td>
                    <td className={`${td} whitespace-nowrap text-txt-caption`}>
                      {dateTime(p.paidAt ?? p.createdAt)}
                    </td>
                  </tr>
                  {open && (
                    <tr className="border-b border-bg-border/50 bg-bg-primary/50">
                      <td />
                      <td colSpan={7} className="px-4 py-3">
                        <dl className="grid grid-cols-1 gap-x-8 gap-y-1.5 text-[12.5px] sm:grid-cols-2">
                          <div>
                            <dt className="inline text-txt-caption">Provider reference: </dt>
                            <dd className="inline break-all font-mono text-txt-heading">
                              {p.providerRef || "—"}
                            </dd>
                          </div>
                          <div>
                            <dt className="inline text-txt-caption">Payment id: </dt>
                            <dd className="inline break-all font-mono text-txt-heading">{p.id}</dd>
                          </div>
                          <div>
                            <dt className="inline text-txt-caption">Description: </dt>
                            <dd className="inline text-txt-heading">{p.description || "—"}</dd>
                          </div>
                          <div>
                            <dt className="inline text-txt-caption">Created / paid: </dt>
                            <dd className="inline text-txt-heading">
                              {dateTime(p.createdAt)} / {dateTime(p.paidAt)}
                            </dd>
                          </div>
                        </dl>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </DataTable>
          <LoadMore
            shown={list.items.length}
            hasMore={!!list.hasNextPage}
            loading={list.isFetchingNextPage}
            onClick={() => void list.fetchNextPage()}
          />
        </div>
      )}
    </div>
  )
}

/* ─── Shared numeric field ──────────────────────────────────────────────── */

function NumberField({
  id,
  label,
  hint,
  value,
  onChange,
  error,
  step = 1,
  suffix,
}: {
  id: string
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  error?: string
  step?: number
  suffix?: string
}) {
  return (
    <FormField id={id} label={label} hint={hint} error={error}>
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${fieldCls} ${inputStateCls(error)} tabular-nums ${suffix ? "pr-16" : ""}`}
          {...describedBy(id, error)}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[12px] text-txt-caption">
            {suffix}
          </span>
        )}
      </div>
    </FormField>
  )
}

const toNum = (s: string) => (s.trim() === "" ? Number.NaN : Number(s))

/** Focuses the first invalid control after a failed submit. */
function focusFirstError(errors: FieldErrors, ids: Record<string, string>) {
  const first = Object.keys(errors)[0]
  if (first && ids[first]) document.getElementById(ids[first])?.focus()
}

/* ─── Pricing ───────────────────────────────────────────────────────────── */

const PRICING_FIELDS: {
  key: string
  label: string
  hint: string
  step?: number
  suffix?: string
}[] = [
  {
    key: "publishBase",
    label: "Publish base",
    hint: "Credits to publish a job",
    suffix: "credits",
  },
  {
    key: "multipliers.remote",
    label: "Remote multiplier",
    hint: "0.1 – 5",
    step: 0.05,
    suffix: "×",
  },
  {
    key: "multipliers.highSalary",
    label: "High-salary multiplier",
    hint: "0.1 – 5",
    step: 0.05,
    suffix: "×",
  },
  {
    key: "multipliers.featuredCategory",
    label: "Featured-category multiplier",
    hint: "0.1 – 5",
    step: 0.05,
    suffix: "×",
  },
  {
    key: "highSalaryThresholdUsd",
    label: "High-salary threshold",
    hint: "Yearly, in USD",
    suffix: "USD",
  },
  {
    key: "featureCost",
    label: "Feature cost",
    hint: "Credits to feature a job",
    suffix: "credits",
  },
  { key: "featureDays", label: "Feature days", hint: "1 – 90", suffix: "days" },
  {
    key: "aiRerunCost",
    label: "AI re-run cost",
    hint: "Per candidate re-score",
    suffix: "credits",
  },
  {
    key: "applyCost",
    label: "Apply cost",
    hint: "Seeker credits per application",
    suffix: "credits",
  },
  { key: "signupBonus", label: "Recruiter signup bonus", hint: "New companies", suffix: "credits" },
  {
    key: "seekerSignupBonus",
    label: "Seeker signup bonus",
    hint: "New seekers",
    suffix: "credits",
  },
]

const getPath = (o: any, path: string) => path.split(".").reduce((v, k) => v?.[k], o)

function Pricing() {
  const { toast } = useToast()
  const { data, error, isLoading, refetch } = useAdminQuery<MomentumConfig>("/pricing")
  const save = useAdminAction((body: object) => api.put<MomentumConfig>("/pricing", body))
  const [values, setValues] = React.useState<Record<string, string>>({})
  const [errors, setErrors] = React.useState<FieldErrors>({})

  const reset = React.useCallback((cfg: MomentumConfig) => {
    setValues(
      Object.fromEntries(PRICING_FIELDS.map((f) => [f.key, String(getPath(cfg, f.key) ?? "")]))
    )
    setErrors({})
  }, [])
  React.useEffect(() => {
    if (data) reset(data)
  }, [data, reset])

  const body = {
    publishBase: toNum(values.publishBase ?? ""),
    multipliers: {
      remote: toNum(values["multipliers.remote"] ?? ""),
      highSalary: toNum(values["multipliers.highSalary"] ?? ""),
      featuredCategory: toNum(values["multipliers.featuredCategory"] ?? ""),
    },
    highSalaryThresholdUsd: toNum(values.highSalaryThresholdUsd ?? ""),
    featureCost: toNum(values.featureCost ?? ""),
    featureDays: toNum(values.featureDays ?? ""),
    aiRerunCost: toNum(values.aiRerunCost ?? ""),
    signupBonus: toNum(values.signupBonus ?? ""),
    applyCost: toNum(values.applyCost ?? ""),
    seekerSignupBonus: toNum(values.seekerSignupBonus ?? ""),
  }
  const dirty = !!data && PRICING_FIELDS.some((f) => String(getPath(data, f.key)) !== values[f.key])
  const ids = Object.fromEntries(PRICING_FIELDS.map((f) => [f.key, `pricing-${f.key}`]))

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const found = validate(pricingSchema, body)
    setErrors(found)
    if (Object.keys(found).length) return focusFirstError(found, ids)
    try {
      await save.run(body)
      toast("Pricing saved", "New prices apply immediately.", "success")
    } catch (err: any) {
      const fields = fieldErrorsOf(err)
      if (Object.keys(fields).length) {
        setErrors(fields)
        focusFirstError(fields, ids)
      } else toast("Couldn't save pricing", errorMessage(err), "error")
    }
  }

  if (error && !data) return <ErrorBlock error={error} onRetry={() => void refetch()} />
  if (isLoading || !data) return <Skeleton className="h-[420px] rounded-card" />

  return (
    <Card className="p-6">
      <form onSubmit={onSave} noValidate>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold text-txt-heading">Momentum pricing</h2>
            <p className="text-[12.5px] text-txt-caption">
              Saved to system settings; takes effect on the next publish, feature, re-run or
              application.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!dirty || save.busy}
              onClick={() => reset(data)}
            >
              Discard
            </Button>
            <Button type="submit" size="sm" disabled={!dirty || save.busy}>
              {save.busy ? "Saving…" : "Save pricing"}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {PRICING_FIELDS.map((f) => (
            <NumberField
              key={f.key}
              id={ids[f.key]}
              label={f.label}
              hint={
                data.source?.[f.key.split(".")[0]]
                  ? `${f.hint} · from ${data.source[f.key.split(".")[0]]}`
                  : f.hint
              }
              step={f.step}
              suffix={f.suffix}
              value={values[f.key] ?? ""}
              error={errors[f.key]}
              onChange={(v) => {
                setValues((s) => ({ ...s, [f.key]: v }))
                if (errors[f.key])
                  setErrors((prev) => {
                    const next = { ...prev }
                    delete next[f.key]
                    return next
                  })
              }}
            />
          ))}
        </div>
      </form>
    </Card>
  )
}

/* ─── Packs & plans ─────────────────────────────────────────────────────── */

function Catalog() {
  const packages = useAdminQuery<CreditPackage[]>("/packages")
  const plans = useAdminQuery<Plan[]>("/plans")
  const [editPkg, setEditPkg] = React.useState<CreditPackage | null>(null)
  const [editPlan, setEditPlan] = React.useState<Plan | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-txt-caption">
          Credit packs
        </h2>
        {packages.error && !packages.data ? (
          <ErrorBlock error={packages.error} onRetry={() => void packages.refetch()} />
        ) : !packages.data ? (
          <LoadingRows rows={4} />
        ) : (
          <DataTable head={["Pack", "Audience", "Credits", "Bonus", "USD", "ETB", "Status", ""]}>
            {packages.data.map((p) => (
              <tr key={p.id} className="border-b border-bg-border/50">
                <td className={td}>
                  <span className="block font-semibold text-txt-heading">{p.name}</span>
                  <span className="block font-mono text-[11px] text-txt-caption">{p.code}</span>
                </td>
                <td className={td}>
                  <TonePill tone={p.audience === "SEEKER" ? "teal" : "blue"}>
                    {humanize(p.audience)}
                  </TonePill>
                </td>
                <td className={`${td} tabular-nums`}>{num(p.credits)}</td>
                <td className={`${td} tabular-nums`}>
                  {p.bonusCredits ? `+${num(p.bonusCredits)}` : "—"}
                </td>
                <td className={`${td} tabular-nums`}>{money(p.priceUsdCents, "USD")}</td>
                <td className={`${td} tabular-nums`}>{money(p.priceEtbCents, "ETB")}</td>
                <td className={td}>
                  <TonePill tone={p.active ? "emerald" : "slate"}>
                    {p.active ? "Active" : "Hidden"}
                  </TonePill>
                </td>
                <td className={`${td} text-right`}>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditPkg(p)}
                    aria-label={`Edit ${p.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-txt-caption">
          Plans
        </h2>
        {plans.error && !plans.data ? (
          <ErrorBlock error={plans.error} onRetry={() => void plans.refetch()} />
        ) : !plans.data ? (
          <LoadingRows rows={3} />
        ) : (
          <DataTable head={["Plan", "Monthly credits", "Seats", "USD / month", "Status", ""]}>
            {plans.data.map((p) => (
              <tr key={p.id} className="border-b border-bg-border/50">
                <td className={td}>
                  <span className="block font-semibold text-txt-heading">{p.name}</span>
                  <span className="block font-mono text-[11px] text-txt-caption">{p.code}</span>
                </td>
                <td className={`${td} tabular-nums`}>{num(p.monthlyCredits)}</td>
                <td className={`${td} tabular-nums`}>
                  {p.seatLimit == null ? "Unlimited" : num(p.seatLimit)}
                </td>
                <td className={`${td} tabular-nums`}>
                  {p.priceUsdCents ? money(p.priceUsdCents, "USD") : "Free"}
                </td>
                <td className={td}>
                  <TonePill tone={p.active ? "emerald" : "slate"}>
                    {p.active ? "Active" : "Hidden"}
                  </TonePill>
                </td>
                <td className={`${td} text-right`}>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditPlan(p)}
                    aria-label={`Edit ${p.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>

      <PackageDialog pkg={editPkg} onClose={() => setEditPkg(null)} />
      <PlanDialog plan={editPlan} onClose={() => setEditPlan(null)} />
    </div>
  )
}

/** Major units ("12.50") ↔ integer cents. */
const centsToText = (c: number) => (c / 100).toFixed(2).replace(/\.00$/, "")
const textToCents = (s: string) => (s.trim() === "" ? Number.NaN : Math.round(Number(s) * 100))

function ActiveToggle({
  checked,
  onChange,
  id,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  id: string
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-bg-border px-3.5 py-3"
    >
      <span>
        <span className="block text-[13px] font-semibold text-txt-heading">Active</span>
        <span className="block text-[11.5px] text-txt-caption">Hidden items can't be bought</span>
      </span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-9 cursor-pointer appearance-none rounded-full bg-bg-border transition-colors duration-200 before:block before:h-4 before:w-4 before:translate-x-0.5 before:rounded-full before:bg-bg-secondary before:shadow before:transition-transform before:duration-200 checked:bg-primary checked:before:translate-x-[18px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      />
    </label>
  )
}

function EditDialog({
  open,
  onClose,
  title,
  description,
  busy,
  onSubmit,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  description: string
  busy: boolean
  onSubmit: (e: React.FormEvent) => void
  children: React.ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <form onSubmit={onSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
          <DialogFooter>
            <Button type="button" size="sm" variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function useForm<T extends Record<string, string | boolean>>(initial: T | null) {
  const [values, setValues] = React.useState<T | null>(initial)
  const [errors, setErrors] = React.useState<FieldErrors>({})
  React.useEffect(() => {
    setValues(initial)
    setErrors({})
  }, [initial])
  const set = (k: keyof T & string, v: string | boolean) => {
    setValues((s) => (s ? { ...s, [k]: v } : s))
    if (errors[k])
      setErrors((prev) => {
        const next = { ...prev }
        delete next[k]
        return next
      })
  }
  return { values, errors, setErrors, set }
}

function PackageDialog({ pkg, onClose }: { pkg: CreditPackage | null; onClose: () => void }) {
  const { toast } = useToast()
  const initial = React.useMemo(
    () =>
      pkg && {
        name: pkg.name,
        credits: String(pkg.credits),
        bonusCredits: String(pkg.bonusCredits),
        priceUsd: centsToText(pkg.priceUsdCents),
        priceEtb: centsToText(pkg.priceEtbCents),
        active: pkg.active,
      },
    [pkg]
  )
  const { values, errors, setErrors, set } = useForm(initial)
  const save = useAdminAction((body: object) => api.put(`/packages/${pkg?.id}`, body))
  const map: Record<string, string> = { priceUsdCents: "priceUsd", priceEtbCents: "priceEtb" }
  const remap = (e: FieldErrors) =>
    Object.fromEntries(Object.entries(e).map(([k, v]) => [map[k] ?? k, v]))

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!values) return
    const body = {
      name: values.name.trim(),
      credits: toNum(values.credits),
      bonusCredits: toNum(values.bonusCredits),
      priceUsdCents: textToCents(values.priceUsd),
      priceEtbCents: textToCents(values.priceEtb),
      active: values.active,
    }
    const found = remap(validate(packageSchema, body))
    setErrors(found)
    if (Object.keys(found).length) return focusFirstError(found, idsOf("pkg", found))
    try {
      await save.run(body)
      toast("Pack saved", undefined, "success")
      onClose()
    } catch (err: any) {
      const fields = remap(fieldErrorsOf(err))
      if (Object.keys(fields).length) setErrors(fields)
      else toast("Couldn't save the pack", errorMessage(err), "error")
    }
  }

  return (
    <EditDialog
      open={!!pkg}
      onClose={onClose}
      title={`Edit ${pkg?.name ?? "pack"}`}
      description={`${humanize(pkg?.audience)} pack · ${pkg?.code ?? ""}`}
      busy={save.busy}
      onSubmit={onSubmit}
    >
      {values && (
        <>
          <FormField
            id="pkg-name"
            label="Name"
            required
            error={errors.name}
            className="sm:col-span-2"
          >
            <input
              id="pkg-name"
              value={values.name}
              maxLength={80}
              onChange={(e) => set("name", e.target.value)}
              className={`${fieldCls} ${inputStateCls(errors.name)}`}
              {...describedBy("pkg-name", errors.name)}
            />
          </FormField>
          <NumberField
            id="pkg-credits"
            label="Credits"
            value={values.credits}
            error={errors.credits}
            onChange={(v) => set("credits", v)}
          />
          <NumberField
            id="pkg-bonusCredits"
            label="Bonus credits"
            value={values.bonusCredits}
            error={errors.bonusCredits}
            onChange={(v) => set("bonusCredits", v)}
          />
          <NumberField
            id="pkg-priceUsd"
            label="Price (USD)"
            step={0.01}
            suffix="USD"
            value={values.priceUsd}
            error={errors.priceUsd}
            onChange={(v) => set("priceUsd", v)}
          />
          <NumberField
            id="pkg-priceEtb"
            label="Price (ETB)"
            step={0.01}
            suffix="ETB"
            value={values.priceEtb}
            error={errors.priceEtb}
            onChange={(v) => set("priceEtb", v)}
          />
          <div className="sm:col-span-2">
            <ActiveToggle
              id="pkg-active"
              checked={values.active}
              onChange={(v) => set("active", v)}
            />
          </div>
        </>
      )}
    </EditDialog>
  )
}

function PlanDialog({ plan, onClose }: { plan: Plan | null; onClose: () => void }) {
  const { toast } = useToast()
  const initial = React.useMemo(
    () =>
      plan && {
        name: plan.name,
        monthlyCredits: String(plan.monthlyCredits),
        seatLimit: plan.seatLimit == null ? "" : String(plan.seatLimit),
        priceUsd: centsToText(plan.priceUsdCents),
        active: plan.active,
      },
    [plan]
  )
  const { values, errors, setErrors, set } = useForm(initial)
  const save = useAdminAction((body: object) => api.put(`/plans/${plan?.code}`, body))
  const remap = (e: FieldErrors) =>
    Object.fromEntries(
      Object.entries(e).map(([k, v]) => [k === "priceUsdCents" ? "priceUsd" : k, v])
    )

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!values) return
    const body = {
      name: values.name.trim(),
      monthlyCredits: toNum(values.monthlyCredits),
      seatLimit: values.seatLimit.trim() === "" ? null : toNum(values.seatLimit),
      priceUsdCents: textToCents(values.priceUsd),
      active: values.active,
    }
    const found = remap(validate(planSchema, body))
    setErrors(found)
    if (Object.keys(found).length) return focusFirstError(found, idsOf("plan", found))
    try {
      await save.run(body)
      toast("Plan saved", undefined, "success")
      onClose()
    } catch (err: any) {
      const fields = remap(fieldErrorsOf(err))
      if (Object.keys(fields).length) setErrors(fields)
      else toast("Couldn't save the plan", errorMessage(err), "error")
    }
  }

  return (
    <EditDialog
      open={!!plan}
      onClose={onClose}
      title={`Edit ${plan?.name ?? "plan"}`}
      description={`Plan code ${plan?.code ?? ""}. Changes apply to the next billing cycle.`}
      busy={save.busy}
      onSubmit={onSubmit}
    >
      {values && (
        <>
          <FormField
            id="plan-name"
            label="Name"
            required
            error={errors.name}
            className="sm:col-span-2"
          >
            <input
              id="plan-name"
              value={values.name}
              maxLength={80}
              onChange={(e) => set("name", e.target.value)}
              className={`${fieldCls} ${inputStateCls(errors.name)}`}
              {...describedBy("plan-name", errors.name)}
            />
          </FormField>
          <NumberField
            id="plan-monthlyCredits"
            label="Monthly credits"
            value={values.monthlyCredits}
            error={errors.monthlyCredits}
            onChange={(v) => set("monthlyCredits", v)}
          />
          <NumberField
            id="plan-seatLimit"
            label="Seat limit"
            hint="Empty = unlimited"
            value={values.seatLimit}
            error={errors.seatLimit}
            onChange={(v) => set("seatLimit", v)}
          />
          <NumberField
            id="plan-priceUsd"
            label="Price per month (USD)"
            step={0.01}
            suffix="USD"
            value={values.priceUsd}
            error={errors.priceUsd}
            onChange={(v) => set("priceUsd", v)}
          />
          <div className="sm:col-span-2">
            <ActiveToggle
              id="plan-active"
              checked={values.active}
              onChange={(v) => set("active", v)}
            />
          </div>
        </>
      )}
    </EditDialog>
  )
}

const idsOf = (prefix: string, errors: FieldErrors) =>
  Object.fromEntries(Object.keys(errors).map((k) => [k, `${prefix}-${k}`]))

import { useQuery } from "@tanstack/react-query"
import {
  Button,
  Card,
  FormField,
  IconTile,
  PageHeader,
  Skeleton,
  TonePill,
  apiFetch,
  describedBy,
  errorMessage,
  fieldCls,
  fieldErrorsOf,
  inputStateCls,
  useToast,
  validate,
  type FieldErrors,
  type Tone,
} from "hyrr.shared"
import {
  Bot,
  CreditCard,
  Database,
  HardDrive,
  Layers,
  Mail,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react"
import * as React from "react"
import { ErrorBlock } from "../components/ui/common"
import { api, useAdminAction, useAdminQuery } from "../lib/api"
import { humanize } from "../lib/format"
import { aiSettingsSchema } from "../lib/schemas"
import type { AiSettings, SystemStatus } from "../lib/types"

/** AI settings via the audited admin proxy of /ai/settings (same payload). */
const AI_PATH = "/admin/ai"

export function Settings() {
  return (
    <div className="flex flex-col gap-6 pb-10">
      <PageHeader
        title="AI & settings"
        icon={Settings2}
        tone="teal"
        subtitle="Model choice and what's configured on the server"
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <AiCard />
        <SystemCard />
      </div>
      <WebJobsCard />
    </div>
  )
}

const PROVIDER_LABEL: Record<string, string> = {
  openai: "OpenAI",
  claude: "Anthropic",
  anthropic: "Anthropic",
  gemini: "Google",
  google: "Google",
}

function AiCard() {
  const { toast } = useToast()
  const q = useQuery<AiSettings>({ queryKey: ["admin", AI_PATH], queryFn: () => apiFetch(AI_PATH) })
  const save = useAdminAction((body: object) =>
    apiFetch(AI_PATH, { method: "PUT", body: JSON.stringify(body) })
  )
  const [model, setModel] = React.useState("")
  const [temperature, setTemperature] = React.useState("0.2")
  const [prompt, setPrompt] = React.useState("")
  const [errors, setErrors] = React.useState<FieldErrors>({})
  const data = q.data

  React.useEffect(() => {
    if (!data) return
    setModel(data.activeModel ?? "")
    setTemperature(String(data.temperature ?? 0.2))
    setPrompt(data.systemPrompt ?? "")
    setErrors({})
  }, [data])

  const clear = (k: string) =>
    errors[k] &&
    setErrors((prev) => {
      const next = { ...prev }
      delete next[k]
      return next
    })

  const dirty =
    !!data &&
    (model !== data.activeModel ||
      Number(temperature) !== data.temperature ||
      prompt !== data.systemPrompt)

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const body = {
      activeModel: model,
      temperature: temperature.trim() === "" ? Number.NaN : Number(temperature),
      systemPrompt: prompt,
    }
    const found = validate(aiSettingsSchema, body)
    setErrors(found)
    if (Object.keys(found).length) {
      document.getElementById(`ai-${Object.keys(found)[0]}`)?.focus()
      return
    }
    try {
      await save.run({ ...body, systemPrompt: prompt.trim() })
      toast("AI settings saved", undefined, "success")
    } catch (err: any) {
      const fields = fieldErrorsOf(err)
      if (Object.keys(fields).length) setErrors(fields)
      else toast("Couldn't save AI settings", errorMessage(err), "error")
    }
  }

  return (
    <Card className="p-6">
      <div className="mb-5 flex items-start gap-3">
        <IconTile icon={Sparkles} tone="violet" />
        <div>
          <h2 className="text-[16px] font-semibold text-txt-heading">AI model</h2>
          <p className="text-[12.5px] text-txt-caption">
            Used for candidate scoring, matching and the assistant. Changing it clears cached
            recommendations.
          </p>
        </div>
      </div>
      {q.error && !data ? (
        <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />
      ) : !data ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        <form onSubmit={onSave} noValidate className="flex flex-col gap-4">
          {data.configuredProviders.length === 0 || !data.resolvedModel ? (
            <div className="tone-amber flex items-start gap-2.5 rounded-xl bg-[var(--tone-bg)] p-3.5 text-[13px] text-txt-heading ring-1 ring-[var(--tone-ring)]">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--tone-fg)]" />
              No AI provider key is configured on the server, so AI features are off. Add an OpenAI,
              Anthropic or Google key to the backend environment.
            </div>
          ) : (
            <p className="text-[12.5px] text-txt-body">
              Running on <b className="text-txt-heading">{data.resolvedModel ?? "—"}</b>
              {data.provider && ` (${PROVIDER_LABEL[data.provider] ?? humanize(data.provider)})`}
            </p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
            <FormField id="ai-activeModel" label="Model" error={errors.activeModel}>
              <select
                id="ai-activeModel"
                value={model}
                disabled={data.availableModels.length === 0}
                onChange={(e) => {
                  setModel(e.target.value)
                  clear("activeModel")
                }}
                className={`${fieldCls} ${inputStateCls(errors.activeModel)} cursor-pointer`}
                {...describedBy("ai-activeModel", errors.activeModel)}
              >
                {!data.availableModels.includes(model) && (
                  <option value={model}>{model || "—"}</option>
                )}
                {data.availableModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              id="ai-temperature"
              label="Temperature"
              hint="0 – 1"
              error={errors.temperature}
            >
              <input
                id="ai-temperature"
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={temperature}
                onChange={(e) => {
                  setTemperature(e.target.value)
                  clear("temperature")
                }}
                className={`${fieldCls} ${inputStateCls(errors.temperature)} tabular-nums`}
                {...describedBy("ai-temperature", errors.temperature)}
              />
            </FormField>
          </div>
          <FormField id="ai-systemPrompt" label="System prompt" error={errors.systemPrompt}>
            <textarea
              id="ai-systemPrompt"
              value={prompt}
              maxLength={8000}
              rows={9}
              onChange={(e) => {
                setPrompt(e.target.value)
                clear("systemPrompt")
              }}
              className={`w-full resize-y rounded-input border bg-bg-secondary px-3.5 py-2.5 text-[13px] leading-relaxed text-txt-heading focus:outline-none focus:ring-2 transition-all duration-200 ${inputStateCls(errors.systemPrompt)}`}
              {...describedBy("ai-systemPrompt", errors.systemPrompt)}
            />
          </FormField>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11.5px] tabular-nums text-txt-caption">
              {prompt.length}/8000
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!dirty || save.busy}
                onClick={() => {
                  setModel(data.activeModel)
                  setTemperature(String(data.temperature))
                  setPrompt(data.systemPrompt)
                  setErrors({})
                }}
              >
                Discard
              </Button>
              <Button type="submit" size="sm" disabled={!dirty || save.busy}>
                {save.busy ? "Saving…" : "Save AI settings"}
              </Button>
            </div>
          </div>
        </form>
      )}
    </Card>
  )
}

function Row({
  icon,
  tone,
  label,
  value,
  ok,
}: {
  icon: LucideIcon
  tone: Tone
  label: string
  value: string
  ok: boolean | null
}) {
  return (
    <li className="group flex items-center gap-3 py-2.5">
      <IconTile icon={icon} tone={tone} size="sm" />
      <span className="flex-1 text-[13px] font-medium text-txt-heading">{label}</span>
      <TonePill tone={ok === null ? "sky" : ok ? "emerald" : "slate"}>{value}</TonePill>
    </li>
  )
}

function SystemCard() {
  const { data, error, refetch } = useAdminQuery<SystemStatus>("/system")
  return (
    <Card className="p-6">
      <div className="mb-3 flex items-start gap-3">
        <IconTile icon={ShieldCheck} tone="emerald" />
        <div>
          <h2 className="text-[16px] font-semibold text-txt-heading">Server configuration</h2>
          <p className="text-[12.5px] text-txt-caption">
            Read-only. Shows whether a key is set, never its value.
          </p>
        </div>
      </div>
      {error && !data ? (
        <ErrorBlock error={error} onRetry={() => void refetch()} />
      ) : !data ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-bg-border/60">
          <Row
            icon={Bot}
            tone="violet"
            label="OpenAI key"
            value={data.ai.providers.openai ? "Set" : "Not set"}
            ok={data.ai.providers.openai}
          />
          <Row
            icon={Bot}
            tone="violet"
            label="Anthropic key"
            value={data.ai.providers.anthropic ? "Set" : "Not set"}
            ok={data.ai.providers.anthropic}
          />
          <Row
            icon={Bot}
            tone="violet"
            label="Google key"
            value={data.ai.providers.google ? "Set" : "Not set"}
            ok={data.ai.providers.google}
          />
          <Row
            icon={Sparkles}
            tone="violet"
            label="Embeddings"
            value={data.ai.embeddings ? "On" : "Off"}
            ok={data.ai.embeddings}
          />
          <Row
            icon={Mail}
            tone="blue"
            label="E-mail (SMTP)"
            value={data.email ? "Configured" : "Off"}
            ok={data.email}
          />
          <Row
            icon={CreditCard}
            tone="emerald"
            label="Stripe"
            value={data.payments.stripe ? "Configured" : "Off"}
            ok={data.payments.stripe}
          />
          <Row
            icon={CreditCard}
            tone="emerald"
            label="Chapa"
            value={data.payments.chapa ? "Configured" : "Off"}
            ok={data.payments.chapa}
          />
          <Row
            icon={HardDrive}
            tone="amber"
            label="File storage"
            value={data.storage === "s3" ? "S3" : "Local disk"}
            ok={null}
          />
          <Row
            icon={Search}
            tone="sky"
            label="Search"
            value={data.search === "meili" ? "Meilisearch" : "Postgres"}
            ok={null}
          />
          <Row
            icon={Layers}
            tone="teal"
            label="Queues"
            value={data.queues === "bullmq" ? "BullMQ (Redis)" : "In-process"}
            ok={null}
          />
          <Row
            icon={ShieldCheck}
            tone="rose"
            label="Captcha"
            value={data.captcha ? "On" : "Off"}
            ok={data.captcha}
          />
          <Row
            icon={Database}
            tone="slate"
            label="Error reporting (Sentry)"
            value={data.sentry ? "On" : "Off"}
            ok={data.sentry}
          />
        </ul>
      )}
    </Card>
  )
}

type WebJobsStatus = {
  enabled: boolean
  providers: { source: string; configured: boolean }[]
  active: number
  bySource: Record<string, number>
  lastSync: {
    at: string
    report: Record<string, { fetched: number; saved: number; skipped: number; error?: string }>
  } | null
}

const SOURCE_NAME: Record<string, string> = {
  ADZUNA: "Adzuna (ADZUNA_APP_ID + ADZUNA_APP_KEY)",
  JOOBLE: "Jooble (JOOBLE_API_KEY)",
  REMOTIVE: "Remotive (free, REMOTIVE_ENABLED)",
  ARBEITNOW: "Arbeitnow (free, ARBEITNOW_ENABLED)",
}

/** Jobs from the web: which licensed APIs are configured, how many postings are live, sync now. */
function WebJobsCard() {
  const { data, error, refetch } = useAdminQuery<WebJobsStatus>("/external-jobs")
  const sync = useAdminAction(() => api.post("/external-jobs/sync"))
  const { toast } = useToast()
  const run = async () => {
    try {
      await sync.run(undefined)
      toast("Sync finished", "Jobs from the web were refreshed.", "success")
    } catch (err) {
      toast("Sync failed", errorMessage(err), "error")
    }
  }
  return (
    <Card className="p-6">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <IconTile icon={ShieldCheck} tone="teal" />
          <div>
            <h2 className="text-[16px] font-semibold text-txt-heading">Jobs from the web</h2>
            <p className="text-[12.5px] text-txt-caption">
              Postings from licensed job APIs, shown to seekers in Discover. Scheduled sync every 6
              hours when EXTERNAL_JOBS_ENABLED=true.
            </p>
          </div>
        </div>
        <Button size="sm" variant="secondary" onClick={run} disabled={sync.busy}>
          {sync.busy ? "Syncing…" : "Sync now"}
        </Button>
      </div>
      {error && !data ? (
        <ErrorBlock error={error} onRetry={() => void refetch()} />
      ) : !data ? (
        <Skeleton className="h-24" />
      ) : (
        <div className="space-y-3 text-[13px]">
          <p className="text-txt-body">
            <TonePill tone={data.enabled ? "emerald" : "slate"}>
              {data.enabled ? "Scheduled sync on" : "Scheduled sync off"}
            </TonePill>{" "}
            {data.active.toLocaleString()} live postings
            {data.lastSync ? ` · last sync ${new Date(data.lastSync.at).toLocaleString()}` : ""}
          </p>
          <ul className="divide-y divide-bg-border/60">
            {data.providers.map((p) => {
              const last = data.lastSync?.report[p.source]
              return (
                <li
                  key={p.source}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <span className="text-txt-heading">{SOURCE_NAME[p.source] ?? p.source}</span>
                  <span className="flex items-center gap-2 text-txt-caption">
                    {data.bySource[p.source] ?? 0} live
                    {last?.error && <TonePill tone="rose">Last sync failed</TonePill>}
                    <TonePill tone={p.configured ? "emerald" : "slate"}>
                      {p.configured ? "On" : "Off"}
                    </TonePill>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </Card>
  )
}

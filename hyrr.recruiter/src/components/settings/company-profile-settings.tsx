import { Button, Card, FieldError, Input, Skeleton, useToast, VerifiedBadge } from "hyrr.shared"
import { Check, Loader2, ShieldCheck } from "lucide-react"
import { useEffect, useState } from "react"
import { errorMessage } from "../../lib/recruiter"
import { useJobStore } from "../../store/useJobStore"

const LOGO_COLORS = [
  { value: "purple", name: "Purple", cls: "bg-primary" },
  { value: "blue", name: "Blue", cls: "bg-sec-blue" },
  { value: "green", name: "Green", cls: "bg-sec-green" },
  { value: "orange", name: "Orange", cls: "bg-sec-orange" },
] as const

const logoColorCls = (color: string | null | undefined) =>
  LOGO_COLORS.find((c) => c.value === color)?.cls ?? "bg-primary"

const labelCls = "text-[12px] font-semibold text-txt-heading uppercase tracking-wider block mb-1.5"
const textareaCls =
  "w-full min-h-[96px] px-3.5 py-2.5 rounded-xl border border-bg-border bg-bg-secondary text-[13px] text-txt-heading placeholder:text-txt-caption focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10 resize-y"

interface FormState {
  name: string
  website: string
  description: string
  industry: string
  country: string
  city: string
  logo: string
  color: string
}

const EMPTY: FormState = {
  name: "",
  website: "",
  description: "",
  industry: "",
  country: "",
  city: "",
  logo: "",
  color: "purple",
}

const isHttpUrl = (v: string) => {
  try {
    const u = new URL(v)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

export function CompanyProfileSettings() {
  const { companyProfile, fetchCompanyProfile, updateCompanyProfile } = useJobStore()
  const { toast } = useToast()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setError(null)
    try {
      await fetchCompanyProfile()
    } catch (err) {
      setError(errorMessage(err, "Could not load the company profile."))
    }
  }

  useEffect(() => {
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!companyProfile) return
    setForm({
      name: companyProfile.name ?? "",
      website: companyProfile.website ?? "",
      description: companyProfile.description ?? "",
      industry: companyProfile.industry ?? "",
      country: companyProfile.country ?? "",
      city: companyProfile.city ?? "",
      logo: companyProfile.logo ?? "",
      color: companyProfile.color ?? "purple",
    })
  }, [companyProfile])

  const set = (key: keyof FormState) => (value: string) => setForm((f) => ({ ...f, [key]: value }))

  const [nameError, setNameError] = useState<string | null>(null)
  const websiteInvalid = !!form.website.trim() && !isHttpUrl(form.website.trim())

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = form.name.trim()
    setNameError(
      !name ? "Company name is required" : name.length > 120 ? "At most 120 characters" : null
    )
    if (!name || name.length > 120 || websiteInvalid) {
      document
        .getElementById(!name || name.length > 120 ? "company-name" : "company-website")
        ?.focus()
      return
    }
    setSaving(true)
    try {
      await updateCompanyProfile({
        name: form.name.trim(),
        website: form.website.trim(),
        description: form.description.trim(),
        industry: form.industry.trim(),
        country: form.country.trim(),
        city: form.city.trim(),
        logo: (form.logo.trim() || form.name.trim().charAt(0)).toUpperCase(),
        color: form.color,
      })
      toast("Company profile saved", "Candidates will see the updated details.", "success")
    } catch (err) {
      toast("Could not save company profile", errorMessage(err), "error")
    } finally {
      setSaving(false)
    }
  }

  const logoIsUrl = /^https?:\/\//i.test(form.logo)
  const letter = (form.logo.trim() || form.name.trim().charAt(0) || "?").charAt(0).toUpperCase()

  return (
    <Card className="p-6 rounded-2xl border border-bg-border/60 bg-bg-card">
      <section aria-labelledby="settings-company">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 id="settings-company" className="text-[16px] font-semibold text-txt-heading">
            Company profile
          </h2>
          {companyProfile?.verified && <VerifiedBadge size="md" />}
        </div>
        {companyProfile && !companyProfile.verified ? (
          <p className="mt-1 flex items-start gap-1.5 text-[13px] text-txt-caption">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            Verify your company by using a work e-mail on your website's domain.
          </p>
        ) : companyProfile?.verifiedDomain ? (
          <p className="mt-1 text-[13px] text-txt-caption">
            Verified via {companyProfile.verifiedDomain}
          </p>
        ) : null}

        {error ? (
          <div role="alert" className="mt-4 text-[13px] text-sec-red flex items-center gap-2">
            {error}
            <button
              type="button"
              onClick={load}
              className="font-semibold text-primary hover:underline cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : !companyProfile ? (
          <div className="mt-4 space-y-3" role="status" aria-label="Loading company profile">
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="mt-5 space-y-4">
            <div className="flex items-center gap-4">
              {logoIsUrl ? (
                <img
                  src={form.logo}
                  alt=""
                  className="w-14 h-14 rounded-2xl object-cover border border-bg-border/60 shrink-0"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center text-[22px] font-bold text-white shrink-0 ${logoColorCls(form.color)}`}
                >
                  {letter}
                </span>
              )}
              <div className="space-y-2 min-w-0">
                {!logoIsUrl && (
                  <div className="flex items-center gap-2">
                    <label htmlFor="company-logo" className="text-[12.5px] text-txt-body">
                      Logo letter
                    </label>
                    <Input
                      id="company-logo"
                      value={form.logo}
                      maxLength={1}
                      onChange={(e) => set("logo")(e.target.value)}
                      className="h-9 w-14 text-center text-[13px]"
                    />
                  </div>
                )}
                <div
                  role="radiogroup"
                  aria-label="Logo colour"
                  className="flex items-center gap-1.5"
                >
                  {LOGO_COLORS.map((c) => {
                    const selected = form.color === c.value
                    return (
                      <button
                        key={c.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={c.name}
                        title={c.name}
                        onClick={() => set("color")(c.value)}
                        className={`w-6 h-6 rounded-full flex items-center justify-center cursor-pointer border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${c.cls} ${
                          selected ? "border-txt-heading" : "border-transparent"
                        }`}
                      >
                        {selected && <Check className="w-3 h-3 text-white" aria-hidden="true" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="company-name" className={labelCls}>
                  Name *
                </label>
                <Input
                  id="company-name"
                  value={form.name}
                  onChange={(e) => {
                    set("name")(e.target.value)
                    setNameError(null)
                  }}
                  maxLength={120}
                  aria-invalid={!!nameError || undefined}
                  aria-describedby={nameError ? "company-name-error" : undefined}
                />
                <FieldError id="company-name-error" message={nameError ?? undefined} />
              </div>
              <div>
                <label htmlFor="company-website" className={labelCls}>
                  Website
                </label>
                <Input
                  id="company-website"
                  type="url"
                  value={form.website}
                  placeholder="https://example.com"
                  onChange={(e) => set("website")(e.target.value)}
                  aria-invalid={websiteInvalid}
                  aria-describedby={websiteInvalid ? "company-website-error" : undefined}
                />
                {websiteInvalid && (
                  <p id="company-website-error" className="mt-1 text-[12px] text-sec-red">
                    Use a full address starting with http:// or https://
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="company-industry" className={labelCls}>
                  Industry
                </label>
                <Input
                  id="company-industry"
                  value={form.industry}
                  placeholder="e.g. Software"
                  onChange={(e) => set("industry")(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="company-country" className={labelCls}>
                    Country
                  </label>
                  <Input
                    id="company-country"
                    value={form.country}
                    onChange={(e) => set("country")(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="company-city" className={labelCls}>
                    City
                  </label>
                  <Input
                    id="company-city"
                    value={form.city}
                    onChange={(e) => set("city")(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div>
              <label htmlFor="company-description" className={labelCls}>
                Description
              </label>
              <textarea
                id="company-description"
                value={form.description}
                maxLength={5000}
                onChange={(e) => set("description")(e.target.value)}
                placeholder="What does your company do? What's it like to work there?"
                className={textareaCls}
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving} className="gap-1.5">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save company profile
              </Button>
            </div>
          </form>
        )}
      </section>
    </Card>
  )
}

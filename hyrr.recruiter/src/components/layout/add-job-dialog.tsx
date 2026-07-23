import { useState, useEffect, type FormEvent } from "react"
import { useJobStore } from "../../store/useJobStore"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { useToast } from "../ui/toast"
import { apiFetch, RichTextEditor } from "hyrr.shared"
import { Plus, X, ChevronRight, ChevronLeft, Briefcase, FileText, Sparkles } from "lucide-react"

interface Category { id: string; name: string; slug: string }

const WORK_TYPES = ["Full Time", "Part Time", "Contract", "Remote"]

const FALLBACK_CATEGORIES: Category[] = [
  { id: "software-development",    name: "Software Development",      slug: "software-development" },
  { id: "data-science-analytics",  name: "Data Science & Analytics",  slug: "data-science-analytics" },
  { id: "design-creative",         name: "Design & Creative",         slug: "design-creative" },
  { id: "product-management",      name: "Product Management",        slug: "product-management" },
  { id: "devops-infrastructure",   name: "DevOps & Infrastructure",   slug: "devops-infrastructure" },
  { id: "cybersecurity",           name: "Cybersecurity",             slug: "cybersecurity" },
  { id: "marketing-growth",        name: "Marketing & Growth",        slug: "marketing-growth" },
  { id: "sales-business-dev",      name: "Sales & Business Dev",      slug: "sales-business-dev" },
  { id: "finance-accounting",      name: "Finance & Accounting",      slug: "finance-accounting" },
  { id: "human-resources",         name: "Human Resources",           slug: "human-resources" },
  { id: "customer-success",        name: "Customer Success",          slug: "customer-success" },
  { id: "legal-compliance",        name: "Legal & Compliance",        slug: "legal-compliance" },
  { id: "operations-logistics",    name: "Operations & Logistics",    slug: "operations-logistics" },
  { id: "healthcare-medical",      name: "Healthcare & Medical",      slug: "healthcare-medical" },
  { id: "education-training",      name: "Education & Training",      slug: "education-training" },
  { id: "content-copywriting",     name: "Content & Copywriting",     slug: "content-copywriting" },
  { id: "machine-learning-ai",     name: "Machine Learning & AI",     slug: "machine-learning-ai" },
  { id: "mobile-development",      name: "Mobile Development",        slug: "mobile-development" },
  { id: "qa-testing",              name: "QA & Testing",              slug: "qa-testing" },
  { id: "project-management",      name: "Project Management",        slug: "project-management" },
  { id: "cloud-architecture",      name: "Cloud Architecture",        slug: "cloud-architecture" },
  { id: "blockchain-web3",         name: "Blockchain & Web3",         slug: "blockchain-web3" },
  { id: "research-development",    name: "Research & Development",    slug: "research-development" },
  { id: "administration-support",  name: "Administration & Support",  slug: "administration-support" },
]

const selectCls = "w-full h-11 px-3.5 rounded-input border border-bg-border bg-bg-secondary text-[13px] text-txt-heading focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all duration-200 cursor-pointer"
const labelCls = "text-[12px] font-semibold text-txt-heading uppercase tracking-wider block mb-1.5"
const tagCls = "inline-flex items-center gap-1 text-[11.5px] font-bold px-2.5 py-1 rounded-full transition-colors"

function TagInput({
  tags, onAdd, onRemove, placeholder, colorClass = "bg-primary-light text-primary border border-primary-border/30"
}: {
  tags: string[]
  onAdd: (v: string) => void
  onRemove: (v: string) => void
  placeholder: string
  colorClass?: string
}) {
  const [val, setVal] = useState("")
  const commit = () => {
    const trimmed = val.trim()
    if (trimmed && !tags.includes(trimmed)) {
      onAdd(trimmed)
      setVal("")
    }
  }
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
        {tags.map((t) => (
          <span key={t} className={`${tagCls} ${colorClass}`}>
            {t}
            <button type="button" onClick={() => onRemove(t)} className="hover:opacity-70 cursor-pointer">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit() } }}
          placeholder={placeholder}
          className="h-9 text-[12px]"
        />
        <Button type="button" variant="secondary" size="sm" onClick={commit} className="h-9 px-3 cursor-pointer shrink-0">
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}

function RequirementsList({ items, onChange }: { items: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("")
  const add = () => {
    const t = draft.trim()
    if (t) { onChange([...items, t]); setDraft("") }
  }
  return (
    <div>
      <ul className="space-y-2 mb-2">
        {items.map((req, i) => (
          <li key={i} className="flex items-start gap-2 text-[12.5px] text-txt-body group">
            <span className="mt-0.5 w-4 h-4 rounded-full bg-primary-light border border-primary-border/30 flex items-center justify-center shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            </span>
            <span className="flex-1">{req}</span>
            <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="text-txt-disabled hover:text-sec-red cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
              <X className="w-3.5 h-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add() } }}
          placeholder="e.g. 5+ years of React experience"
          className="h-9 text-[12px]"
        />
        <Button type="button" variant="secondary" size="sm" onClick={add} className="h-9 px-3 cursor-pointer shrink-0">
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}

const STEPS = [
  { label: "Basics", icon: Briefcase },
  { label: "Details", icon: FileText },
  { label: "Requirements", icon: Sparkles },
]

export function AddJobDialog() {
  const { isAddJobOpen, setAddJobOpen, addJob } = useJobStore()
  const { toast } = useToast()

  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<Category[]>(FALLBACK_CATEGORIES)

  // Step 1 – Basics
  const [title, setTitle] = useState("")
  const [location, setLocation] = useState("")
  const [type, setType] = useState("Full Time")
  const [salary, setSalary] = useState("")
  const [categoryId, setCategoryId] = useState(FALLBACK_CATEGORIES[0].id)
  const [remote, setRemote] = useState(false)
  const [featured, setFeatured] = useState(false)

  // Step 2 – Description
  const [description, setDescription] = useState("")

  // Step 3 – Skills, Requirements, Benefits
  const [skills, setSkills] = useState<string[]>([])
  const [requirements, setRequirements] = useState<string[]>([])
  const [benefits, setBenefits] = useState<string[]>([])

  useEffect(() => {
    if (isAddJobOpen) {
      // Pre-select the first fallback immediately so dialog opens ready
      if (!categoryId) setCategoryId(FALLBACK_CATEGORIES[0].id)
      // Then load real DB IDs in the background
      apiFetch("/jobs/categories").then((cats: Category[]) => {
        if (cats?.length) {
          setCategories(cats)
          // Re-map selection if current ID was a fallback slug
          setCategoryId((prev) => {
            const real = cats.find((c) => c.slug === prev || c.id === prev)
            return real ? real.id : cats[0].id
          })
        }
      }).catch(() => { /* keep fallbacks */ })
    }
  }, [isAddJobOpen])

  const reset = () => {
    setStep(0); setTitle(""); setLocation(""); setType("Full Time"); setSalary("")
    setCategoryId(categories[0]?.id || FALLBACK_CATEGORIES[0].id); setRemote(false); setFeatured(false)
    setDescription(""); setSkills([]); setRequirements([]); setBenefits([])
  }

  const handleClose = () => { reset(); setAddJobOpen(false) }

  const validateStep = () => {
    if (step === 0 && !title.trim()) { toast("Error", "Job Title is required.", "error"); return false }
    if (step === 0 && !categoryId) { toast("Error", "Please select a category.", "error"); return false }
    if (step === 1 && description.trim().length < 20) { toast("Error", "Description must be at least 20 characters.", "error"); return false }
    if (step === 2 && requirements.length === 0) { toast("Error", "Add at least one requirement.", "error"); return false }
    if (step === 2 && skills.length === 0) { toast("Error", "Add at least one required skill.", "error"); return false }
    return true
  }

  const handleNext = () => {
    if (!validateStep()) return
    setStep((s) => s + 1)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validateStep()) return
    setLoading(true)
    try {
      await addJob({
        title,
        location: location || "Remote",
        type,
        salary: salary || undefined,
        description,
        requirements,
        skills,
        benefits,
        categoryId,
        featured,
        remote,
      })
      toast("Job Created! 🎉", `"${title}" is now live in your job board.`, "success")
      handleClose()
    } catch {
      toast("Error", "Failed to create job. Please try again.", "error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isAddJobOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Job Listing</DialogTitle>
          <DialogDescription>Fill in all details to post a new opening to your hiring board.</DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-0 mt-2 mb-5">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            const active = i === step
            const done = i < step
            return (
              <div key={s.label} className="flex items-center flex-1">
                <div className={`flex items-center gap-2 text-[12px] font-semibold transition-all ${active ? "text-primary" : done ? "text-sec-green" : "text-txt-disabled"}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all ${active ? "border-primary bg-primary-light" : done ? "border-sec-green bg-sec-green/10" : "border-bg-border bg-bg-primary"}`}>
                    {done ? (
                      <svg className="w-3.5 h-3.5 text-sec-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <Icon className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <span className="hidden sm:block">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-px mx-3 transition-colors ${done ? "bg-sec-green" : "bg-bg-border"}`} />
                )}
              </div>
            )
          })}
        </div>

        <form onSubmit={handleSubmit}>
          {/* ── Step 0: Basics ─────────────────────────────────────────────── */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={labelCls}>Job Title *</label>
                  <Input placeholder="e.g. Senior Frontend Developer" value={title} onChange={(e) => setTitle(e.target.value)} required />
                </div>
                <div>
                  <label className={labelCls}>Location</label>
                  <Input placeholder="e.g. San Francisco, CA" value={location} onChange={(e) => setLocation(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Salary Range</label>
                  <Input placeholder="e.g. $120k – $180k" value={salary} onChange={(e) => setSalary(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Job Type</label>
                  <select value={type} onChange={(e) => setType(e.target.value)} className={selectCls}>
                    {WORK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Work Field / Category *</label>
                  <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={selectCls}>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={remote} onChange={(e) => setRemote(e.target.checked)} className="w-4 h-4 accent-primary rounded cursor-pointer" />
                  <span className="text-[13px] font-medium text-txt-heading">Remote Friendly</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="w-4 h-4 accent-primary rounded cursor-pointer" />
                  <span className="text-[13px] font-medium text-txt-heading">Featured Listing</span>
                </label>
              </div>
            </div>
          )}

          {/* ── Step 1: Description ─────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Job Description (Rich Text) *</label>
                <p className="text-[11.5px] text-txt-caption mb-2.5">
                  Use formatting tools below to add section headings, bullet lists, bold text, or click <strong className="text-primary font-bold">✨ AI Template</strong> to generate a structured job layout.
                </p>
                <RichTextEditor
                  value={description}
                  onChange={setDescription}
                  placeholder="We are seeking an experienced Senior Software Developer to design, develop, and maintain..."
                  minHeight="240px"
                />
              </div>
            </div>
          )}

          {/* ── Step 2: Skills, Requirements, Benefits ─────────────────────── */}
          {step === 2 && (
            <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
              <div>
                <label className={labelCls}>Required Skills *</label>
                <p className="text-[11.5px] text-txt-caption mb-2">Press Enter or click + to add. At least one required.</p>
                <TagInput
                  tags={skills}
                  onAdd={(v) => setSkills([...skills, v])}
                  onRemove={(v) => setSkills(skills.filter((s) => s !== v))}
                  placeholder="e.g. React, TypeScript…"
                />
              </div>
              <div>
                <label className={labelCls}>Requirements *</label>
                <p className="text-[11.5px] text-txt-caption mb-2">Add hiring requirements one by one. At least one required.</p>
                <RequirementsList items={requirements} onChange={setRequirements} />
              </div>
              <div>
                <label className={labelCls}>Benefits & Perks</label>
                <p className="text-[11.5px] text-txt-caption mb-2">Optional — helps attract candidates.</p>
                <TagInput
                  tags={benefits}
                  onAdd={(v) => setBenefits([...benefits, v])}
                  onRemove={(v) => setBenefits(benefits.filter((b) => b !== v))}
                  placeholder="e.g. Unlimited PTO, Equity…"
                  colorClass="bg-sec-green/10 text-sec-green border border-sec-green/20"
                />
              </div>
            </div>
          )}

          <DialogFooter className="mt-6 flex justify-between">
            <div className="flex gap-2">
              {step > 0 && (
                <Button type="button" variant="ghost" onClick={() => setStep((s) => s - 1)} className="cursor-pointer gap-1">
                  <ChevronLeft className="w-4 h-4" /> Back
                </Button>
              )}
              <Button type="button" variant="ghost" onClick={handleClose} className="cursor-pointer">Cancel</Button>
            </div>
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={handleNext} className="cursor-pointer gap-1 shadow-button">
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button type="submit" disabled={loading} className="cursor-pointer gap-1.5 shadow-button min-w-[140px]">
                {loading ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Creating…</>
                ) : (
                  "Post Job Listing"
                )}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

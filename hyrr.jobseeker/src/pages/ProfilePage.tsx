import {
  AnimatedNumber,
  apiFetch,
  Button,
  Card,
  educationSchema,
  emptySalaryRange,
  errorMessage,
  experienceSchema,
  FieldError,
  fieldErrorsOf,
  IconTile,
  Input,
  isSalaryRangeEmpty,
  MonthRangeInput,
  PROFILE_VISIBILITY,
  profileBasicsSchema,
  SalaryRangeInput,
  salaryRangeSchema,
  scopeErrors,
  useJobStore,
  useToast,
  validate,
  YearRangeInput,
  type Currency,
  type CvSuggestions,
  type FieldErrors,
  type SalaryRangeValue,
} from "hyrr.shared"
import {
  Briefcase,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock,
  Code2,
  DollarSign,
  Download,
  ExternalLink,
  FileText,
  Globe,
  GraduationCap,
  Heart,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Save,
  Settings,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"
import React, { useEffect, useRef, useState } from "react"
import { AiUnavailableNote } from "../components/ai-unavailable"
import { CvImportDialog, type CvSection } from "../components/profile/cv-import-dialog"
import { ProfileStrengthCard } from "../components/profile/profile-strength"
import { VerifiedSkills } from "../components/skill-badges"
import { AI_UNAVAILABLE_MESSAGE, useAiAvailable } from "../lib/ai-availability"

/* ══════════════════════════════════════════════════════════════
   Small reusable helpers
══════════════════════════════════════════════════════════════ */

const EMPTY_EXP = {
  role: "",
  company: "",
  startDate: "",
  endDate: null as string | null,
  current: false,
  desc: "",
}
const EMPTY_EDU = {
  school: "",
  degree: "",
  startYear: null as number | null,
  endYear: null as number | null,
}
const YEARS_OPTIONS = [...Array.from({ length: 20 }, (_, i) => String(i)), "20+"]

/** API row → editable row ("YYYY-MM" dates). */
const toExperienceRow = (e: any) => ({
  ...e,
  startDate: e?.startDate ? String(e.startDate).slice(0, 7) : "",
  endDate: e?.current ? null : e?.endDate ? String(e.endDate).slice(0, 7) : null,
  current: !!e?.current,
})
const toEducationRow = (e: any) => ({
  ...e,
  startYear: typeof e?.startYear === "number" ? e.startYear : null,
  endYear: typeof e?.endYear === "number" ? e.endYear : null,
})
const toExperienceInput = (e: any) => ({
  role: String(e.role ?? "").trim(),
  company: String(e.company ?? "").trim(),
  startDate: e.startDate || "",
  endDate: e.current ? null : e.endDate || null,
  current: !!e.current,
  ...(e.desc ? { desc: String(e.desc) } : {}),
})
const toEducationInput = (e: any) => ({
  school: String(e.school ?? "").trim(),
  degree: String(e.degree ?? "").trim(),
  startYear: e.startYear as number,
  endYear: e.endYear ?? null,
})
/** Best effort from CV text like "Jan 2020 – Present" / "2018-2021". */
function datesFromText(text?: string) {
  const years = (text ?? "").match(/(19|20)\d{2}/g) ?? []
  const current = /present|current|now|today/i.test(text ?? "")
  return {
    startDate: years[0] ? `${years[0]}-01` : "",
    endDate: current ? null : years[1] ? `${years[1]}-01` : null,
    current,
  }
}
function yearsFromText(text?: string) {
  const years = (text ?? "").match(/(19|20)\d{2}/g) ?? []
  return {
    startYear: years[0] ? Number(years[0]) : null,
    endYear: years[1] ? Number(years[1]) : null,
  }
}
const withoutPrefix = (errors: FieldErrors, prefix: string) =>
  Object.fromEntries(Object.entries(errors).filter(([k]) => !k.startsWith(`${prefix}.`)))
const prefixed = (errors: FieldErrors, prefix: string) =>
  Object.fromEntries(Object.entries(errors).map(([k, v]) => [`${prefix}.${k}`, v]))

function InfoRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  if (!text) return null
  return (
    <div className="flex items-center gap-2.5 text-[13.5px] text-txt-body">
      <span className="text-txt-caption shrink-0">{icon}</span>
      <span className="truncate font-medium">{text}</span>
    </div>
  )
}

function SectionTitle({
  icon,
  title,
  badge,
}: {
  icon: React.ReactNode
  title: string
  badge?: string | number
}) {
  return (
    <div className="flex items-center justify-between pb-3 mb-4 border-b border-bg-border/50">
      <div className="flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <h3 className="text-[14px] font-bold text-txt-title">{title}</h3>
      </div>
      {badge !== undefined && (
        <span className="text-[12px] font-semibold text-txt-caption">{badge}</span>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Main ProfilePage
══════════════════════════════════════════════════════════════ */
export function ProfilePage() {
  const { toast } = useToast()
  const { documents, setCandidateActiveView, updateProfile, profileStrength } = useJobStore()
  const aiOn = useAiAvailable()
  const [cvImportOpen, setCvImportOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /* ── Loading / saving flags ─────────────────────────────── */
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [addingExp, setAddingExp] = useState(false)
  const [addingEdu, setAddingEdu] = useState(false)
  // Saved entry being edited in the add form (null = adding a new one).
  const [editingExpId, setEditingExpId] = useState<string | null>(null)
  const [editingEduId, setEditingEduId] = useState<string | null>(null)
  const [deletingExpId, setDeletingExpId] = useState<string | null>(null)
  const [deletingEduId, setDeletingEduId] = useState<string | null>(null)

  /* ── Profile state ──────────────────────────────────────── */
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    phone: "",
    location: "",
    title: "",
    website: "",
    github: "",
    linkedin: "",
    bio: "",
    avatar: "",
    joinedAt: "",
  })

  /* ── Career prefs state ─────────────────────────────────── */
  const [prefs, setPrefs] = useState({
    salary: emptySalaryRange("") as SalaryRangeValue,
    preferredType: "Full Time",
    availability: "",
    yearsOfExperience: "",
    preferredLocations: [] as string[],
    visibility: PROFILE_VISIBILITY.PUBLIC as string,
  })
  const [newLocation, setNewLocation] = useState("")

  /* ── Lists ──────────────────────────────────────────────── */
  const [experience, setExperience] = useState<any[]>([])
  const [education, setEducation] = useState<any[]>([])
  const [skills, setSkills] = useState<string[]>([])
  const [languages, setLanguages] = useState<string[]>([])
  const [interests, setInterests] = useState<string[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  useEffect(() => {
    apiFetch("/jobs/categories")
      .then((list) =>
        setCategories(
          (Array.isArray(list) ? list : []).map((c: any) => ({
            id: String(c.id),
            name: String(c.name),
          }))
        )
      )
      .catch(() => undefined)
  }, [])

  /* ── Add-form states ────────────────────────────────────── */
  const [showExpForm, setShowExpForm] = useState(false)
  const [showEduForm, setShowEduForm] = useState(false)
  const [expForm, setExpForm] = useState(EMPTY_EXP)
  const [eduForm, setEduForm] = useState(EMPTY_EDU)
  /** Inline errors: page fields by name, add-forms as "exp.*" / "edu.*", list items as "experiences.N.*". */
  const [errors, setErrors] = useState<FieldErrors>({})
  const clearError = (key: string) =>
    setErrors((e) => {
      if (!(key in e)) return e
      const next = { ...e }
      delete next[key]
      return next
    })
  const [newSkill, setNewSkill] = useState("")
  const [newLang, setNewLang] = useState("")

  /* ═══════════════════════════════════════════════════════════
     Data loading
  ═══════════════════════════════════════════════════════════ */
  const loadProfile = React.useCallback(async () => {
    try {
      setLoading(true)
      const data = await apiFetch("/profile")
      const loadedProfile = {
        name: data.user?.name || "",
        email: data.user?.email || "",
        phone: data.phone || "",
        location: data.location || "",
        title: data.title || "",
        website: data.website || "",
        github: data.github || "",
        linkedin: data.linkedin || "",
        bio: data.bio || "",
        avatar:
          data.user?.avatar ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(data.user?.name || "User")}&background=7c5cfc&color=fff`,
        joinedAt: data.user?.joinedAt || data.user?.createdAt || "",
      }
      const loadedPrefs = {
        salary:
          data.expectedSalaryMin != null && data.expectedSalaryMax != null
            ? {
                min: data.expectedSalaryMin,
                max: data.expectedSalaryMax,
                currency: (data.expectedSalaryCurrency || "") as Currency,
                period: data.expectedSalaryPeriod || "YEAR",
              }
            : emptySalaryRange(""),
        preferredType: data.preferredType || "Full Time",
        availability: data.availability || "",
        yearsOfExperience: data.yearsOfExperience || "",
        preferredLocations: (data.preferredLocations || []) as string[],
        visibility: (data.visibility || PROFILE_VISIBILITY.PUBLIC) as string,
      }
      if (typeof data.profileStrength === "number") {
        useJobStore.setState({
          profileStrength: Math.round(data.profileStrength),
          profileMissing: Array.isArray(data.missing) ? data.missing : [],
        })
      }
      const loadedSkills: string[] = data.skills || []
      const loadedLanguages: string[] = data.languages || []
      const loadedInterests: string[] = (data.interests || []).map((c: any) => String(c.id))
      setInterests(loadedInterests)
      setProfile(loadedProfile)
      setPrefs(loadedPrefs)
      setExperience((data.experiences || []).map(toExperienceRow))
      setEducation((data.educations || []).map(toEducationRow))
      setSkills(loadedSkills)
      setLanguages(loadedLanguages)
      setSavedSnapshot(
        JSON.stringify({
          profile: loadedProfile,
          prefs: loadedPrefs,
          skills: loadedSkills,
          languages: loadedLanguages,
          interests: loadedInterests,
        })
      )
    } catch (err) {
      console.warn("Failed to load profile", err)
      toast("Couldn't load profile", errorMessage(err, "Could not load profile data."), "error")
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  /* ═══════════════════════════════════════════════════════════
     Avatar upload  →  auto-saves avatar to backend
  ═══════════════════════════════════════════════════════════ */
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = "" // allow re-selecting same file

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast("Unsupported image", "Please choose a JPG, PNG or WEBP image.", "error")
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast("Image too large", "Profile photos can be at most 10 MB.", "error")
      return
    }

    setUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const result = await apiFetch("/uploads", { method: "POST", body: formData })
      await updateProfile({ avatar: result.url })
      setProfile((p) => ({ ...p, avatar: result.url }))
      toast("Photo updated", "Profile picture updated successfully!", "success")
    } catch (err) {
      toast("Upload failed", errorMessage(err, "Failed to upload photo."), "error")
    } finally {
      setUploadingAvatar(false)
    }
  }

  /* ═══════════════════════════════════════════════════════════
     One save for everything editable on this page
  ═══════════════════════════════════════════════════════════ */
  const editableSnapshot = JSON.stringify({ profile, prefs, skills, languages, interests })
  // Entries imported from a CV have no id until the profile is saved.
  const hasPendingEntries = experience.some((e) => !e.id) || education.some((e) => !e.id)
  const isDirty =
    savedSnapshot !== null && (editableSnapshot !== savedSnapshot || hasPendingEntries)

  /* ═══════════════════════════════════════════════════════════
     CV import → fills the form (the seeker still presses Save)
  ═══════════════════════════════════════════════════════════ */
  const applyCvSuggestions = (sug: CvSuggestions, sections: Set<CvSection>) => {
    const mergeList = (current: string[], extra: string[]) => {
      const seen = new Set(current.map((v) => v.toLowerCase()))
      return [...current, ...extra.filter((v) => !seen.has(v.toLowerCase()))]
    }
    if (sections.has("title") && sug.title) setProfile((p) => ({ ...p, title: sug.title! }))
    if (sections.has("bio") && sug.bio) setProfile((p) => ({ ...p, bio: sug.bio! }))
    if (sections.has("yearsOfExperience") && sug.yearsOfExperience) {
      const years = String(sug.yearsOfExperience).match(/\d+/)?.[0]
      if (years) setPrefs((p) => ({ ...p, yearsOfExperience: Number(years) >= 20 ? "20+" : years }))
    }
    if (sections.has("skills")) setSkills((cur) => mergeList(cur, sug.skills))
    if (sections.has("languages")) setLanguages((cur) => mergeList(cur, sug.languages))
    if (sections.has("experiences")) {
      setExperience((cur) => {
        const key = (e: any) => `${e.role}|${e.company}`.toLowerCase()
        const seen = new Set(cur.map(key))
        return [
          ...cur,
          ...sug.experiences
            .filter((e) => !seen.has(key(e)))
            .map((e) => ({
              ...e,
              ...datesFromText(e.duration),
            })),
        ]
      })
    }
    if (sections.has("educations")) {
      setEducation((cur) => {
        const key = (e: any) => `${e.school}|${e.degree}`.toLowerCase()
        const seen = new Set(cur.map(key))
        return [
          ...cur,
          ...sug.educations
            .filter((e) => !seen.has(key(e)))
            .map((e) => ({
              ...e,
              ...yearsFromText(e.duration),
            })),
        ]
      })
    }
    toast(
      "Suggestions added",
      "Review the highlighted changes, then press Save Profile.",
      "success"
    )
  }

  // Warn before leaving the page (reload/close) with unsaved edits.
  useEffect(() => {
    if (!isDirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [isDirty])

  /** Shows `found` inline, focuses the first invalid field and returns whether it is valid. */
  const showErrors = (found: FieldErrors) => {
    setErrors(found)
    const first = Object.keys(found)[0]
    if (first) {
      document
        .querySelector<HTMLElement>(`[data-field="${first}"], #pf-${first.replace(/\./g, "-")}`)
        ?.focus()
      toast("Check the highlighted fields", found[first], "error")
    }
    return !first
  }

  const handleSaveAll = async () => {
    const pending = hasPendingEntries
    const found: FieldErrors = {
      ...validate(profileBasicsSchema, {
        ...profile,
        skills,
        languages,
        interests,
        preferredLocations: prefs.preferredLocations,
      }),
      ...validate(salaryRangeSchema, prefs.salary, "salary"),
    }
    if (pending) {
      experience.forEach((e, i) =>
        Object.assign(found, validate(experienceSchema, toExperienceInput(e), `experiences.${i}`))
      )
      education.forEach((e, i) =>
        Object.assign(found, validate(educationSchema, toEducationInput(e), `educations.${i}`))
      )
    }
    if (!showErrors(found)) return
    const salary = prefs.salary
    try {
      setSaving(true)
      await updateProfile({
        name: profile.name.trim(),
        title: profile.title.trim(),
        location: profile.location.trim(),
        phone: profile.phone.trim(),
        // Empty strings clear the stored links.
        website: profile.website.trim(),
        github: profile.github.trim(),
        linkedin: profile.linkedin.trim(),
        bio: profile.bio,
        // All four together, or all null to clear the range.
        ...(isSalaryRangeEmpty(salary)
          ? {
              expectedSalaryMin: null,
              expectedSalaryMax: null,
              expectedSalaryCurrency: null,
              expectedSalaryPeriod: null,
            }
          : {
              expectedSalaryMin: salary.min,
              expectedSalaryMax: salary.max,
              expectedSalaryCurrency: salary.currency,
              expectedSalaryPeriod: salary.period,
            }),
        preferredType: prefs.preferredType,
        availability: prefs.availability.trim(),
        yearsOfExperience: prefs.yearsOfExperience.trim(),
        preferredLocations: prefs.preferredLocations,
        visibility: prefs.visibility,
        skills,
        languages,
        interests,
        // Imported entries are only persisted by sending the full lists (server replaces them).
        ...(hasPendingEntries
          ? {
              experiences: experience.map(toExperienceInput),
              educations: education.map((e) => {
                const v = toEducationInput(e)
                return { ...v, startYear: v.startYear as number }
              }),
            }
          : {}),
      })
      if (hasPendingEntries) {
        // Pick up the ids the server assigned.
        try {
          const fresh = await apiFetch("/profile")
          setExperience((fresh?.experiences || []).map(toExperienceRow))
          setEducation((fresh?.educations || []).map(toEducationRow))
        } catch (e) {
          console.warn("Failed to reload profile entries.", e)
        }
      }
      setSavedSnapshot(editableSnapshot)
      setErrors({})
      toast("Profile saved", "Your profile has been updated.", "success")
    } catch (err) {
      const server = fieldErrorsOf(err)
      if (Object.keys(server).length) {
        // expectedSalaryMin → salary.min, so the error lands on the salary picker.
        const mapped: FieldErrors = {}
        for (const [k, v] of Object.entries(server)) {
          const m = /^expectedSalary(Min|Max|Currency|Period)$/.exec(k)
          mapped[m ? `salary.${m[1].toLowerCase()}` : k] = v
        }
        showErrors(mapped)
      } else toast("Couldn't save profile", errorMessage(err, "Failed to save profile."), "error")
    } finally {
      setSaving(false)
    }
  }

  /* ═══════════════════════════════════════════════════════════
     Experience CRUD
  ═══════════════════════════════════════════════════════════ */
  const handleAddExperience = async () => {
    const input = toExperienceInput(expForm)
    const found = validate(experienceSchema, input, "exp")
    setErrors((e) => ({ ...withoutPrefix(e, "exp"), ...found }))
    if (Object.keys(found).length) return
    setAddingExp(true)
    try {
      const saved = await apiFetch(
        editingExpId ? `/profile/experience/${editingExpId}` : "/profile/experience",
        { method: editingExpId ? "PUT" : "POST", body: JSON.stringify(input) }
      )
      const row = toExperienceRow(saved)
      setExperience((prev) =>
        editingExpId ? prev.map((x) => (x.id === editingExpId ? row : x)) : [...prev, row]
      )
      toast(
        editingExpId ? "Experience updated" : "Experience Added",
        `${expForm.role} at ${expForm.company} ${editingExpId ? "saved" : "added"}.`,
        "success"
      )
      setExpForm(EMPTY_EXP)
      setEditingExpId(null)
      setShowExpForm(false)
    } catch (err: any) {
      const server = fieldErrorsOf(err)
      if (Object.keys(server).length) setErrors((e) => ({ ...e, ...prefixed(server, "exp") }))
      else toast("Error", err?.message || "Failed to save experience.", "error")
    } finally {
      setAddingExp(false)
    }
  }

  const handleDeleteExperience = async (id: string) => {
    setDeletingExpId(id)
    try {
      await apiFetch(`/profile/experience/${id}`, { method: "DELETE" })
      setExperience((prev) => prev.filter((e) => e.id !== id))
      toast("Removed", "Work experience removed.", "info")
    } catch (err: any) {
      toast("Error", err?.message || "Failed to delete experience.", "error")
    } finally {
      setDeletingExpId(null)
    }
  }

  /* ═══════════════════════════════════════════════════════════
     Education CRUD
  ═══════════════════════════════════════════════════════════ */
  const handleAddEducation = async () => {
    const input = toEducationInput(eduForm)
    const found = validate(educationSchema, input, "edu")
    setErrors((e) => ({ ...withoutPrefix(e, "edu"), ...found }))
    if (Object.keys(found).length) return
    setAddingEdu(true)
    try {
      const saved = await apiFetch(
        editingEduId ? `/profile/education/${editingEduId}` : "/profile/education",
        { method: editingEduId ? "PUT" : "POST", body: JSON.stringify(input) }
      )
      const row = toEducationRow(saved)
      setEducation((prev) =>
        editingEduId ? prev.map((x) => (x.id === editingEduId ? row : x)) : [...prev, row]
      )
      toast(
        editingEduId ? "Education updated" : "Education Added",
        `${eduForm.degree} at ${eduForm.school} ${editingEduId ? "saved" : "added"}.`,
        "success"
      )
      setEduForm(EMPTY_EDU)
      setEditingEduId(null)
      setShowEduForm(false)
    } catch (err: any) {
      const server = fieldErrorsOf(err)
      if (Object.keys(server).length) setErrors((e) => ({ ...e, ...prefixed(server, "edu") }))
      else toast("Error", err?.message || "Failed to save education.", "error")
    } finally {
      setAddingEdu(false)
    }
  }

  const handleDeleteEducation = async (id: string) => {
    setDeletingEduId(id)
    try {
      await apiFetch(`/profile/education/${id}`, { method: "DELETE" })
      setEducation((prev) => prev.filter((e) => e.id !== id))
      toast("Removed", "Education removed.", "info")
    } catch (err: any) {
      toast("Error", err?.message || "Failed to delete education.", "error")
    } finally {
      setDeletingEduId(null)
    }
  }

  /* ═══════════════════════════════════════════════════════════
     Completion
  ═══════════════════════════════════════════════════════════ */
  const activeResume = documents.find((d) => d.type === "resume" && d.active)

  const joinedLabel = profile.joinedAt
    ? `Joined ${new Date(profile.joinedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}`
    : ""

  /* ── Loading screen ────────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-[60vh] w-full flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-[13px] text-txt-caption font-semibold">Loading your profile…</p>
      </div>
    )
  }

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleAvatarChange}
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
      />

      {/* ── Page Header ──────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight text-txt-title">My Profile</h1>
          <p className="text-[13px] text-txt-caption font-medium mt-0.5">
            Build your professional identity and let top opportunities find you.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {!aiOn && (
            <div className="basis-full flex justify-end">
              <AiUnavailableNote id="cv-import-ai-off" />
            </div>
          )}
          {isDirty && (
            <span role="status" className="text-[13px] font-semibold text-sec-orange">
              Unsaved changes
            </span>
          )}
          <Button
            variant="secondary"
            onClick={() => setCvImportOpen(true)}
            disabled={!aiOn}
            title={aiOn ? undefined : AI_UNAVAILABLE_MESSAGE}
            aria-describedby={aiOn ? undefined : "cv-import-ai-off"}
            className="gap-2 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            Import from CV
          </Button>
          <Button
            onClick={handleSaveAll}
            disabled={saving || !isDirty}
            className="gap-2 cursor-pointer font-bold"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {saving ? "Saving…" : "Save Profile"}
          </Button>
        </div>
      </div>

      {/* ── Stats Row ────────────────────────────────────── */}
      <div className="stagger grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Profile Completeness */}
        <Card hoverEffect className="tone-card tone-violet group p-4 flex items-center gap-3">
          <IconTile icon={CheckCircle2} tone="violet" />
          <div className="flex-1 min-w-0">
            <p className="text-[11.5px] font-bold text-txt-caption uppercase tracking-wider">
              Profile Strength
            </p>
            <p className="text-[19px] font-black text-txt-title leading-none mt-0.5">
              {profileStrength}%
            </p>
            <div className="w-full h-1.5 bg-bg-border rounded-full overflow-hidden mt-1.5">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${profileStrength}%`,
                  background: "linear-gradient(90deg, var(--tone-fg), #3b7bf0)",
                }}
              />
            </div>
            <p className="text-[11.5px] text-txt-caption mt-1">
              {profileStrength >= 100 ? "Looking great!" : "Keep going! Add more details."}
            </p>
          </div>
        </Card>

        {/* Skills */}
        <Card hoverEffect className="tone-card tone-blue group p-4 flex items-center gap-3">
          <IconTile icon={Code2} tone="blue" />
          <div>
            <p className="text-[11.5px] font-bold text-txt-caption uppercase tracking-wider">
              Skills Listed
            </p>
            <p className="text-[22px] font-black text-txt-title leading-none mt-0.5">
              <AnimatedNumber value={skills.length} />
            </p>
            <p className="text-[11.5px] text-txt-caption">proficiencies</p>
          </div>
        </Card>

        {/* Work History */}
        <Card hoverEffect className="tone-card tone-emerald group p-4 flex items-center gap-3">
          <IconTile icon={Briefcase} tone="emerald" />
          <div>
            <p className="text-[11.5px] font-bold text-txt-caption uppercase tracking-wider">
              Work History
            </p>
            <p className="text-[22px] font-black text-txt-title leading-none mt-0.5">
              <AnimatedNumber value={experience.length} />
            </p>
            <p className="text-[11.5px] text-txt-caption">recorded positions</p>
          </div>
        </Card>

        {/* Resume */}
        <Card hoverEffect className="tone-card tone-amber group p-4 flex items-center gap-3">
          <IconTile icon={FileText} tone="amber" />
          <div>
            <p className="text-[11.5px] font-bold text-txt-caption uppercase tracking-wider">
              Resume
            </p>
            <p className="text-[22px] font-black text-txt-title leading-none mt-0.5">
              {activeResume ? 1 : 0}
            </p>
            <p className="text-[11.5px] text-txt-caption">
              {activeResume ? "active resume" : "no resume yet"}
            </p>
          </div>
        </Card>
      </div>

      {/* ── Main 3-column grid ───────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[260px_1fr_260px] gap-5 items-start">
        {/* ══════════════ LEFT: Profile Card + Checklist ══════════════ */}
        <div className="space-y-4">
          {/* Profile Card */}
          <Card className="overflow-hidden">
            {/* Hero banner */}
            <div
              className="h-[88px] w-full relative"
              style={{ background: "linear-gradient(135deg,#7c5cfc 0%,#3b7ff5 60%,#06b6d4 100%)" }}
            >
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage: "radial-gradient(circle, white 1.5px, transparent 1.5px)",
                  backgroundSize: "16px 16px",
                }}
              />
            </div>

            <div className="px-5 pb-5 -mt-9">
              {/* Avatar with upload button */}
              <div className="relative w-[68px] h-[68px] mx-auto mb-3">
                <img
                  src={profile.avatar}
                  alt={profile.name}
                  className="w-full h-full rounded-full object-cover border-[3px] border-white shadow-md"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  title="Change profile picture"
                  className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-primary border-2 border-white flex items-center justify-center cursor-pointer hover:bg-primary-hover transition-colors shadow-sm disabled:opacity-60"
                >
                  {uploadingAvatar ? (
                    <Loader2 className="w-2 h-2 text-white animate-spin" />
                  ) : (
                    <Camera className="w-2.5 h-2.5 text-white" />
                  )}
                </button>
              </div>

              {/* Name & Title — editable */}
              <div className="text-center mb-4 space-y-1">
                <input
                  id="pf-name"
                  aria-label="Full name"
                  aria-invalid={!!errors.name || undefined}
                  aria-describedby={errors.name ? "pf-name-error" : undefined}
                  value={profile.name}
                  onChange={(e) => {
                    setProfile((p) => ({ ...p, name: e.target.value }))
                    clearError("name")
                  }}
                  placeholder="Your Name"
                  className="w-full text-center text-[15px] font-bold text-txt-title bg-transparent border-b border-transparent hover:border-bg-border focus:border-primary/50 focus:outline-none transition-colors pb-0.5"
                />
                <FieldError id="pf-name-error" message={errors.name} />
                <input
                  id="pf-title"
                  aria-label="Professional title"
                  aria-invalid={!!errors.title || undefined}
                  aria-describedby={errors.title ? "pf-title-error" : undefined}
                  value={profile.title}
                  onChange={(e) => {
                    setProfile((p) => ({ ...p, title: e.target.value }))
                    clearError("title")
                  }}
                  placeholder="Professional title…"
                  className="w-full text-center text-[13px] text-txt-caption bg-transparent border-b border-transparent hover:border-bg-border focus:border-primary/50 focus:outline-none transition-colors pb-0.5"
                />
                <FieldError id="pf-title-error" message={errors.title} />
              </div>

              {/* Contact info rows — editable */}
              <div className="space-y-2.5">
                {[
                  {
                    icon: <MapPin className="w-3.5 h-3.5" />,
                    key: "location",
                    placeholder: "Location…",
                  },
                  {
                    icon: <Mail className="w-3.5 h-3.5" />,
                    key: "email",
                    placeholder: "Email",
                    disabled: true,
                  },
                  {
                    icon: <Phone className="w-3.5 h-3.5" />,
                    key: "phone",
                    placeholder: "+1 (555) 000-0000",
                  },
                  {
                    icon: <Globe className="w-3.5 h-3.5" />,
                    key: "website",
                    placeholder: "yourportfolio.com",
                  },
                ].map(({ icon, key, placeholder, disabled }) => (
                  <div key={key}>
                    <div className="flex items-center gap-2">
                      <span className="text-txt-caption shrink-0">{icon}</span>
                      <input
                        id={`pf-${key}`}
                        aria-label={placeholder}
                        aria-invalid={!!errors[key] || undefined}
                        aria-describedby={errors[key] ? `pf-${key}-error` : undefined}
                        value={(profile as any)[key]}
                        onChange={(e) => {
                          setProfile((p) => ({ ...p, [key]: e.target.value }))
                          clearError(key)
                        }}
                        placeholder={placeholder}
                        disabled={disabled}
                        className={`flex-1 text-[13px] font-medium text-txt-body bg-transparent border-b ${errors[key] ? "border-sec-red/70" : "border-transparent"} hover:border-bg-border focus:border-primary/50 focus:outline-none transition-colors pb-0.5 disabled:opacity-60 disabled:cursor-not-allowed min-w-0`}
                      />
                    </div>
                    <FieldError id={`pf-${key}-error`} message={errors[key]} />
                  </div>
                ))}
                {joinedLabel && (
                  <InfoRow icon={<Calendar className="w-3.5 h-3.5" />} text={joinedLabel} />
                )}
              </div>
            </div>
          </Card>

          {/* Profile strength (server-computed) with next steps */}
          <ProfileStrengthCard
            footer={
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={saving || !isDirty}
                className="mt-4 w-full py-2 rounded-[12px] border border-primary/30 text-primary text-[13px] font-bold hover:bg-primary/5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {saving ? "Saving…" : isDirty ? "Save changes" : "All changes saved"}
              </button>
            }
          />
        </div>

        {/* ══════════════ CENTER: Experience, Education, Skills, Languages, Resume ══════════════ */}
        <div className="space-y-5">
          {/* ── Work Experience ──────────────────────────────────────── */}
          <Card className="p-5">
            <SectionTitle
              icon={<Briefcase className="w-4 h-4" />}
              title="Work Experience"
              badge={`${experience.length} recorded`}
            />

            {/* Existing entries */}
            {experience.length > 0 && (
              <div className="space-y-4 mb-4">
                {experience.map((exp, i) => (
                  <div key={exp.id || i} className="flex gap-3 group">
                    <div className="flex flex-col items-center shrink-0 mt-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-primary/10" />
                      {i !== experience.length - 1 && (
                        <div className="w-px bg-bg-border flex-1 my-1.5" />
                      )}
                    </div>
                    <div className="flex-1 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[13px] font-bold text-txt-heading">
                            {exp.role}
                            {!exp.id && (
                              <span className="ml-2 rounded-full bg-primary-light px-2 py-0.5 text-[11px] font-semibold text-primary">
                                Imported · unsaved
                              </span>
                            )}
                          </p>
                          <p className="text-[13px] text-txt-caption font-medium">
                            {exp.company}
                            {exp.duration ? ` · ${exp.duration}` : ""}
                          </p>
                          {exp.desc && (
                            <p className="text-[13px] text-txt-body mt-1 leading-relaxed">
                              {exp.desc}
                            </p>
                          )}
                          {!exp.id && (
                            <div className="mt-2">
                              <MonthRangeInput
                                id={`pf-experiences-${i}`}
                                startDate={exp.startDate || ""}
                                endDate={exp.endDate ?? null}
                                current={!!exp.current}
                                errors={scopeErrors(errors, `experiences.${i}`)}
                                onChange={(v) =>
                                  setExperience((prev) =>
                                    prev.map((x) => (x === exp ? { ...x, ...v } : x))
                                  )
                                }
                              />
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0">
                          {exp.id && (
                            <button
                              onClick={() => {
                                setExpForm({
                                  role: exp.role || "",
                                  company: exp.company || "",
                                  startDate: exp.startDate || "",
                                  endDate: exp.endDate ?? null,
                                  current: !!exp.current,
                                  desc: exp.desc || "",
                                })
                                setEditingExpId(exp.id)
                                setErrors((e) => withoutPrefix(e, "exp"))
                                setShowExpForm(true)
                              }}
                              aria-label={`Edit ${exp.role}`}
                              title="Edit"
                              className="p-1.5 rounded-lg hover:bg-bg-hover text-txt-caption hover:text-primary opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() =>
                              exp.id
                                ? handleDeleteExperience(exp.id)
                                : setExperience((prev) => prev.filter((x) => x !== exp))
                            }
                            disabled={!!exp.id && deletingExpId === exp.id}
                            aria-label={`Remove ${exp.role}`}
                            className="p-1.5 rounded-lg hover:bg-bg-hover text-txt-caption hover:text-sec-red opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all cursor-pointer shrink-0"
                            title="Remove"
                          >
                            {deletingExpId === exp.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {experience.length === 0 && !showExpForm && (
              <div className="flex flex-col items-center py-8 text-center">
                <div className="w-10 h-10 rounded-full bg-bg-primary border border-dashed border-bg-border flex items-center justify-center mb-3">
                  <Plus className="w-5 h-5 text-txt-caption" />
                </div>
                <p className="text-[13px] font-semibold text-txt-heading mb-1">
                  Add Your Work Experience
                </p>
                <p className="text-[13px] text-txt-caption max-w-[280px]">
                  Share your work history to help employers understand your background.
                </p>
              </div>
            )}

            {/* Inline add form */}
            {showExpForm ? (
              <div className="p-4 rounded-[14px] bg-bg-primary border border-bg-border/60 space-y-3 mt-2">
                <p className="text-[13px] font-bold text-txt-heading">New Position</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11.5px] font-bold text-txt-caption uppercase tracking-wider block mb-1">
                      Job Title *
                    </label>
                    <Input
                      id="pf-exp-role"
                      placeholder="e.g. Senior Developer"
                      value={expForm.role}
                      onChange={(e) => setExpForm((f) => ({ ...f, role: e.target.value }))}
                      aria-invalid={!!errors["exp.role"] || undefined}
                      className="h-8 text-[13px]"
                    />
                    <FieldError id="pf-exp-role-error" message={errors["exp.role"]} />
                  </div>
                  <div>
                    <label className="text-[11.5px] font-bold text-txt-caption uppercase tracking-wider block mb-1">
                      Company *
                    </label>
                    <Input
                      id="pf-exp-company"
                      placeholder="e.g. Google"
                      value={expForm.company}
                      onChange={(e) => setExpForm((f) => ({ ...f, company: e.target.value }))}
                      aria-invalid={!!errors["exp.company"] || undefined}
                      className="h-8 text-[13px]"
                    />
                    <FieldError id="pf-exp-company-error" message={errors["exp.company"]} />
                  </div>
                </div>
                <MonthRangeInput
                  id="pf-exp"
                  startDate={expForm.startDate}
                  endDate={expForm.endDate}
                  current={expForm.current}
                  errors={scopeErrors(errors, "exp")}
                  onChange={(v) => setExpForm((f) => ({ ...f, ...v }))}
                />
                <div>
                  <label className="text-[11.5px] font-bold text-txt-caption uppercase tracking-wider block mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Key achievements or responsibilities…"
                    value={expForm.desc}
                    onChange={(e) => setExpForm((f) => ({ ...f, desc: e.target.value }))}
                    maxLength={2000}
                    className="w-full p-2.5 rounded-[10px] border border-bg-border bg-bg-secondary text-[13px] text-txt-body placeholder:text-txt-caption resize-none focus:outline-none focus:border-primary/40 transition-all"
                  />
                  <FieldError id="pf-exp-desc-error" message={errors["exp.desc"]} />
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setShowExpForm(false)
                      setExpForm(EMPTY_EXP)
                      setEditingExpId(null)
                      setErrors((e) => withoutPrefix(e, "exp"))
                    }}
                    className="px-3 py-1.5 rounded-[10px] text-[13px] font-semibold text-txt-caption hover:bg-bg-hover transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <Button
                    size="sm"
                    onClick={handleAddExperience}
                    disabled={addingExp}
                    className="gap-1.5 cursor-pointer"
                  >
                    {addingExp ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : editingExpId ? (
                      <Save className="w-3 h-3" />
                    ) : (
                      <Plus className="w-3 h-3" />
                    )}
                    {editingExpId ? "Save changes" : "Add Experience"}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowExpForm(true)}
                className="gap-1.5 cursor-pointer mt-2"
              >
                <Plus className="w-3.5 h-3.5" /> Add Experience
              </Button>
            )}
          </Card>

          {/* ── Education ──────────────────────────────────────────── */}
          <Card className="p-5">
            <SectionTitle
              icon={<GraduationCap className="w-4 h-4" />}
              title="Education & Qualifications"
              badge={`${education.length} recorded`}
            />

            {/* Existing entries */}
            {education.length > 0 && (
              <div className="space-y-3 mb-4">
                {education.map((edu, i) => (
                  <div key={edu.id || i} className="flex gap-3 group">
                    <div className="w-2.5 h-2.5 rounded-full bg-sec-blue ring-4 ring-sec-blue/10 mt-1.5 shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[13px] font-bold text-txt-heading">{edu.school}</p>
                          <p className="text-[13px] text-txt-caption font-medium">
                            {edu.degree}
                            {edu.duration ? ` · ${edu.duration}` : ""}
                          </p>
                          {!edu.id && (
                            <div className="mt-2">
                              <YearRangeInput
                                id={`pf-educations-${i}`}
                                startYear={edu.startYear ?? null}
                                endYear={edu.endYear ?? null}
                                errors={scopeErrors(errors, `educations.${i}`)}
                                onChange={(v) =>
                                  setEducation((prev) =>
                                    prev.map((x) => (x === edu ? { ...x, ...v } : x))
                                  )
                                }
                              />
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0">
                          {edu.id && (
                            <button
                              onClick={() => {
                                setEduForm({
                                  school: edu.school || "",
                                  degree: edu.degree || "",
                                  startYear: edu.startYear ?? null,
                                  endYear: edu.endYear ?? null,
                                })
                                setEditingEduId(edu.id)
                                setErrors((e) => withoutPrefix(e, "edu"))
                                setShowEduForm(true)
                              }}
                              aria-label={`Edit ${edu.degree}`}
                              title="Edit"
                              className="p-1.5 rounded-lg hover:bg-bg-hover text-txt-caption hover:text-primary opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() =>
                              edu.id
                                ? handleDeleteEducation(edu.id)
                                : setEducation((prev) => prev.filter((x) => x !== edu))
                            }
                            disabled={!!edu.id && deletingEduId === edu.id}
                            aria-label={`Remove ${edu.degree}`}
                            className="p-1.5 rounded-lg hover:bg-bg-hover text-txt-caption hover:text-sec-red opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all cursor-pointer shrink-0"
                            title="Remove"
                          >
                            {deletingEduId === edu.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {education.length === 0 && !showEduForm && (
              <div className="flex flex-col items-center py-8 text-center">
                <div className="w-10 h-10 rounded-full bg-bg-primary border border-dashed border-bg-border flex items-center justify-center mb-3">
                  <Plus className="w-5 h-5 text-txt-caption" />
                </div>
                <p className="text-[13px] font-semibold text-txt-heading mb-1">
                  Add Your Education
                </p>
                <p className="text-[13px] text-txt-caption max-w-[280px]">
                  Add your degrees, certifications, and relevant coursework.
                </p>
              </div>
            )}

            {/* Inline add form */}
            {showEduForm ? (
              <div className="p-4 rounded-[14px] bg-bg-primary border border-bg-border/60 space-y-3 mt-2">
                <p className="text-[13px] font-bold text-txt-heading">New Education</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11.5px] font-bold text-txt-caption uppercase tracking-wider block mb-1">
                      Institution *
                    </label>
                    <Input
                      id="pf-edu-school"
                      placeholder="e.g. MIT"
                      value={eduForm.school}
                      onChange={(e) => setEduForm((f) => ({ ...f, school: e.target.value }))}
                      aria-invalid={!!errors["edu.school"] || undefined}
                      className="h-8 text-[13px]"
                    />
                    <FieldError id="pf-edu-school-error" message={errors["edu.school"]} />
                  </div>
                  <div>
                    <label className="text-[11.5px] font-bold text-txt-caption uppercase tracking-wider block mb-1">
                      Degree *
                    </label>
                    <Input
                      id="pf-edu-degree"
                      placeholder="e.g. B.S. Computer Science"
                      value={eduForm.degree}
                      onChange={(e) => setEduForm((f) => ({ ...f, degree: e.target.value }))}
                      aria-invalid={!!errors["edu.degree"] || undefined}
                      className="h-8 text-[13px]"
                    />
                    <FieldError id="pf-edu-degree-error" message={errors["edu.degree"]} />
                  </div>
                </div>
                <YearRangeInput
                  id="pf-edu"
                  startYear={eduForm.startYear}
                  endYear={eduForm.endYear}
                  errors={scopeErrors(errors, "edu")}
                  onChange={(v) => setEduForm((f) => ({ ...f, ...v }))}
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setShowEduForm(false)
                      setEduForm(EMPTY_EDU)
                      setEditingEduId(null)
                      setErrors((e) => withoutPrefix(e, "edu"))
                    }}
                    className="px-3 py-1.5 rounded-[10px] text-[13px] font-semibold text-txt-caption hover:bg-bg-hover transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <Button
                    size="sm"
                    onClick={handleAddEducation}
                    disabled={addingEdu}
                    className="gap-1.5 cursor-pointer"
                  >
                    {addingEdu ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : editingEduId ? (
                      <Save className="w-3 h-3" />
                    ) : (
                      <Plus className="w-3 h-3" />
                    )}
                    {editingEduId ? "Save changes" : "Add Education"}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowEduForm(true)}
                className="gap-1.5 cursor-pointer mt-2"
              >
                <Plus className="w-3.5 h-3.5" /> Add Education
              </Button>
            )}
          </Card>

          {/* ── Bottom row: Skills | Languages | Resume ─────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Core Technical Skills */}
            <Card className="p-5 flex flex-col gap-3">
              <SectionTitle
                icon={<span className="text-[13px] font-black">&lt;/&gt;</span>}
                title="Core Technical Skills"
                badge={`${skills.length} skills`}
              />

              {skills.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {skills.map((sk) => (
                    <span
                      key={sk}
                      className="inline-flex items-center gap-1 text-[12px] font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full"
                    >
                      {sk}
                      <button
                        type="button"
                        aria-label={`Remove ${sk}`}
                        onClick={() => setSkills(skills.filter((s) => s !== sk))}
                        className="text-primary hover:text-sec-red cursor-pointer ml-0.5"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center py-3 text-center">
                  <div className="w-8 h-8 rounded-full bg-bg-primary border border-dashed border-bg-border flex items-center justify-center mb-1.5">
                    <Plus className="w-4 h-4 text-txt-caption" />
                  </div>
                  <p className="text-[12.5px] font-semibold text-txt-heading">Add Your Skills</p>
                  <p className="text-[12px] text-txt-caption">
                    Technologies and tools you work with.
                  </p>
                </div>
              )}

              <div className="flex gap-1.5 mt-auto">
                <Input
                  placeholder="Add a skill…"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newSkill.trim() && !skills.includes(newSkill.trim())) {
                      setSkills([...skills, newSkill.trim()])
                      setNewSkill("")
                    }
                  }}
                  className="h-7 text-[12.5px] flex-1"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
                      setSkills([...skills, newSkill.trim()])
                      setNewSkill("")
                    }
                  }}
                  className="h-7 px-2.5 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
            </Card>

            {/* Languages Spoken */}
            <Card className="p-5 flex flex-col gap-3">
              <SectionTitle
                icon={<Globe className="w-4 h-4" />}
                title="Languages Spoken"
                badge={`${languages.length} languages`}
              />

              {languages.length > 0 ? (
                <div className="space-y-1.5">
                  {languages.map((lang) => (
                    <div
                      key={lang}
                      className="flex items-center justify-between px-2.5 py-1 rounded-[8px] bg-bg-primary border border-bg-border/40"
                    >
                      <span className="text-[13px] font-semibold text-txt-heading">{lang}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${lang}`}
                        onClick={() => setLanguages(languages.filter((l) => l !== lang))}
                        className="text-txt-caption hover:text-sec-red cursor-pointer transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center py-3 text-center">
                  <div className="w-8 h-8 rounded-full bg-bg-primary border border-dashed border-bg-border flex items-center justify-center mb-1.5">
                    <Plus className="w-4 h-4 text-txt-caption" />
                  </div>
                  <p className="text-[12.5px] font-semibold text-txt-heading">Add Languages</p>
                  <p className="text-[12px] text-txt-caption">Languages you speak.</p>
                </div>
              )}

              <div className="flex gap-1.5 mt-auto">
                <Input
                  placeholder="e.g. Spanish (Native)…"
                  value={newLang}
                  onChange={(e) => setNewLang(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      newLang.trim() &&
                      !languages.includes(newLang.trim())
                    ) {
                      setLanguages([...languages, newLang.trim()])
                      setNewLang("")
                    }
                  }}
                  className="h-7 text-[12.5px] flex-1"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    if (newLang.trim() && !languages.includes(newLang.trim())) {
                      setLanguages([...languages, newLang.trim()])
                      setNewLang("")
                    }
                  }}
                  className="h-7 px-2.5 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
            </Card>

            {/* Preferred categories (matching boosts jobs in these fields) */}
            <Card className="p-5 flex flex-col gap-3" data-field="interests" tabIndex={-1}>
              <SectionTitle
                icon={<Briefcase className="w-4 h-4" />}
                title="Preferred categories"
                badge={`${interests.length}/10`}
              />
              <p className="text-[12px] text-txt-caption">
                Jobs in these fields rank higher in Discover.
              </p>
              {categories.length === 0 ? (
                <p className="text-[12px] text-txt-caption">Loading categories…</p>
              ) : (
                <div
                  role="group"
                  aria-label="Preferred categories"
                  aria-describedby={errors.interests ? "pf-interests-error" : undefined}
                  className="flex flex-wrap gap-1.5"
                >
                  {categories.map((c) => {
                    const on = interests.includes(c.id)
                    return (
                      <button
                        key={c.id}
                        type="button"
                        aria-pressed={on}
                        disabled={!on && interests.length >= 10}
                        onClick={() => {
                          setInterests((cur) =>
                            on ? cur.filter((id) => id !== c.id) : [...cur, c.id]
                          )
                          clearError("interests")
                        }}
                        className={`rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                          on
                            ? "border-primary-border bg-primary-light text-primary"
                            : "border-bg-border text-txt-body hover:bg-bg-hover"
                        }`}
                      >
                        {c.name}
                      </button>
                    )
                  })}
                </div>
              )}
              <FieldError id="pf-interests-error" message={errors.interests} />
            </Card>

            {/* Active Resume */}
            <Card className="p-5 flex flex-col gap-3">
              <SectionTitle icon={<FileText className="w-4 h-4" />} title="Active Resume" />

              {activeResume ? (
                <>
                  <div className="p-3 rounded-[12px] bg-bg-primary border border-bg-border/60">
                    <div className="flex items-center gap-2 mb-2.5">
                      <div className="w-8 h-8 rounded-lg bg-sec-red/10 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-sec-red" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-[12.5px] font-semibold text-txt-heading truncate"
                          title={activeResume.name}
                        >
                          {activeResume.name}
                        </p>
                        <p className="text-[11.5px] text-txt-caption">
                          {activeResume.size} · Updated{" "}
                          {new Date(activeResume.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <a
                        href={activeResume.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-center py-1.5 rounded-[8px] bg-bg-secondary border border-bg-border text-[12px] font-bold text-txt-heading hover:bg-bg-hover transition-colors"
                      >
                        Preview
                      </a>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1 text-[12px] cursor-pointer h-7"
                        onClick={() => setCandidateActiveView("Documents")}
                      >
                        Manage
                      </Button>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full cursor-pointer text-[12.5px] gap-1.5"
                    onClick={() => setCandidateActiveView("Documents")}
                  >
                    <Plus className="w-3.5 h-3.5" /> Upload New Resume
                  </Button>
                </>
              ) : (
                <div className="flex flex-col items-center py-4 text-center">
                  <div className="w-9 h-9 rounded-full bg-bg-primary border border-dashed border-bg-border flex items-center justify-center mb-2">
                    <FileText className="w-4 h-4 text-txt-caption" />
                  </div>
                  <p className="text-[12.5px] font-semibold text-txt-heading mb-0.5">
                    No Active Resume
                  </p>
                  <p className="text-[12px] text-txt-caption mb-3">Upload to apply to jobs.</p>
                  <Button
                    size="sm"
                    className="cursor-pointer text-[12px] gap-1.5 w-full"
                    onClick={() => setCandidateActiveView("Documents")}
                  >
                    <Plus className="w-3.5 h-3.5" /> Upload Resume
                  </Button>
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* ══════════════ RIGHT: Prefs + About Me + Quick Links ══════════════ */}
        <div className="space-y-4">
          {/* Career Preferences */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" />
                <h3 className="text-[13px] font-bold text-txt-title">Career Preferences</h3>
              </div>
            </div>

            <div className="space-y-3.5">
              <SalaryRangeInput
                id="pf-salary"
                stacked
                label="Expected salary"
                value={prefs.salary}
                onChange={(salary) => {
                  setPrefs((p) => ({ ...p, salary }))
                  setErrors((e) => withoutPrefix(e, "salary"))
                }}
                errors={scopeErrors(errors, "salary")}
              />

              <div>
                <p className="text-[11.5px] font-bold text-txt-caption uppercase tracking-wider mb-1">
                  Years of Experience
                </p>
                <div className="relative">
                  <Clock className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-txt-caption" />
                  <select
                    id="pf-yearsOfExperience"
                    aria-label="Years of experience"
                    value={prefs.yearsOfExperience}
                    onChange={(e) => setPrefs((p) => ({ ...p, yearsOfExperience: e.target.value }))}
                    className="w-full pl-7 pr-3 py-1.5 rounded-[10px] border border-bg-border bg-bg-primary text-[13px] text-txt-body focus:outline-none focus:border-primary/40 transition-all font-medium cursor-pointer"
                  >
                    <option value="">Select…</option>
                    {YEARS_OPTIONS.map((y) => (
                      <option key={y} value={y}>
                        {y === "0"
                          ? "Less than 1 year"
                          : y === "20+"
                            ? "20+ years"
                            : `${y} year${y === "1" ? "" : "s"}`}
                      </option>
                    ))}
                    {prefs.yearsOfExperience &&
                      !YEARS_OPTIONS.includes(prefs.yearsOfExperience) && (
                        <option value={prefs.yearsOfExperience}>{prefs.yearsOfExperience}</option>
                      )}
                  </select>
                </div>
              </div>

              <div>
                <p className="text-[11.5px] font-bold text-txt-caption uppercase tracking-wider mb-1.5">
                  Work Arrangement
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {["Full Time", "Part Time", "Contract", "Remote"].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setPrefs((p) => ({ ...p, preferredType: t }))}
                      className={`px-2.5 py-1 rounded-[8px] text-[12px] font-semibold cursor-pointer border transition-all ${
                        prefs.preferredType === t
                          ? "bg-primary text-white border-primary"
                          : "bg-bg-primary text-txt-body border-bg-border hover:border-primary/30"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[11.5px] font-bold text-txt-caption uppercase tracking-wider mb-1">
                  Availability
                </p>
                <input
                  value={prefs.availability}
                  onChange={(e) => setPrefs((p) => ({ ...p, availability: e.target.value }))}
                  placeholder="e.g. Immediate / 2 weeks notice"
                  className="w-full px-3 py-1.5 rounded-[10px] border border-bg-border bg-bg-primary text-[13px] text-txt-body placeholder:text-txt-caption focus:outline-none focus:border-primary/40 transition-all font-medium"
                />
              </div>

              <div>
                <p className="text-[11.5px] font-bold text-txt-caption uppercase tracking-wider mb-1.5">
                  Preferred Locations
                </p>
                {prefs.preferredLocations.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {prefs.preferredLocations.map((loc) => (
                      <span
                        key={loc}
                        className="inline-flex items-center gap-1 text-[12px] font-semibold text-txt-heading bg-bg-primary border border-bg-border px-2 py-0.5 rounded-full"
                      >
                        {loc}
                        <button
                          type="button"
                          aria-label={`Remove ${loc}`}
                          onClick={() =>
                            setPrefs((p) => ({
                              ...p,
                              preferredLocations: p.preferredLocations.filter((l) => l !== loc),
                            }))
                          }
                          className="text-txt-caption hover:text-sec-red cursor-pointer"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <input
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  onKeyDown={(e) => {
                    const v = newLocation.trim()
                    if (e.key === "Enter" && v && !prefs.preferredLocations.includes(v)) {
                      e.preventDefault()
                      setPrefs((p) => ({ ...p, preferredLocations: [...p.preferredLocations, v] }))
                      setNewLocation("")
                    }
                  }}
                  aria-label="Add preferred location"
                  placeholder="Add a city or Remote, press Enter"
                  className="w-full px-3 py-1.5 rounded-[10px] border border-bg-border bg-bg-primary text-[13px] text-txt-body placeholder:text-txt-caption focus:outline-none focus:border-primary/40 transition-all font-medium"
                />
              </div>

              <div>
                <p className="text-[11.5px] font-bold text-txt-caption uppercase tracking-wider mb-1.5">
                  Profile Visibility
                </p>
                <div role="radiogroup" aria-label="Profile visibility" className="flex gap-1.5">
                  {[
                    { value: PROFILE_VISIBILITY.PUBLIC, label: "Public" },
                    { value: PROFILE_VISIBILITY.PRIVATE, label: "Private" },
                  ].map((v) => (
                    <button
                      key={v.value}
                      type="button"
                      role="radio"
                      aria-checked={prefs.visibility === v.value}
                      onClick={() => setPrefs((p) => ({ ...p, visibility: v.value }))}
                      className={`px-2.5 py-1 rounded-[8px] text-[12px] font-semibold cursor-pointer border transition-all ${
                        prefs.visibility === v.value
                          ? "bg-primary text-white border-primary"
                          : "bg-bg-primary text-txt-body border-bg-border hover:border-primary/30"
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11.5px] text-txt-caption mt-1">
                  {prefs.visibility === PROFILE_VISIBILITY.PRIVATE
                    ? "Only recruiters you apply to can see your profile."
                    : "Recruiters can discover your profile."}
                </p>
              </div>
            </div>
          </Card>

          {/* About Me */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-bold text-txt-title">About Me</h3>
            </div>
            <textarea
              rows={5}
              value={profile.bio}
              onChange={(e) => {
                setProfile((p) => ({ ...p, bio: e.target.value }))
                clearError("bio")
              }}
              id="pf-bio"
              maxLength={4000}
              aria-invalid={!!errors.bio || undefined}
              placeholder="Briefly describe your background, tech stack, and what you excel at…"
              className="w-full p-3 rounded-[12px] border border-bg-border bg-bg-primary text-[13.5px] text-txt-body placeholder:text-txt-caption resize-none focus:outline-none focus:border-primary/40 transition-all font-medium leading-relaxed"
            />
            <div className="flex justify-between">
              <FieldError id="pf-bio-error" message={errors.bio} />
              <span className="ml-auto text-[11px] text-txt-caption tabular-nums">
                {profile.bio.length} / 4,000
              </span>
            </div>
            {/* Social links */}
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-txt-caption shrink-0" />
                <input
                  id="pf-github"
                  aria-invalid={!!errors.github || undefined}
                  aria-describedby={errors.github ? "pf-github-error" : undefined}
                  value={profile.github}
                  onChange={(e) => {
                    setProfile((p) => ({ ...p, github: e.target.value }))
                    clearError("github")
                  }}
                  placeholder="GitHub URL"
                  aria-label="GitHub URL"
                  type="url"
                  className="flex-1 text-[13px] text-txt-body bg-transparent border-b border-transparent hover:border-bg-border focus:border-primary/50 focus:outline-none transition-colors pb-0.5 placeholder:text-txt-caption"
                />
              </div>
              <div className="flex items-center gap-2">
                <ExternalLink className="w-3.5 h-3.5 text-txt-caption shrink-0" />
                <input
                  id="pf-linkedin"
                  aria-invalid={!!errors.linkedin || undefined}
                  aria-describedby={errors.linkedin ? "pf-linkedin-error" : undefined}
                  value={profile.linkedin}
                  onChange={(e) => {
                    setProfile((p) => ({ ...p, linkedin: e.target.value }))
                    clearError("linkedin")
                  }}
                  placeholder="LinkedIn URL"
                  aria-label="LinkedIn URL"
                  type="url"
                  className="flex-1 text-[13px] text-txt-body bg-transparent border-b border-transparent hover:border-bg-border focus:border-primary/50 focus:outline-none transition-colors pb-0.5 placeholder:text-txt-caption"
                />
              </div>
              <FieldError id="pf-github-error" message={errors.github} />
              <FieldError id="pf-linkedin-error" message={errors.linkedin} />
            </div>
          </Card>

          {/* Quick Links */}
          <Card className="p-5">
            <h3 className="text-[13px] font-bold text-txt-title mb-3">Quick Links</h3>
            <div className="space-y-0.5">
              {[
                {
                  icon: <Download className="w-3.5 h-3.5" />,
                  label: "Download Resume",
                  action: () =>
                    activeResume
                      ? window.open(activeResume.url, "_blank")
                      : setCandidateActiveView("Documents"),
                },
                {
                  icon: <FileText className="w-3.5 h-3.5" />,
                  label: "View Applications",
                  action: () => setCandidateActiveView("Applications"),
                },
                {
                  icon: <Heart className="w-3.5 h-3.5" />,
                  label: "Saved Jobs",
                  action: () => setCandidateActiveView("Applications"),
                },
                {
                  icon: <FileText className="w-3.5 h-3.5" />,
                  label: "Document Library",
                  action: () => setCandidateActiveView("Documents"),
                },
                {
                  icon: <Settings className="w-3.5 h-3.5" />,
                  label: "Account Settings",
                  action: () => setCandidateActiveView("Settings"),
                },
              ].map((link) => (
                <button
                  type="button"
                  key={link.label}
                  onClick={link.action}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-[10px] hover:bg-bg-primary text-left transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-txt-caption group-hover:text-primary transition-colors">
                      {link.icon}
                    </span>
                    <span className="text-[13.5px] font-medium text-txt-body group-hover:text-txt-heading transition-colors">
                      {link.label}
                    </span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-txt-caption group-hover:text-primary transition-colors" />
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
      <CvImportDialog
        open={cvImportOpen}
        onOpenChange={setCvImportOpen}
        onApply={applyCvSuggestions}
      />

      <VerifiedSkills />
    </div>
  )
}

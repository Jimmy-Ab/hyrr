import {
  apiFetch,
  Button,
  Card,
  errorMessage,
  Input,
  PROFILE_VISIBILITY,
  useJobStore,
  useToast,
} from "hyrr.shared"
import {
  Briefcase,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock,
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
  Phone,
  Plus,
  Save,
  Settings,
  Trash2,
  X,
} from "lucide-react"
import React, { useEffect, useRef, useState } from "react"

/* ══════════════════════════════════════════════════════════════
   Small reusable helpers
══════════════════════════════════════════════════════════════ */

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
  const { documents, setCandidateActiveView, updateProfile } = useJobStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  /* ── Loading / saving flags ─────────────────────────────── */
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [addingExp, setAddingExp] = useState(false)
  const [addingEdu, setAddingEdu] = useState(false)
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
    expectedSalary: "",
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

  /* ── Add-form states ────────────────────────────────────── */
  const [showExpForm, setShowExpForm] = useState(false)
  const [showEduForm, setShowEduForm] = useState(false)
  const [expForm, setExpForm] = useState({ role: "", company: "", duration: "", desc: "" })
  const [eduForm, setEduForm] = useState({ school: "", degree: "", duration: "" })
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
        expectedSalary: data.expectedSalary || "",
        preferredType: data.preferredType || "Full Time",
        availability: data.availability || "",
        yearsOfExperience: data.yearsOfExperience || "",
        preferredLocations: (data.preferredLocations || []) as string[],
        visibility: (data.visibility || PROFILE_VISIBILITY.PUBLIC) as string,
      }
      const loadedSkills: string[] = data.skills || []
      const loadedLanguages: string[] = data.languages || []
      setProfile(loadedProfile)
      setPrefs(loadedPrefs)
      setExperience(data.experiences || [])
      setEducation(data.educations || [])
      setSkills(loadedSkills)
      setLanguages(loadedLanguages)
      setSavedSnapshot(
        JSON.stringify({
          profile: loadedProfile,
          prefs: loadedPrefs,
          skills: loadedSkills,
          languages: loadedLanguages,
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
  const editableSnapshot = JSON.stringify({ profile, prefs, skills, languages })
  const isDirty = savedSnapshot !== null && editableSnapshot !== savedSnapshot

  // Warn before leaving the page (reload/close) with unsaved edits.
  useEffect(() => {
    if (!isDirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [isDirty])

  const handleSaveAll = async () => {
    if (!profile.name.trim()) {
      toast("Name required", "Please enter your full name.", "error")
      return
    }
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
        expectedSalary: prefs.expectedSalary.trim(),
        preferredType: prefs.preferredType,
        availability: prefs.availability.trim(),
        yearsOfExperience: prefs.yearsOfExperience.trim(),
        preferredLocations: prefs.preferredLocations,
        visibility: prefs.visibility,
        skills,
        languages,
      })
      setSavedSnapshot(editableSnapshot)
      toast("Profile saved", "Your profile has been updated.", "success")
    } catch (err) {
      toast("Couldn't save profile", errorMessage(err, "Failed to save profile."), "error")
    } finally {
      setSaving(false)
    }
  }

  /* ═══════════════════════════════════════════════════════════
     Experience CRUD
  ═══════════════════════════════════════════════════════════ */
  const handleAddExperience = async () => {
    if (!expForm.role.trim() || !expForm.company.trim()) {
      toast("Required", "Please fill in role and company.", "info")
      return
    }
    setAddingExp(true)
    try {
      const created = await apiFetch("/profile/experience", {
        method: "POST",
        body: JSON.stringify({
          role: expForm.role.trim(),
          company: expForm.company.trim(),
          duration: expForm.duration.trim() || "Present",
          desc: expForm.desc.trim(),
        }),
      })
      setExperience((prev) => [...prev, created])
      setExpForm({ role: "", company: "", duration: "", desc: "" })
      setShowExpForm(false)
      toast("Experience Added", `${expForm.role} at ${expForm.company} added.`, "success")
    } catch (err: any) {
      toast("Error", err?.message || "Failed to add experience.", "error")
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
    if (!eduForm.school.trim() || !eduForm.degree.trim()) {
      toast("Required", "Please fill in school and degree.", "info")
      return
    }
    setAddingEdu(true)
    try {
      const created = await apiFetch("/profile/education", {
        method: "POST",
        body: JSON.stringify({
          school: eduForm.school.trim(),
          degree: eduForm.degree.trim(),
          duration: eduForm.duration.trim() || "",
        }),
      })
      setEducation((prev) => [...prev, created])
      setEduForm({ school: "", degree: "", duration: "" })
      setShowEduForm(false)
      toast("Education Added", `${eduForm.degree} at ${eduForm.school} added.`, "success")
    } catch (err: any) {
      toast("Error", err?.message || "Failed to add education.", "error")
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

  const completionItems = [
    { label: "Profile photo", done: !!profile.avatar && !profile.avatar.includes("ui-avatars") },
    { label: "Headline & Title", done: !!profile.title },
    { label: "Location", done: !!profile.location },
    { label: "Bio / Summary", done: !!profile.bio },
    { label: "Work experience", done: experience.length > 0 },
    { label: "Education", done: education.length > 0 },
    { label: "Skills (5+)", done: skills.length >= 5 },
    { label: "Resume upload", done: !!activeResume },
  ]
  const completionPct = Math.round(
    (completionItems.filter((i) => i.done).length / completionItems.length) * 100
  )

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
        <div className="flex items-center gap-3">
          {isDirty && (
            <span role="status" className="text-[13px] font-semibold text-sec-orange">
              Unsaved changes
            </span>
          )}
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Profile Completeness */}
        <Card className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11.5px] font-bold text-txt-caption uppercase tracking-wider">
              Profile Completeness
            </p>
            <p className="text-[19px] font-black text-txt-title leading-none mt-0.5">
              {completionPct}%
            </p>
            <div className="w-full h-1.5 bg-bg-border rounded-full overflow-hidden mt-1.5">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${completionPct}%`,
                  background: "linear-gradient(90deg,#7c5cfc,#3b7ff5)",
                }}
              />
            </div>
            <p className="text-[11.5px] text-txt-caption mt-1">Keep going! Add more details.</p>
          </div>
        </Card>

        {/* Skills */}
        <Card className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sec-blue/10 flex items-center justify-center shrink-0">
            <span className="text-[14px] font-black text-sec-blue">&lt;/&gt;</span>
          </div>
          <div>
            <p className="text-[11.5px] font-bold text-txt-caption uppercase tracking-wider">
              Skills Listed
            </p>
            <p className="text-[22px] font-black text-txt-title leading-none mt-0.5">
              {skills.length}
            </p>
            <p className="text-[11.5px] text-txt-caption">proficiencies</p>
          </div>
        </Card>

        {/* Work History */}
        <Card className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sec-green/10 flex items-center justify-center shrink-0">
            <Briefcase className="w-5 h-5 text-sec-green" />
          </div>
          <div>
            <p className="text-[11.5px] font-bold text-txt-caption uppercase tracking-wider">
              Work History
            </p>
            <p className="text-[22px] font-black text-txt-title leading-none mt-0.5">
              {experience.length}
            </p>
            <p className="text-[11.5px] text-txt-caption">recorded positions</p>
          </div>
        </Card>

        {/* Resume */}
        <Card className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sec-orange/10 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-sec-orange" />
          </div>
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
                  value={profile.name}
                  onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Your Name"
                  className="w-full text-center text-[15px] font-bold text-txt-title bg-transparent border-b border-transparent hover:border-bg-border focus:border-primary/50 focus:outline-none transition-colors pb-0.5"
                />
                <input
                  value={profile.title}
                  onChange={(e) => setProfile((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Professional title…"
                  className="w-full text-center text-[13px] text-txt-caption bg-transparent border-b border-transparent hover:border-bg-border focus:border-primary/50 focus:outline-none transition-colors pb-0.5"
                />
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
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-txt-caption shrink-0">{icon}</span>
                    <input
                      value={(profile as any)[key]}
                      onChange={(e) => setProfile((p) => ({ ...p, [key]: e.target.value }))}
                      placeholder={placeholder}
                      disabled={disabled}
                      className="flex-1 text-[13px] font-medium text-txt-body bg-transparent border-b border-transparent hover:border-bg-border focus:border-primary/50 focus:outline-none transition-colors pb-0.5 disabled:opacity-60 disabled:cursor-not-allowed min-w-0"
                    />
                  </div>
                ))}
                {joinedLabel && (
                  <InfoRow icon={<Calendar className="w-3.5 h-3.5" />} text={joinedLabel} />
                )}
              </div>
            </div>
          </Card>

          {/* Profile Checklist */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13.5px] font-bold text-txt-title">Profile Checklist</h3>
              <span className="text-[12px] font-bold text-primary">{completionPct}% Complete</span>
            </div>
            <div className="space-y-2">
              {completionItems.map((item) => (
                <div key={item.label} className="flex items-center gap-2.5">
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                      item.done ? "bg-sec-green text-white" : "border-2 border-bg-border"
                    }`}
                  >
                    {item.done && <CheckCircle2 className="w-3 h-3" />}
                  </div>
                  <span
                    className={`text-[13px] font-medium transition-colors ${
                      item.done
                        ? "text-txt-body line-through decoration-sec-green/50"
                        : "text-txt-caption"
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 w-full h-1.5 bg-bg-border rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${completionPct}%`,
                  background: "linear-gradient(90deg,#7c5cfc,#3b7ff5)",
                }}
              />
            </div>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={saving || !isDirty}
              className="mt-3 w-full py-2 rounded-[12px] border border-primary/30 text-primary text-[13px] font-bold hover:bg-primary/5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {saving ? "Saving…" : isDirty ? "Save changes" : "All changes saved"}
            </button>
          </Card>
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
                          <p className="text-[13px] font-bold text-txt-heading">{exp.role}</p>
                          <p className="text-[13px] text-txt-caption font-medium">
                            {exp.company}
                            {exp.duration ? ` · ${exp.duration}` : ""}
                          </p>
                          {exp.desc && (
                            <p className="text-[13px] text-txt-body mt-1 leading-relaxed">
                              {exp.desc}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => exp.id && handleDeleteExperience(exp.id)}
                          disabled={deletingExpId === exp.id}
                          className="p-1.5 rounded-lg hover:bg-bg-hover text-txt-caption hover:text-sec-red opacity-0 group-hover:opacity-100 transition-all cursor-pointer shrink-0"
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
                      placeholder="e.g. Senior Developer"
                      value={expForm.role}
                      onChange={(e) => setExpForm((f) => ({ ...f, role: e.target.value }))}
                      className="h-8 text-[13px]"
                    />
                  </div>
                  <div>
                    <label className="text-[11.5px] font-bold text-txt-caption uppercase tracking-wider block mb-1">
                      Company *
                    </label>
                    <Input
                      placeholder="e.g. Google"
                      value={expForm.company}
                      onChange={(e) => setExpForm((f) => ({ ...f, company: e.target.value }))}
                      className="h-8 text-[13px]"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11.5px] font-bold text-txt-caption uppercase tracking-wider block mb-1">
                    Duration
                  </label>
                  <Input
                    placeholder="e.g. Jan 2022 – Present"
                    value={expForm.duration}
                    onChange={(e) => setExpForm((f) => ({ ...f, duration: e.target.value }))}
                    className="h-8 text-[13px]"
                  />
                </div>
                <div>
                  <label className="text-[11.5px] font-bold text-txt-caption uppercase tracking-wider block mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Key achievements or responsibilities…"
                    value={expForm.desc}
                    onChange={(e) => setExpForm((f) => ({ ...f, desc: e.target.value }))}
                    className="w-full p-2.5 rounded-[10px] border border-bg-border bg-bg-secondary text-[13px] text-txt-body placeholder:text-txt-caption resize-none focus:outline-none focus:border-primary/40 transition-all"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setShowExpForm(false)
                      setExpForm({ role: "", company: "", duration: "", desc: "" })
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
                    ) : (
                      <Plus className="w-3 h-3" />
                    )}
                    Add Experience
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
                        </div>
                        <button
                          onClick={() => edu.id && handleDeleteEducation(edu.id)}
                          disabled={deletingEduId === edu.id}
                          className="p-1.5 rounded-lg hover:bg-bg-hover text-txt-caption hover:text-sec-red opacity-0 group-hover:opacity-100 transition-all cursor-pointer shrink-0"
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
                      placeholder="e.g. MIT"
                      value={eduForm.school}
                      onChange={(e) => setEduForm((f) => ({ ...f, school: e.target.value }))}
                      className="h-8 text-[13px]"
                    />
                  </div>
                  <div>
                    <label className="text-[11.5px] font-bold text-txt-caption uppercase tracking-wider block mb-1">
                      Degree *
                    </label>
                    <Input
                      placeholder="e.g. B.S. Computer Science"
                      value={eduForm.degree}
                      onChange={(e) => setEduForm((f) => ({ ...f, degree: e.target.value }))}
                      className="h-8 text-[13px]"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11.5px] font-bold text-txt-caption uppercase tracking-wider block mb-1">
                    Duration
                  </label>
                  <Input
                    placeholder="e.g. 2018 – 2022"
                    value={eduForm.duration}
                    onChange={(e) => setEduForm((f) => ({ ...f, duration: e.target.value }))}
                    className="h-8 text-[13px]"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setShowEduForm(false)
                      setEduForm({ school: "", degree: "", duration: "" })
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
                    ) : (
                      <Plus className="w-3 h-3" />
                    )}
                    Add Education
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
              <div>
                <p className="text-[11.5px] font-bold text-txt-caption uppercase tracking-wider mb-1">
                  Expected Salary (Annual)
                </p>
                <div className="relative">
                  <DollarSign className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-txt-caption" />
                  <input
                    value={prefs.expectedSalary}
                    onChange={(e) => setPrefs((p) => ({ ...p, expectedSalary: e.target.value }))}
                    placeholder="e.g. $140,000 – $160,000"
                    className="w-full pl-7 pr-3 py-1.5 rounded-[10px] border border-bg-border bg-bg-primary text-[13px] text-txt-body placeholder:text-txt-caption focus:outline-none focus:border-primary/40 transition-all font-medium"
                  />
                </div>
              </div>

              <div>
                <p className="text-[11.5px] font-bold text-txt-caption uppercase tracking-wider mb-1">
                  Years of Experience
                </p>
                <div className="relative">
                  <Clock className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-txt-caption" />
                  <input
                    value={prefs.yearsOfExperience}
                    onChange={(e) => setPrefs((p) => ({ ...p, yearsOfExperience: e.target.value }))}
                    placeholder="e.g. 5+ years"
                    className="w-full pl-7 pr-3 py-1.5 rounded-[10px] border border-bg-border bg-bg-primary text-[13px] text-txt-body placeholder:text-txt-caption focus:outline-none focus:border-primary/40 transition-all font-medium"
                  />
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
              onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
              placeholder="Briefly describe your background, tech stack, and what you excel at…"
              className="w-full p-3 rounded-[12px] border border-bg-border bg-bg-primary text-[13.5px] text-txt-body placeholder:text-txt-caption resize-none focus:outline-none focus:border-primary/40 transition-all font-medium leading-relaxed"
            />
            {/* Social links */}
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-txt-caption shrink-0" />
                <input
                  value={profile.github}
                  onChange={(e) => setProfile((p) => ({ ...p, github: e.target.value }))}
                  placeholder="GitHub URL"
                  aria-label="GitHub URL"
                  type="url"
                  className="flex-1 text-[13px] text-txt-body bg-transparent border-b border-transparent hover:border-bg-border focus:border-primary/50 focus:outline-none transition-colors pb-0.5 placeholder:text-txt-caption"
                />
              </div>
              <div className="flex items-center gap-2">
                <ExternalLink className="w-3.5 h-3.5 text-txt-caption shrink-0" />
                <input
                  value={profile.linkedin}
                  onChange={(e) => setProfile((p) => ({ ...p, linkedin: e.target.value }))}
                  placeholder="LinkedIn URL"
                  aria-label="LinkedIn URL"
                  type="url"
                  className="flex-1 text-[13px] text-txt-body bg-transparent border-b border-transparent hover:border-bg-border focus:border-primary/50 focus:outline-none transition-colors pb-0.5 placeholder:text-txt-caption"
                />
              </div>
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
    </div>
  )
}

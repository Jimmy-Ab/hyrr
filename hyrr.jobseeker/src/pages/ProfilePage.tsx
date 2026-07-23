import { useState, useEffect, useRef } from "react"
import { Mail, Phone, MapPin, Globe, Plus, X, Briefcase, GraduationCap, DollarSign, Camera, Loader2, CheckCircle2, Clock } from "lucide-react"
import { Card, Button, Input, useToast, apiFetch, useJobStore } from "hyrr.shared"

// Custom SVG components for social icons
function Github(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
    </svg>
  )
}

function Linkedin(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  )
}

export function ProfilePage() {
  const { toast } = useToast()
  const { documents, setCandidateActiveView, fetchInitialData } = useJobStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const [profile, setProfile] = useState<any>({
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
    expectedSalary: "",
    preferredType: "Full Time",
    availability: "",
    yearsOfExperience: "",
    preferredLocations: [],
    visibility: "public",
  })

  const [experience, setExperience] = useState<any[]>([])
  const [education, setEducation] = useState<any[]>([])
  const [skills, setSkills] = useState<string[]>([])
  const [languages, setLanguages] = useState<string[]>([])
  const [newSkill, setNewSkill] = useState("")
  const [newLang, setNewLang] = useState("")

  // Add forms
  const [expForm, setExpForm] = useState({ role: "", company: "", duration: "", desc: "" })
  const [eduForm, setEduForm] = useState({ school: "", degree: "", duration: "" })

  const loadProfileData = async () => {
    try {
      setLoading(true)
      const data = await apiFetch('/profile')
      setProfile({
        name: data.user?.name || "",
        email: data.user?.email || "",
        phone: data.phone || "",
        location: data.location || "",
        title: data.title || "",
        website: data.website || "",
        github: data.github || "",
        linkedin: data.linkedin || "",
        bio: data.bio || "",
        avatar: data.user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.user?.name || "User")}&background=6C63FF&color=fff`,
        expectedSalary: data.expectedSalary || "",
        preferredType: data.preferredType || "Full Time",
        availability: data.availability || "",
        yearsOfExperience: data.yearsOfExperience || "",
        preferredLocations: data.preferredLocations || [],
        visibility: data.visibility || "public",
      })
      setExperience(data.experiences || [])
      setEducation(data.educations || [])
      setSkills(data.skills || [])
      setLanguages(data.languages || [])
    } catch (err) {
      console.warn("Failed to load profile", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProfileData()
  }, [])

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append("file", file)

      const result = await apiFetch("/uploads", {
        method: "POST",
        body: formData,
      })

      setProfile((prev: any) => ({ ...prev, avatar: result.url }))
      toast("Photo Uploaded", "Save profile to update your avatar across the app.", "info")
    } catch (err: any) {
      toast("Upload Error", err?.message || "Failed to upload profile photo.", "error")
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleSaveProfile = async () => {
    try {
      setSaving(true)
      await apiFetch('/profile', {
        method: 'PUT',
        body: JSON.stringify({
          ...profile,
          skills,
          languages,
          experiences: experience,
          educations: education,
        }),
      })
      await fetchInitialData()
      toast("Profile Saved", "Your professional details have been updated successfully!", "success")
    } catch (err: any) {
      console.error(err)
      toast("Save Error", err?.message || "Failed to save profile.", "error")
    } finally {
      setSaving(false)
    }
  }

  const completionItems = [
    { label: "Profile photo", done: !!profile.avatar },
    { label: "Headline & Title", done: !!profile.title },
    { label: "Location", done: !!profile.location },
    { label: "Bio / Summary", done: !!profile.bio },
    { label: "Work experience", done: experience.length > 0 },
    { label: "Education", done: education.length > 0 },
    { label: "Skills (5+)", done: skills.length >= 5 },
    { label: "Portfolio / Social link", done: !!(profile.github || profile.linkedin || profile.website) },
    { label: "Expected salary & Preferences", done: !!profile.expectedSalary },
    { label: "Languages", done: languages.length > 0 },
  ]
  const completionPct = Math.round((completionItems.filter((i) => i.done).length / completionItems.length) * 100)

  if (loading) {
    return (
      <div className="min-h-[60vh] w-full flex flex-col items-center justify-center gap-4 py-20">
        <Loader2 className="w-9 h-9 border-4 text-primary animate-spin" />
        <p className="text-[14px] text-txt-caption font-semibold">Loading profile details…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300 relative select-none">
      {/* Hidden file input for avatar */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleAvatarChange}
        accept="image/*"
        className="hidden"
      />

      {/* Ambient glows */}
      <div className="ambient-glow-1" />
      <div className="ambient-glow-2" />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[36px] font-extrabold tracking-tight">
            <span className="premium-gradient-text text-glow">My Profile</span>
          </h1>
          <p className="text-body text-txt-body mt-1 font-semibold opacity-90">Build your professional identity and let top opportunities find you.</p>
        </div>
        <Button onClick={handleSaveProfile} disabled={saving} className="gap-2 cursor-pointer shadow-button font-bold">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? "Saving…" : "Save All Changes"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
        <Card hoverEffect className="p-5 flex flex-col justify-between h-28 relative overflow-hidden group accent-card-primary">
          <div className="flex items-start justify-between relative z-10">
            <span className="text-[11px] font-bold tracking-wider text-txt-caption uppercase">Profile Completeness</span>
            <span className="text-[14px] font-extrabold premium-gradient-text">{completionPct}%</span>
          </div>
          <div className="mt-3 relative z-10">
            <div className="w-full h-2.5 bg-bg-primary rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${completionPct}%`, background: "linear-gradient(90deg, #6C63FF, #3B7FF5)" }} />
            </div>
          </div>
        </Card>
        <Card hoverEffect className="p-5 flex flex-col justify-between h-28 accent-card-blue hover-lift">
          <span className="text-[11px] font-bold tracking-wider text-txt-caption uppercase">Skills Listed</span>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-[26px] font-black text-txt-title leading-none tabular-nums">{skills.length}</span>
            <span className="text-[11px] text-txt-caption font-semibold">proficiencies</span>
          </div>
        </Card>
        <Card hoverEffect className="p-5 flex flex-col justify-between h-28 accent-card-green hover-lift">
          <span className="text-[11px] font-bold tracking-wider text-txt-caption uppercase">Work History</span>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-[26px] font-black text-txt-title leading-none tabular-nums">{experience.length}</span>
            <span className="text-[11px] text-txt-caption font-semibold">recorded positions</span>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Left Column: Identity & Contact */}
        <div className="space-y-6">
          {/* Identity Card */}
          <Card className="p-6 space-y-4">
            <div className="relative w-24 h-24 mx-auto">
              <img src={profile.avatar} alt={profile.name} className="w-full h-full rounded-full object-cover border-4 border-bg-secondary shadow-card" />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary border-2 border-bg-secondary flex items-center justify-center cursor-pointer hover:bg-primary-hover transition-colors shadow-button"
                title="Upload Profile Picture"
              >
                {uploadingAvatar ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" /> : <Camera className="w-3.5 h-3.5 text-white" />}
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-txt-caption uppercase tracking-wider block mb-1">Full Name</label>
                <Input
                  value={profile.name}
                  onChange={(e) => setProfile((p: any) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Alex Morgan"
                  className="h-9 text-[13px] font-semibold"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-txt-caption uppercase tracking-wider block mb-1">Professional Title</label>
                <Input
                  value={profile.title}
                  onChange={(e) => setProfile((p: any) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Senior Frontend Engineer"
                  className="h-9 text-[13px]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-txt-caption uppercase tracking-wider block mb-1">Location</label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-txt-caption" />
                  <Input
                    value={profile.location}
                    onChange={(e) => setProfile((p: any) => ({ ...p, location: e.target.value }))}
                    placeholder="e.g. San Francisco, CA"
                    className="h-9 pl-8 text-[13px]"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-txt-caption uppercase tracking-wider block mb-1">Professional Summary / Bio</label>
              <textarea
                className="w-full p-3 rounded-[12px] border border-bg-border bg-bg-primary text-[12.5px] text-txt-body placeholder:text-txt-caption resize-none focus:outline-none focus:border-primary/30 transition-all font-medium"
                rows={4}
                value={profile.bio}
                onChange={(e) => setProfile((p: any) => ({ ...p, bio: e.target.value }))}
                placeholder="Briefly describe your background, tech stack, and what you excel at…"
              />
            </div>
          </Card>

          {/* Contact Details */}
          <Card className="p-6 space-y-4">
            <h3 className="text-[13px] font-bold text-txt-title uppercase tracking-widest border-b border-bg-border/40 pb-2">Contact & Web</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-txt-caption uppercase tracking-wider block mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-txt-caption" />
                  <Input value={profile.email} disabled className="h-8 pl-8 text-[12px] bg-bg-secondary opacity-75 cursor-not-allowed" />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-txt-caption uppercase tracking-wider block mb-1">Phone Number</label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-txt-caption" />
                  <Input
                    value={profile.phone}
                    onChange={(e) => setProfile((p: any) => ({ ...p, phone: e.target.value }))}
                    placeholder="+1 (555) 000-0000"
                    className="h-8 pl-8 text-[12px]"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-txt-caption uppercase tracking-wider block mb-1">Personal Website</label>
                <div className="relative">
                  <Globe className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-txt-caption" />
                  <Input
                    value={profile.website}
                    onChange={(e) => setProfile((p: any) => ({ ...p, website: e.target.value }))}
                    placeholder="https://yourportfolio.com"
                    className="h-8 pl-8 text-[12px]"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-txt-caption uppercase tracking-wider block mb-1">GitHub Profile</label>
                <div className="relative">
                  <Github className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-txt-caption" />
                  <Input
                    value={profile.github}
                    onChange={(e) => setProfile((p: any) => ({ ...p, github: e.target.value }))}
                    placeholder="https://github.com/username"
                    className="h-8 pl-8 text-[12px]"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-txt-caption uppercase tracking-wider block mb-1">LinkedIn Profile</label>
                <div className="relative">
                  <Linkedin className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-txt-caption" />
                  <Input
                    value={profile.linkedin}
                    onChange={(e) => setProfile((p: any) => ({ ...p, linkedin: e.target.value }))}
                    placeholder="https://linkedin.com/in/username"
                    className="h-8 pl-8 text-[12px]"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Job Preferences */}
          <Card className="p-6 space-y-4">
            <h3 className="text-[13px] font-bold text-txt-title uppercase tracking-widest border-b border-bg-border/40 pb-2">Career Preferences</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-txt-caption uppercase tracking-wider block mb-1">Expected Salary (Annual)</label>
                <div className="relative">
                  <DollarSign className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-txt-caption" />
                  <Input
                    value={profile.expectedSalary}
                    onChange={(e) => setProfile((p: any) => ({ ...p, expectedSalary: e.target.value }))}
                    placeholder="e.g. $140,000 - $160,000"
                    className="h-8 pl-8 text-[12px]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-txt-caption uppercase tracking-wider block mb-1">Years of Experience</label>
                <div className="relative">
                  <Clock className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-txt-caption" />
                  <Input
                    value={profile.yearsOfExperience}
                    onChange={(e) => setProfile((p: any) => ({ ...p, yearsOfExperience: e.target.value }))}
                    placeholder="e.g. 5+ years"
                    className="h-8 pl-8 text-[12px]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-txt-caption uppercase tracking-wider block mb-1">Work Arrangement</label>
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {["Full Time", "Part Time", "Contract", "Remote"].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setProfile((p: any) => ({ ...p, preferredType: t }))}
                      className={`px-3 py-1 rounded-[10px] text-[11.5px] font-semibold cursor-pointer border transition-all ${
                        profile.preferredType === t ? "bg-primary text-white border-primary shadow-button" : "bg-bg-primary text-txt-body border-bg-border hover:border-primary/30"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-txt-caption uppercase tracking-wider block mb-1">Availability / Notice Period</label>
                <Input
                  value={profile.availability}
                  onChange={(e) => setProfile((p: any) => ({ ...p, availability: e.target.value }))}
                  placeholder="e.g. Immediate / 2 weeks notice"
                  className="h-8 text-[12px]"
                />
              </div>
            </div>
          </Card>

          {/* Checklist Card */}
          <Card className="p-6 space-y-3">
            <h3 className="text-[13px] font-bold text-txt-title uppercase tracking-widest border-b border-bg-border/40 pb-2">Profile Checklist</h3>
            <div className="space-y-2">
              {completionItems.map((item) => (
                <div key={item.label} className="flex items-center gap-2.5 text-[12.5px]">
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${item.done ? "bg-sec-green border-sec-green text-white" : "border-bg-border"}`}>
                    {item.done && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </div>
                  <span className={item.done ? "text-txt-heading font-medium" : "text-txt-caption"}>{item.label}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Column: Work Experience, Education, Skills, Languages, Active Resume */}
        <div className="xl:col-span-2 space-y-6">
          {/* Work Experience */}
          <Card className="p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-bg-border/40">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4.5 h-4.5 text-primary" />
                <h3 className="text-[15px] font-bold text-txt-title">Work Experience</h3>
              </div>
              <span className="text-[11px] text-txt-caption font-semibold">{experience.length} recorded</span>
            </div>

            <div className="space-y-4">
              {experience.map((exp, i) => (
                <div key={i} className="flex gap-4 group relative">
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-3.5 h-3.5 rounded-full bg-primary ring-4 ring-primary-light" />
                    {i !== experience.length - 1 && <div className="w-px bg-bg-border/80 flex-1 my-1" />}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-[13.5px] font-bold text-txt-heading">{exp.role}</h4>
                        <p className="text-[12px] text-txt-body font-semibold">{exp.company} · {exp.duration}</p>
                      </div>
                      <button
                        onClick={() => setExperience(experience.filter((_, idx) => idx !== i))}
                        className="p-1 rounded hover:bg-bg-hover text-txt-caption hover:text-sec-red opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                        title="Remove experience"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {exp.desc && <p className="text-[12.5px] text-txt-caption mt-1.5 leading-relaxed font-medium">{exp.desc}</p>}
                  </div>
                </div>
              ))}
            </div>

            {/* Add Experience Form */}
            <div className="p-4 bg-bg-primary rounded-[16px] border border-bg-border/60 space-y-3">
              <p className="text-[12px] font-bold text-txt-heading">Add Position</p>
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Job Title / Role" value={expForm.role} onChange={(e) => setExpForm((f) => ({ ...f, role: e.target.value }))} className="h-8 text-[12px]" />
                <Input placeholder="Company Name" value={expForm.company} onChange={(e) => setExpForm((f) => ({ ...f, company: e.target.value }))} className="h-8 text-[12px]" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Input placeholder="Duration (e.g. 2022 - Present)" value={expForm.duration} onChange={(e) => setExpForm((f) => ({ ...f, duration: e.target.value }))} className="col-span-1 h-8 text-[12px]" />
                <Input placeholder="Key achievements or responsibilities" value={expForm.desc} onChange={(e) => setExpForm((f) => ({ ...f, desc: e.target.value }))} className="col-span-2 h-8 text-[12px]" />
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-1 cursor-pointer text-[12px] font-semibold"
                  onClick={() => {
                    if (expForm.role && expForm.company) {
                      setExperience((prev) => [...prev, { ...expForm, duration: expForm.duration || "Present" }])
                      setExpForm({ role: "", company: "", duration: "", desc: "" })
                    } else {
                      toast("Input Required", "Please enter both role and company.", "info")
                    }
                  }}
                >
                  <Plus className="w-3.5 h-3.5" /> Add Experience
                </Button>
              </div>
            </div>
          </Card>

          {/* Education */}
          <Card className="p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-bg-border/40">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4.5 h-4.5 text-primary" />
                <h3 className="text-[15px] font-bold text-txt-title">Education & Qualifications</h3>
              </div>
              <span className="text-[11px] text-txt-caption font-semibold">{education.length} recorded</span>
            </div>

            <div className="space-y-4">
              {education.map((edu, i) => (
                <div key={i} className="flex gap-4 group relative">
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-3.5 h-3.5 rounded-full bg-sec-blue ring-4 ring-sec-blue/15" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-[13.5px] font-bold text-txt-heading">{edu.school}</h4>
                        <p className="text-[12px] text-txt-body font-semibold">{edu.degree} · {edu.duration}</p>
                      </div>
                      <button
                        onClick={() => setEducation(education.filter((_, idx) => idx !== i))}
                        className="p-1 rounded hover:bg-bg-hover text-txt-caption hover:text-sec-red opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                        title="Remove education"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Education Form */}
            <div className="p-4 bg-bg-primary rounded-[16px] border border-bg-border/60 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <Input placeholder="Institution / School" value={eduForm.school} onChange={(e) => setEduForm((f) => ({ ...f, school: e.target.value }))} className="h-8 text-[12px] col-span-1" />
                <Input placeholder="Degree / Certificate" value={eduForm.degree} onChange={(e) => setEduForm((f) => ({ ...f, degree: e.target.value }))} className="h-8 text-[12px] col-span-1" />
                <Input placeholder="Duration (e.g. 2018 - 2022)" value={eduForm.duration} onChange={(e) => setEduForm((f) => ({ ...f, duration: e.target.value }))} className="h-8 text-[12px] col-span-1" />
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-1 cursor-pointer text-[12px] font-semibold"
                  onClick={() => {
                    if (eduForm.school && eduForm.degree) {
                      setEducation((prev) => [...prev, { ...eduForm }])
                      setEduForm({ school: "", degree: "", duration: "" })
                    } else {
                      toast("Input Required", "Please enter school and degree.", "info")
                    }
                  }}
                >
                  <Plus className="w-3.5 h-3.5" /> Add Degree
                </Button>
              </div>
            </div>
          </Card>

          {/* Skills + Languages */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6 space-y-4">
              <h3 className="text-[13px] font-bold text-txt-title uppercase tracking-widest border-b border-bg-border/40 pb-2">Core Technical Skills</h3>
              <div className="flex flex-wrap gap-1.5 min-h-[40px]">
                {skills.map((sk) => (
                  <span key={sk} className="inline-flex items-center gap-1 text-[11px] font-bold text-primary bg-primary-light border border-primary-border/20 px-2.5 py-1 rounded-full">
                    {sk}
                    <button onClick={() => setSkills(skills.filter((s) => s !== sk))} className="text-primary hover:text-sec-red cursor-pointer"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add skill (e.g. TypeScript)…"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newSkill.trim() && !skills.includes(newSkill.trim())) {
                      setSkills([...skills, newSkill.trim()])
                      setNewSkill("")
                    }
                  }}
                  className="h-8 text-[12px]"
                />
                <Button
                  type="button"
                  onClick={() => {
                    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
                      setSkills([...skills, newSkill.trim()])
                      setNewSkill("")
                    }
                  }}
                  className="h-8 px-3 cursor-pointer text-[12px]"
                >
                  Add
                </Button>
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              <h3 className="text-[13px] font-bold text-txt-title uppercase tracking-widest border-b border-bg-border/40 pb-2">Languages Spoken</h3>
              <div className="space-y-2 min-h-[40px]">
                {languages.map((lang) => (
                  <div key={lang} className="flex items-center justify-between px-3 py-1.5 rounded-[10px] bg-bg-primary border border-bg-border/40">
                    <span className="text-[12.5px] font-semibold text-txt-heading">{lang}</span>
                    <button onClick={() => setLanguages(languages.filter((l) => l !== lang))} className="text-txt-caption hover:text-sec-red cursor-pointer transition-colors"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. Spanish (Native)…"
                  value={newLang}
                  onChange={(e) => setNewLang(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newLang.trim()) {
                      setLanguages([...languages, newLang.trim()])
                      setNewLang("")
                    }
                  }}
                  className="h-8 text-[12px]"
                />
                <Button
                  type="button"
                  onClick={() => {
                    if (newLang.trim()) {
                      setLanguages([...languages, newLang.trim()])
                      setNewLang("")
                    }
                  }}
                  className="h-8 px-3 cursor-pointer text-[12px]"
                >
                  Add
                </Button>
              </div>
            </Card>
          </div>

          {/* Resume */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-bg-border/40">
              <Briefcase className="w-4.5 h-4.5 text-primary" />
              <h3 className="text-[15px] font-bold text-txt-title">Active Resume</h3>
            </div>
            <div className="p-4 rounded-[14px] border border-bg-border/60 bg-bg-secondary flex items-center justify-between">
              {(() => {
                const activeResume = documents.find((d) => d.type === "resume" && d.active)
                if (activeResume) {
                  return (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-sec-red/10 flex items-center justify-center shrink-0">
                          <Briefcase className="w-5 h-5 text-sec-red" />
                        </div>
                        <div>
                          <h4 className="text-[12.5px] font-semibold text-txt-heading truncate max-w-[200px]" title={activeResume.name}>
                            {activeResume.name}
                          </h4>
                          <p className="text-[11px] text-txt-caption">
                            {activeResume.size} · Updated {new Date(activeResume.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <a
                          href={activeResume.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center h-8 px-3 rounded-[10px] bg-bg-hover hover:bg-bg-hover/80 text-[11.5px] font-bold text-txt-heading transition-colors"
                        >
                          Preview
                        </a>
                        <Button variant="secondary" size="sm" className="text-[11.5px] cursor-pointer" onClick={() => setCandidateActiveView("Documents")}>
                          Manage
                        </Button>
                      </div>
                    </>
                  )
                }
                return (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-bg-primary flex items-center justify-center shrink-0 border border-dashed border-bg-border">
                        <Briefcase className="w-5 h-5 text-txt-caption" />
                      </div>
                      <div>
                        <h4 className="text-[12.5px] font-semibold text-txt-heading">No active resume</h4>
                        <p className="text-[11px] text-txt-caption">Upload your resume to apply to jobs.</p>
                      </div>
                    </div>
                    <Button variant="primary" size="sm" className="text-[11.5px] cursor-pointer" onClick={() => setCandidateActiveView("Documents")}>
                      Upload
                    </Button>
                  </>
                )
              })()}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

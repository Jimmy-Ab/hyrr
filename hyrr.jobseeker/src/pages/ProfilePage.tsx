import { useState, useEffect } from "react"
import { Mail, Phone, MapPin, Link, FileText, Plus, X, Briefcase, GraduationCap, Globe, DollarSign } from "lucide-react"
import { Card, Badge, Button, Input, useToast, apiFetch } from "hyrr.shared"

// Custom SVG components for social icons since some lucide-react versions don't export them
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
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
    expectedSalary: "",
    preferredType: "Full Time",
    availability: "",
    preferredLocations: [],
    visibility: "public",
  })

  const [experience, setExperience] = useState<any[]>([])
  const [education, setEducation] = useState<any[]>([])
  const [skills, setSkills]   = useState<string[]>([])
  const [languages, setLanguages] = useState<string[]>([])
  const [newSkill, setNewSkill]   = useState("")
  const [newLang,  setNewLang]    = useState("")

  // Add forms
  const [expForm, setExpForm] = useState({ role: "", company: "", duration: "", desc: "" })
  const [eduForm, setEduForm] = useState({ school: "", degree: "", duration: "" })

  useEffect(() => {
    async function loadData() {
      try {
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
          avatar: data.user?.avatar || "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
          expectedSalary: data.expectedSalary || "",
          preferredType: data.preferredType || "Full Time",
          availability: data.availability || "",
          preferredLocations: data.preferredLocations || [],
          visibility: data.visibility || "public",
        })
        setExperience(data.experiences || [])
        setEducation(data.educations || [])
        setSkills(data.skills || [])
        setLanguages(data.languages || [])
      } catch (err) {
        console.warn("Failed to load profile", err)
      }
    }
    loadData()
  }, [])

  const completionItems = [
    { label: "Profile photo", done: true },
    { label: "Bio / Headline", done: true },
    { label: "Work experience", done: true },
    { label: "Education", done: true },
    { label: "Skills (8+)", done: skills.length >= 8 },
    { label: "Portfolio / GitHub", done: !!profile.github },
    { label: "Expected salary", done: !!profile.expectedSalary },
    { label: "Language proficiency", done: languages.length > 0 },
  ]
  const completionPct = Math.round((completionItems.filter((i) => i.done).length / completionItems.length) * 100)

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div>
        <h1 className="text-[36px] font-bold text-txt-title tracking-tight">My Profile</h1>
        <p className="text-body text-txt-body mt-1 font-medium">Build your professional identity and let the right opportunities find you.</p>
      </div>

      {/* Profile Strength Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-5 flex flex-col justify-between h-28">
          <div className="flex items-start justify-between">
            <span className="text-[13px] font-bold tracking-wider text-txt-caption uppercase">Profile Strength</span>
            <span className="text-[14px] font-extrabold text-primary">{completionPct}%</span>
          </div>
          <div className="mt-3">
            <div className="w-full h-2 bg-bg-primary rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${completionPct}%` }} />
            </div>
          </div>
        </Card>
        <Card className="p-5 flex flex-col justify-between h-28">
          <span className="text-[13px] font-bold tracking-wider text-txt-caption uppercase">Skills</span>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-[26px] font-extrabold text-txt-title leading-none">{skills.length}</span>
            <span className="text-[11px] text-txt-caption font-semibold">proficiencies listed</span>
          </div>
        </Card>
        <Card className="p-5 flex flex-col justify-between h-28">
          <span className="text-[13px] font-bold tracking-wider text-txt-caption uppercase">Experience</span>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-[26px] font-extrabold text-txt-title leading-none">{experience.length}</span>
            <span className="text-[11px] text-txt-caption font-semibold">positions</span>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Left: Identity */}
        <div className="space-y-6">
          {/* Avatar + Bio */}
          <Card className="p-6 text-center space-y-4">
            <div className="relative w-24 h-24 mx-auto">
              <img src={profile.avatar} alt={profile.name} className="w-full h-full rounded-full object-cover border-4 border-bg-secondary shadow-card" />
              <button
                onClick={() => toast("Upload", "Photo upload coming soon.", "info")}
                className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary border-2 border-bg-secondary flex items-center justify-center cursor-pointer hover:bg-primary-hover transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
            <div>
              <h2 className="text-[17px] font-extrabold text-txt-title">{profile.name}</h2>
              <p className="text-[12.5px] text-txt-caption font-semibold mt-0.5">{profile.title}</p>
              <div className="flex items-center justify-center gap-1.5 mt-2 text-[12px] text-txt-caption">
                <MapPin className="w-3.5 h-3.5" /> {profile.location}
              </div>
            </div>
            <textarea
              className="w-full p-3 rounded-[12px] border border-bg-border bg-bg-primary text-[12px] text-txt-body placeholder:text-txt-caption resize-none focus:outline-none focus:border-primary/20 transition-colors"
              rows={4}
              value={profile.bio}
              onChange={(e) => setProfile((p: any) => ({ ...p, bio: e.target.value }))}
              placeholder="Write a short professional summary…"
            />
            <Button
              variant="primary"
              size="sm"
              className="w-full cursor-pointer text-[12px]"
              onClick={async () => {
                try {
                  await apiFetch('/profile', {
                    method: 'PUT',
                    body: JSON.stringify({ ...profile, skills, languages }),
                  })
                  toast("Saved", "Profile updated successfully!", "success")
                } catch {
                  toast("Error", "Failed to save profile.", "error")
                }
              }}
            >
              Save Profile
            </Button>
          </Card>

          {/* Contact */}
          <Card className="p-6 space-y-4">
            <h3 className="text-[13px] font-bold text-txt-title uppercase tracking-widest border-b border-bg-border/40 pb-2">Contact</h3>
            <div className="space-y-3">
              {[
                { icon: Mail, key: "email" as const },
                { icon: Phone, key: "phone" as const },
                { icon: Globe, key: "website" as const },
                { icon: Github, key: "github" as const },
                { icon: Linkedin, key: "linkedin" as const },
              ].map(({ icon: Icon, key }) => (
                <div key={key} className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-txt-caption shrink-0" />
                  <Input value={profile[key]} onChange={(e) => setProfile((p: any) => ({ ...p, [key]: e.target.value }))} className="h-8 py-1 text-[12px]" />
                </div>
              ))}
            </div>
          </Card>

          {/* Job Preferences */}
          <Card className="p-6 space-y-4">
            <h3 className="text-[13px] font-bold text-txt-title uppercase tracking-widest border-b border-bg-border/40 pb-2">Preferences</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <DollarSign className="w-4 h-4 text-txt-caption shrink-0" />
                <Input value={profile.expectedSalary} onChange={(e) => setProfile((p: any) => ({ ...p, expectedSalary: e.target.value }))} className="h-8 py-1 text-[12px]" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-txt-caption uppercase tracking-wider">Work Type</label>
                <div className="flex gap-1 mt-2 flex-wrap">
                  {["Full Time", "Part Time", "Contract", "Remote"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setProfile((p: any) => ({ ...p, preferredType: t }))}
                      className={`px-2.5 py-1 rounded-full text-[11.5px] font-semibold cursor-pointer border transition-all ${profile.preferredType === t ? "bg-primary text-white border-primary" : "bg-bg-primary text-txt-body border-bg-border hover:border-primary/30"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-txt-caption uppercase tracking-wider">Availability</label>
                <Input value={profile.availability} onChange={(e) => setProfile((p: any) => ({ ...p, availability: e.target.value }))} className="h-8 py-1 text-[12px] mt-2" />
              </div>
            </div>
          </Card>

          {/* Completion checklist */}
          <Card className="p-6 space-y-3">
            <h3 className="text-[13px] font-bold text-txt-title uppercase tracking-widest">Profile Checklist</h3>
            <div className="space-y-2">
              {completionItems.map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-[12.5px]">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${item.done ? "bg-primary border-primary" : "border-bg-border"}`}>
                    {item.done && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <span className={item.done ? "text-txt-heading" : "text-txt-caption"}>{item.label}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right: Experience / Education / Skills / Languages */}
        <div className="xl:col-span-2 space-y-6">
          {/* Work Experience */}
          <Card className="p-6 space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-bg-border/40">
              <Briefcase className="w-4.5 h-4.5 text-primary" />
              <h3 className="text-[15px] font-bold text-txt-title">Work Experience</h3>
            </div>
            <div className="space-y-4">
              {experience.map((exp, i) => (
                <div key={i} className="flex gap-4 group relative">
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-3 h-3 rounded-full bg-primary ring-4 ring-primary-light" />
                    {i !== experience.length - 1 && <div className="w-px bg-bg-border/80 flex-1 my-1" />}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-[13.5px] font-bold text-txt-heading">{exp.role}</h4>
                        <p className="text-[12px] text-txt-body font-semibold">{exp.company} · {exp.duration}</p>
                      </div>
                      <button onClick={() => setExperience(experience.filter((_, idx) => idx !== i))} className="p-1 rounded hover:bg-bg-hover text-txt-caption hover:text-sec-red opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {exp.desc && <p className="text-[12.5px] text-txt-caption mt-1.5 leading-relaxed">{exp.desc}</p>}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 bg-bg-primary rounded-[16px] border border-bg-border/60 space-y-3">
              <p className="text-[12px] font-bold text-txt-heading">Add Experience</p>
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Role" value={expForm.role} onChange={(e) => setExpForm((f) => ({ ...f, role: e.target.value }))} className="h-8 text-[12px]" />
                <Input placeholder="Company" value={expForm.company} onChange={(e) => setExpForm((f) => ({ ...f, company: e.target.value }))} className="h-8 text-[12px]" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Input placeholder="Duration" value={expForm.duration} onChange={(e) => setExpForm((f) => ({ ...f, duration: e.target.value }))} className="col-span-1 h-8 text-[12px]" />
                <Input placeholder="Description" value={expForm.desc} onChange={(e) => setExpForm((f) => ({ ...f, desc: e.target.value }))} className="col-span-2 h-8 text-[12px]" />
              </div>
              <div className="flex justify-end">
                <Button
                  variant="secondary" size="sm" className="gap-1 cursor-pointer text-[12px]"
                  onClick={() => {
                    if (expForm.role && expForm.company) {
                      setExperience((prev) => [...prev, { ...expForm, duration: expForm.duration || "Present" }])
                      setExpForm({ role: "", company: "", duration: "", desc: "" })
                    }
                  }}
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </Button>
              </div>
            </div>
          </Card>

          {/* Education */}
          <Card className="p-6 space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-bg-border/40">
              <GraduationCap className="w-4.5 h-4.5 text-primary" />
              <h3 className="text-[15px] font-bold text-txt-title">Education</h3>
            </div>
            <div className="space-y-4">
              {education.map((edu, i) => (
                <div key={i} className="flex gap-4 group relative">
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-3 h-3 rounded-full bg-sec-blue ring-4 ring-sec-blue/15" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-[13.5px] font-bold text-txt-heading">{edu.school}</h4>
                        <p className="text-[12px] text-txt-body font-semibold">{edu.degree} · {edu.duration}</p>
                      </div>
                      <button onClick={() => setEducation(education.filter((_, idx) => idx !== i))} className="p-1 rounded hover:bg-bg-hover text-txt-caption hover:text-sec-red opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 bg-bg-primary rounded-[16px] border border-bg-border/60 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <Input placeholder="School" value={eduForm.school} onChange={(e) => setEduForm((f) => ({ ...f, school: e.target.value }))} className="h-8 text-[12px] col-span-1" />
                <Input placeholder="Degree" value={eduForm.degree} onChange={(e) => setEduForm((f) => ({ ...f, degree: e.target.value }))} className="h-8 text-[12px] col-span-1" />
                <Input placeholder="Duration" value={eduForm.duration} onChange={(e) => setEduForm((f) => ({ ...f, duration: e.target.value }))} className="h-8 text-[12px] col-span-1" />
              </div>
              <div className="flex justify-end">
                <Button
                  variant="secondary" size="sm" className="gap-1 cursor-pointer text-[12px]"
                  onClick={() => {
                    if (eduForm.school && eduForm.degree) {
                      setEducation((prev) => [...prev, { ...eduForm }])
                      setEduForm({ school: "", degree: "", duration: "" })
                    }
                  }}
                >
                  <Plus className="w-3.5 h-3.5" /> Add Degree
                </Button>
              </div>
            </div>
          </Card>

          {/* Skills + Languages in grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6 space-y-4">
              <h3 className="text-[13px] font-bold text-txt-title uppercase tracking-widest border-b border-bg-border/40 pb-2">Core Skills</h3>
              <div className="flex flex-wrap gap-1.5">
                {skills.map((sk) => (
                  <span key={sk} className="inline-flex items-center gap-1 text-[11px] font-bold text-primary bg-primary-light border border-primary-border/20 px-2.5 py-0.5 rounded-full">
                    {sk}
                    <button onClick={() => setSkills(skills.filter((s) => s !== sk))} className="text-primary hover:text-sec-red cursor-pointer"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input placeholder="Add skill…" value={newSkill} onChange={(e) => setNewSkill(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newSkill.trim() && !skills.includes(newSkill.trim())) { setSkills([...skills, newSkill.trim()]); setNewSkill("") } }} className="h-8 text-[12px]" />
                <Button onClick={() => { if (newSkill.trim() && !skills.includes(newSkill.trim())) { setSkills([...skills, newSkill.trim()]); setNewSkill("") } }} className="h-8 px-2.5 cursor-pointer"><Plus className="w-4 h-4" /></Button>
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              <h3 className="text-[13px] font-bold text-txt-title uppercase tracking-widest border-b border-bg-border/40 pb-2">Languages</h3>
              <div className="space-y-2">
                {languages.map((lang) => (
                  <div key={lang} className="flex items-center justify-between p-2 rounded-[10px] bg-bg-primary border border-bg-border/40">
                    <span className="text-[12.5px] font-medium text-txt-heading">{lang}</span>
                    <button onClick={() => setLanguages(languages.filter((l) => l !== lang))} className="text-txt-caption hover:text-sec-red cursor-pointer transition-colors"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input placeholder="e.g. French (Fluent)" value={newLang} onChange={(e) => setNewLang(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newLang.trim()) { setLanguages([...languages, newLang.trim()]); setNewLang("") } }} className="h-8 text-[12px]" />
                <Button onClick={() => { if (newLang.trim()) { setLanguages([...languages, newLang.trim()]); setNewLang("") } }} className="h-8 px-2.5 cursor-pointer"><Plus className="w-4 h-4" /></Button>
              </div>
            </Card>
          </div>

          {/* Resume */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-bg-border/40">
              <FileText className="w-4.5 h-4.5 text-primary" />
              <h3 className="text-[15px] font-bold text-txt-title">Active Resume</h3>
            </div>
            <div className="p-4 rounded-[14px] border border-bg-border/60 bg-bg-secondary flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-sec-red/10 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-sec-red" />
                </div>
                <div>
                  <h4 className="text-[12.5px] font-semibold text-txt-heading">Emily_Carter_Resume_2026.pdf</h4>
                  <p className="text-[11px] text-txt-caption">1.4 MB · v3 · Updated 2 days ago</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="text-[11.5px] cursor-pointer">Preview</Button>
                <Button variant="secondary" size="sm" className="text-[11.5px] cursor-pointer" onClick={() => toast("Upload", "Resume upload coming soon.", "info")}>Replace</Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

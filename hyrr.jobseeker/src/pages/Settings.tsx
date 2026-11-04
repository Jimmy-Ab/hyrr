import {
  AccountSecuritySettings,
  apiFetch,
  Button,
  Card,
  errorMessage,
  Input,
  useJobStore,
  useToast,
  type UserTheme,
} from "hyrr.shared"
import { Bell, Globe, Loader2, Lock, Palette, Shield, User } from "lucide-react"
import { useEffect, useState } from "react"

type Tab = "General" | "Account" | "Security" | "Notifications" | "Appearance" | "Privacy"

const tabs: { id: Tab; icon: typeof User }[] = [
  { id: "General", icon: User },
  { id: "Account", icon: Shield },
  { id: "Security", icon: Lock },
  { id: "Notifications", icon: Bell },
  { id: "Appearance", icon: Palette },
  { id: "Privacy", icon: Globe },
]

const NOTIF_LABELS: Record<string, string> = {
  applicationUpdates: "Application Status Updates",
  interviewReminders: "Interview Reminders",
  offerNotifications: "Offer Notifications",
  messageNotifications: "Recruiter Messages",
  jobRecommendations: "Job Recommendations",
  weeklyDigest: "Weekly Job Digest",
}

const PRIVACY_LABELS: Record<string, { title: string; desc: string }> = {
  profilePublic: { title: "Public Profile", desc: "Allow recruiters to discover your profile" },
  resumeVisible: {
    title: "Resume Visibility",
    desc: "Make resume visible to verified recruiters",
  },
  showActivity: {
    title: "Show Activity Status",
    desc: "Let recruiters see when you were last active",
  },
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: () => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative w-12 h-6 shrink-0 rounded-full transition-colors cursor-pointer ${checked ? "bg-primary" : "bg-bg-border"}`}
    >
      <div
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : "translate-x-0.5"}`}
      />
    </button>
  )
}

export function SettingsPage() {
  const { theme, setTheme, user, seekerProfile, profileUpdating, updateProfile } = useJobStore()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<Tab>("General")

  // General tab form state (prefilled from the profile)
  const [generalName, setGeneralName] = useState(user?.name || "")
  const [generalTitle, setGeneralTitle] = useState(seekerProfile?.title || "")
  const [generalLocation, setGeneralLocation] = useState(seekerProfile?.location || "")
  const [phone, setPhone] = useState(seekerProfile?.phone || "")

  // Notification & privacy prefs (persisted via /settings)
  const [notifPrefs, setNotifPrefs] = useState({
    applicationUpdates: true,
    interviewReminders: true,
    offerNotifications: true,
    messageNotifications: true,
    jobRecommendations: true,
    weeklyDigest: false,
  })
  const [privacyPrefs, setPrivacyPrefs] = useState({
    profilePublic: true,
    resumeVisible: true,
    showActivity: false,
  })
  const [prefsLoading, setPrefsLoading] = useState(false)
  const [prefsError, setPrefsError] = useState<string | null>(null)
  const [settingsSaving, setSettingsSaving] = useState(false)

  useEffect(() => {
    if (user?.name) setGeneralName(user.name)
  }, [user?.name])

  useEffect(() => {
    if (!seekerProfile) return
    setGeneralTitle(seekerProfile.title || "")
    setGeneralLocation(seekerProfile.location || "")
    setPhone(seekerProfile.phone || "")
  }, [seekerProfile])

  // Preferences are only needed on this page, so they are loaded here.
  useEffect(() => {
    setPrefsLoading(true)
    apiFetch("/settings")
      .then((s) => {
        if (!s) return
        setNotifPrefs({
          applicationUpdates: s.applicationUpdates ?? true,
          interviewReminders: s.interviewReminders ?? true,
          offerNotifications: s.offerNotifications ?? true,
          messageNotifications: s.messageNotifications ?? true,
          jobRecommendations: s.jobRecommendations ?? true,
          weeklyDigest: s.weeklyDigest ?? false,
        })
        setPrivacyPrefs({
          profilePublic: s.profilePublic ?? true,
          resumeVisible: s.resumeVisible ?? true,
          showActivity: s.showActivity ?? false,
        })
      })
      .catch((err) => setPrefsError(errorMessage(err, "Could not load your preferences.")))
      .finally(() => setPrefsLoading(false))
  }, [])

  const handleSaveGeneral = async () => {
    if (!generalName.trim()) {
      toast("Name required", "Please enter your name.", "error")
      return
    }
    try {
      await updateProfile({
        name: generalName.trim(),
        title: generalTitle.trim(),
        location: generalLocation.trim(),
      })
      toast("Saved", "General settings updated successfully.", "success")
    } catch (err) {
      toast("Couldn't save settings", errorMessage(err), "error")
    }
  }

  const handleSaveAccount = async () => {
    try {
      await updateProfile({ phone: phone.trim() })
      toast("Saved", "Account details updated.", "success")
    } catch (err) {
      toast("Couldn't update account", errorMessage(err), "error")
    }
  }

  const savePrefs = async (body: Record<string, boolean>, label: string) => {
    setSettingsSaving(true)
    try {
      await apiFetch("/settings", { method: "PUT", body: JSON.stringify(body) })
      toast("Saved", `${label} updated.`, "success")
    } catch (err) {
      toast("Couldn't save preferences", errorMessage(err), "error")
    } finally {
      setSettingsSaving(false)
    }
  }

  const handleThemeChange = async (value: UserTheme) => {
    if (value === theme) return
    try {
      await setTheme(value)
    } catch (err) {
      toast("Theme not saved", errorMessage(err), "error")
    }
  }

  const renderTab = () => {
    switch (activeTab) {
      case "General":
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <label
                htmlFor="settings-name"
                className="text-[13.5px] font-bold text-txt-heading block"
              >
                Full Name
              </label>
              <Input
                id="settings-name"
                value={generalName}
                onChange={(e) => setGeneralName(e.target.value)}
                placeholder="Your display name"
                className="max-w-sm"
              />
            </div>
            <div className="space-y-3">
              <label
                htmlFor="settings-title"
                className="text-[13.5px] font-bold text-txt-heading block"
              >
                Professional Title
              </label>
              <Input
                id="settings-title"
                value={generalTitle}
                onChange={(e) => setGeneralTitle(e.target.value)}
                placeholder="e.g. Senior Frontend Engineer"
                className="max-w-sm"
              />
            </div>
            <div className="space-y-3">
              <label
                htmlFor="settings-location"
                className="text-[13.5px] font-bold text-txt-heading block"
              >
                Location
              </label>
              <Input
                id="settings-location"
                value={generalLocation}
                onChange={(e) => setGeneralLocation(e.target.value)}
                placeholder="City, Country"
                className="max-w-sm"
              />
            </div>
            <Button
              onClick={handleSaveGeneral}
              disabled={profileUpdating}
              className="cursor-pointer shadow-button gap-2"
            >
              {profileUpdating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Changes
            </Button>
          </div>
        )

      case "Account":
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <label
                htmlFor="settings-email"
                className="text-[13.5px] font-bold text-txt-heading block"
              >
                Email Address
              </label>
              <Input
                id="settings-email"
                value={user?.email || ""}
                type="email"
                className="max-w-sm"
                disabled
                readOnly
              />
              <p className="text-[12px] text-txt-caption">
                Email cannot be changed. Contact support if needed.
              </p>
            </div>
            <div className="space-y-3">
              <label
                htmlFor="settings-phone"
                className="text-[13.5px] font-bold text-txt-heading block"
              >
                Phone Number
              </label>
              <Input
                id="settings-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 123 4567"
                className="max-w-sm"
              />
            </div>
            <Button
              onClick={handleSaveAccount}
              disabled={profileUpdating}
              className="cursor-pointer shadow-button gap-2"
            >
              {profileUpdating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Update Account
            </Button>
          </div>
        )

      case "Security":
        return (
          <AccountSecuritySettings deleteDescription="This permanently deletes your profile, applications, documents and messages. This cannot be undone." />
        )

      case "Notifications":
        return (
          <div className="space-y-4">
            {prefsLoading ? (
              <div className="flex items-center gap-2 text-txt-caption text-[13px]">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading preferences…
              </div>
            ) : (
              <>
                {prefsError && (
                  <p role="alert" className="text-[13px] text-sec-red">
                    {prefsError}
                  </p>
                )}
                {Object.entries(notifPrefs).map(([key, val]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-3 p-4 rounded-[14px] border border-bg-border/60 bg-bg-secondary"
                  >
                    <p className="text-[13px] font-semibold text-txt-heading">
                      {NOTIF_LABELS[key]}
                    </p>
                    <Switch
                      checked={val}
                      label={NOTIF_LABELS[key]}
                      onChange={() => setNotifPrefs((p) => ({ ...p, [key]: !val }))}
                    />
                  </div>
                ))}
                <Button
                  onClick={() => savePrefs(notifPrefs, "Notification preferences")}
                  disabled={settingsSaving}
                  className="cursor-pointer shadow-button gap-2"
                >
                  {settingsSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Preferences
                </Button>
              </>
            )}
          </div>
        )

      case "Appearance":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-[13px] font-bold text-txt-heading mb-3">Color Theme</h3>
              <div
                role="radiogroup"
                aria-label="Color theme"
                className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg"
              >
                {(
                  [
                    { label: "Light", value: "light", preview: "bg-white border border-bg-border" },
                    { label: "Dark", value: "dark", preview: "bg-gray-900" },
                    {
                      label: "System",
                      value: "system",
                      preview: "bg-gradient-to-r from-white to-gray-900 border border-bg-border",
                    },
                  ] as { label: string; value: UserTheme; preview: string }[]
                ).map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    role="radio"
                    aria-checked={theme === t.value}
                    onClick={() => handleThemeChange(t.value)}
                    className={`p-4 rounded-[14px] border-2 cursor-pointer transition-all text-left ${theme === t.value ? "border-primary bg-primary-light" : "border-bg-border hover:border-primary/30"}`}
                  >
                    <div className={`w-full h-8 rounded-[8px] mb-2 ${t.preview}`} />
                    <span className="text-[13.5px] font-semibold text-txt-heading">{t.label}</span>
                    {theme === t.value && (
                      <span className="ml-2 text-[11.5px] text-primary font-bold">Active</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )

      case "Privacy":
        return (
          <div className="space-y-4">
            {prefsLoading ? (
              <div className="flex items-center gap-2 text-txt-caption text-[13px]">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading preferences…
              </div>
            ) : (
              <>
                {Object.entries(privacyPrefs).map(([key, val]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-3 p-4 rounded-[14px] border border-bg-border/60 bg-bg-secondary"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-txt-heading">
                        {PRIVACY_LABELS[key].title}
                      </p>
                      <p className="text-[12.5px] text-txt-caption mt-0.5">
                        {PRIVACY_LABELS[key].desc}
                      </p>
                    </div>
                    <Switch
                      checked={val}
                      label={PRIVACY_LABELS[key].title}
                      onChange={() => setPrivacyPrefs((p) => ({ ...p, [key]: !val }))}
                    />
                  </div>
                ))}
                <Button
                  onClick={() => savePrefs(privacyPrefs, "Privacy settings")}
                  disabled={settingsSaving}
                  className="cursor-pointer shadow-button gap-2"
                >
                  {settingsSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Privacy Settings
                </Button>
              </>
            )}
          </div>
        )
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300 relative">
      <div>
        <h1 className="text-[28px] sm:text-[36px] font-extrabold tracking-tight">
          <span className="premium-gradient-text text-glow">Settings</span>
        </h1>
        <p className="text-body text-txt-body mt-1 font-medium">
          Manage your account, security, and preferences.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        {/* Tab list */}
        <div
          role="tablist"
          aria-label="Settings sections"
          className="flex lg:flex-col gap-1 overflow-x-auto custom-scrollbar-none lg:w-[220px] shrink-0"
        >
          {tabs.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => setActiveTab(id)}
              className={`flex shrink-0 items-center gap-3 h-10 px-3.5 rounded-[13px] text-[13.5px] font-medium cursor-pointer transition-all text-left lg:w-full ${
                activeTab === id
                  ? "bg-primary-light text-primary font-semibold"
                  : "text-txt-body hover:bg-bg-hover hover:text-txt-heading"
              }`}
            >
              <Icon
                className={`w-4.5 h-4.5 shrink-0 ${activeTab === id ? "text-primary" : "text-txt-caption"}`}
              />
              {id}
            </button>
          ))}
        </div>

        {/* Content */}
        <Card className="flex-1 min-w-0 p-5 sm:p-8">
          <h2 className="text-[18px] font-bold text-txt-heading mb-6 pb-4 border-b border-bg-border/40">
            {activeTab}
          </h2>
          {renderTab()}
        </Card>
      </div>
    </div>
  )
}

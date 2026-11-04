import {
  apiFetch,
  Button,
  Card,
  errorMessage,
  Input,
  useJobStore,
  useToast,
  type UserTheme,
} from "hyrr.shared"
import {
  Bell,
  Eye,
  EyeOff,
  Globe,
  Loader2,
  Lock,
  Palette,
  Shield,
  Trash2,
  User,
} from "lucide-react"
import { useEffect, useState } from "react"
import { ConfirmDialog } from "../components/ui/confirm-dialog"

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
  const { theme, setTheme, user, seekerProfile, profileUpdating, updateProfile, deleteAccount } =
    useJobStore()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<Tab>("General")
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "" })
  const [pwLoading, setPwLoading] = useState(false)

  // General tab form state (prefilled from the profile)
  const [generalName, setGeneralName] = useState(user?.name || "")
  const [generalTitle, setGeneralTitle] = useState(seekerProfile?.title || "")
  const [generalLocation, setGeneralLocation] = useState(seekerProfile?.location || "")
  const [phone, setPhone] = useState(seekerProfile?.phone || "")

  // Delete account
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePassword, setDeletePassword] = useState("")

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

  const handleChangePassword = async () => {
    if (!pwForm.current || !pwForm.newPw)
      return toast("Missing fields", "Please fill in all password fields.", "error")
    if (pwForm.newPw.length < 8)
      return toast("Password too short", "New password must be at least 8 characters.", "error")
    if (pwForm.newPw !== pwForm.confirm)
      return toast("Passwords don't match", "Please re-enter the new password.", "error")
    setPwLoading(true)
    try {
      await apiFetch("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.newPw }),
      })
      toast("Updated", "Password changed successfully.", "success")
      setPwForm({ current: "", newPw: "", confirm: "" })
    } catch (err) {
      toast("Couldn't change password", errorMessage(err), "error")
    } finally {
      setPwLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount(deletePassword || undefined)
      toast("Account deleted", "Your account and data have been removed.", "success")
    } catch (err) {
      toast("Couldn't delete account", errorMessage(err), "error")
      throw err
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

            <div className="pt-4 border-t border-bg-border/40">
              <h3 className="text-[13px] font-bold text-sec-red mb-2">Danger Zone</h3>
              <p className="text-[13px] text-txt-caption mb-3">
                Permanently delete your account and all associated data. This cannot be undone.
              </p>
              <Button
                variant="secondary"
                onClick={() => {
                  setDeletePassword("")
                  setDeleteOpen(true)
                }}
                className="gap-2 cursor-pointer border-sec-red/30 text-sec-red hover:bg-sec-red/5"
              >
                <Trash2 className="w-4 h-4" /> Delete Account
              </Button>
            </div>
          </div>
        )

      case "Security":
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <label
                htmlFor="pw-current"
                className="text-[13.5px] font-bold text-txt-heading block"
              >
                Current Password
              </label>
              <div className="relative max-w-sm">
                <Input
                  id="pw-current"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={pwForm.current}
                  onChange={(e) => setPwForm((p) => ({ ...p, current: e.target.value }))}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-caption hover:text-txt-heading cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-3">
              <label htmlFor="pw-new" className="text-[13.5px] font-bold text-txt-heading block">
                New Password
              </label>
              <div className="relative max-w-sm">
                <Input
                  id="pw-new"
                  type={showNewPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Minimum 8 characters"
                  value={pwForm.newPw}
                  onChange={(e) => setPwForm((p) => ({ ...p, newPw: e.target.value }))}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-caption hover:text-txt-heading cursor-pointer"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-3">
              <label
                htmlFor="pw-confirm"
                className="text-[13.5px] font-bold text-txt-heading block"
              >
                Confirm New Password
              </label>
              <Input
                id="pw-confirm"
                type="password"
                autoComplete="new-password"
                placeholder="Re-enter new password"
                className="max-w-sm"
                value={pwForm.confirm}
                onChange={(e) => setPwForm((p) => ({ ...p, confirm: e.target.value }))}
              />
            </div>
            <Button
              onClick={handleChangePassword}
              disabled={pwLoading}
              className="cursor-pointer shadow-button gap-2"
            >
              {pwLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Update Password
            </Button>
          </div>
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

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete your account?"
        description="This permanently deletes your profile, applications, documents and messages. This cannot be undone."
        confirmLabel="Delete account"
        onConfirm={handleDeleteAccount}
      >
        <div className="mt-4 space-y-2">
          <label
            htmlFor="delete-password"
            className="text-[13.5px] font-bold text-txt-heading block"
          >
            Confirm with your password
          </label>
          <Input
            id="delete-password"
            type="password"
            autoComplete="current-password"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            placeholder="Your password"
          />
          <p className="text-[12px] text-txt-caption">
            Signed up with Google, GitHub or LinkedIn and never set a password? Leave this empty.
          </p>
        </div>
      </ConfirmDialog>
    </div>
  )
}

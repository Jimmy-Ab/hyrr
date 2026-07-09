import { useState } from "react"
import { User, Shield, Bell, Palette, Globe, Lock, Smartphone, LogOut, Trash2, Eye, EyeOff } from "lucide-react"
import { Card } from "hyrr.shared"
import { Button } from "hyrr.shared"
import { Input } from "hyrr.shared"
import { Badge } from "hyrr.shared"
import { useJobStore } from "hyrr.shared"
import { useToast } from "hyrr.shared"

type Tab = "General" | "Account" | "Security" | "Notifications" | "Appearance" | "Privacy"

const tabs: { id: Tab; icon: typeof User }[] = [
  { id: "General",       icon: User },
  { id: "Account",       icon: Shield },
  { id: "Security",      icon: Lock },
  { id: "Notifications", icon: Bell },
  { id: "Appearance",    icon: Palette },
  { id: "Privacy",       icon: Globe },
]

export function SettingsPage() {
  const { theme, toggleTheme } = useJobStore()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<Tab>("General")
  const [showPassword, setShowPassword] = useState(false)
  const [twoFA, setTwoFA] = useState(false)
  const [notifPrefs, setNotifPrefs] = useState({
    applicationUpdates: true, interviewReminders: true, offerNotifications: true,
    messageNotifications: true, jobRecommendations: true, weeklyDigest: false,
  })
  const [privacyPrefs, setPrivacyPrefs] = useState({
    profilePublic: true, resumeVisible: true, showActivity: false,
  })

  const renderTab = () => {
    switch (activeTab) {
      case "General":
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-[12.5px] font-bold text-txt-heading block">Full Name</label>
              <Input defaultValue="Emily Carter" className="max-w-sm" />
            </div>
            <div className="space-y-3">
              <label className="text-[12.5px] font-bold text-txt-heading block">Professional Title</label>
              <Input defaultValue="Senior Frontend Engineer" className="max-w-sm" />
            </div>
            <div className="space-y-3">
              <label className="text-[12.5px] font-bold text-txt-heading block">Location</label>
              <Input defaultValue="San Francisco, CA" className="max-w-sm" />
            </div>
            <div className="space-y-3">
              <label className="text-[12.5px] font-bold text-txt-heading block">Language</label>
              <div className="flex gap-2">
                {["English", "Spanish", "French"].map((lang) => (
                  <button
                    key={lang}
                    className={`px-3 py-1.5 rounded-[10px] text-[12px] font-semibold border cursor-pointer transition-all ${lang === "English" ? "bg-primary text-white border-primary" : "border-bg-border text-txt-body hover:border-primary/30"}`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={() => toast("Saved", "General settings updated.", "success")} className="cursor-pointer shadow-button">Save Changes</Button>
          </div>
        )

      case "Account":
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-[12.5px] font-bold text-txt-heading block">Email Address</label>
              <Input defaultValue="emily@example.com" type="email" className="max-w-sm" />
            </div>
            <div className="space-y-3">
              <label className="text-[12.5px] font-bold text-txt-heading block">Phone Number</label>
              <Input defaultValue="+1 555 123 4567" className="max-w-sm" />
            </div>
            <Button onClick={() => toast("Saved", "Account details updated.", "success")} className="cursor-pointer shadow-button">Update Account</Button>

            <div className="pt-4 border-t border-bg-border/40">
              <h3 className="text-[13px] font-bold text-txt-heading mb-3">Connected Accounts</h3>
              <div className="space-y-3">
                {[
                  { name: "GitHub",   connected: true },
                  { name: "LinkedIn", connected: true },
                  { name: "Google",   connected: false },
                ].map((acc) => (
                  <div key={acc.name} className="flex items-center justify-between p-3 rounded-[12px] border border-bg-border/60">
                    <span className="text-[13px] font-medium text-txt-heading">{acc.name}</span>
                    <div className="flex items-center gap-2">
                      {acc.connected && <Badge variant="success">Connected</Badge>}
                      <Button variant={acc.connected ? "secondary" : "primary"} size="sm" onClick={() => toast(acc.connected ? "Disconnected" : "Connected", `${acc.name} ${acc.connected ? "disconnected" : "connected"}.`, "success")} className="cursor-pointer text-[11.5px]">
                        {acc.connected ? "Disconnect" : "Connect"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )

      case "Security":
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-[12.5px] font-bold text-txt-heading block">Current Password</label>
              <div className="relative max-w-sm">
                <Input type={showPassword ? "text" : "password"} placeholder="••••••••" />
                <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-caption hover:text-txt-heading cursor-pointer">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-[12.5px] font-bold text-txt-heading block">New Password</label>
              <Input type="password" placeholder="Minimum 8 characters" className="max-w-sm" />
            </div>
            <Button onClick={() => toast("Updated", "Password changed successfully.", "success")} className="cursor-pointer shadow-button">Update Password</Button>

            <div className="pt-4 border-t border-bg-border/40">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[13px] font-bold text-txt-heading">Two-Factor Authentication</h3>
                  <p className="text-[12px] text-txt-caption mt-0.5">Add an extra layer of security to your account.</p>
                </div>
                <button
                  onClick={() => { setTwoFA(!twoFA); toast(twoFA ? "Disabled" : "Enabled", `2FA has been ${twoFA ? "disabled" : "enabled"}.`, "success") }}
                  className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${twoFA ? "bg-primary" : "bg-bg-border"}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${twoFA ? "translate-x-6" : "translate-x-0.5"}`} />
                </button>
              </div>
              {twoFA && (
                <div className="mt-4 p-3 rounded-[12px] bg-primary-light border border-primary-border/30 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-primary" />
                  <span className="text-[12.5px] text-primary font-medium">Authenticator app enabled</span>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-bg-border/40">
              <h3 className="text-[13px] font-bold text-txt-heading mb-3">Active Sessions</h3>
              {[
                { device: "MacBook Pro — Chrome", location: "San Francisco, CA", current: true },
                { device: "iPhone 16 — Safari",   location: "San Francisco, CA", current: false },
              ].map((s) => (
                <div key={s.device} className="flex items-center justify-between p-3 rounded-[12px] border border-bg-border/60 mb-2">
                  <div>
                    <p className="text-[12.5px] font-semibold text-txt-heading">{s.device}</p>
                    <p className="text-[11px] text-txt-caption">{s.location}</p>
                  </div>
                  {s.current ? <Badge variant="success">Current</Badge> : (
                    <Button variant="ghost" size="sm" onClick={() => toast("Signed out", "Session terminated.", "success")} className="text-[11.5px] text-sec-red cursor-pointer">
                      <LogOut className="w-3.5 h-3.5 mr-1" /> Sign Out
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )

      case "Notifications":
        return (
          <div className="space-y-4">
            {Object.entries(notifPrefs).map(([key, val]) => {
              const labels: Record<string, string> = {
                applicationUpdates: "Application Status Updates",
                interviewReminders: "Interview Reminders",
                offerNotifications: "Offer Notifications",
                messageNotifications: "Recruiter Messages",
                jobRecommendations: "Job Recommendations",
                weeklyDigest: "Weekly Job Digest",
              }
              return (
                <div key={key} className="flex items-center justify-between p-4 rounded-[14px] border border-bg-border/60 bg-bg-secondary">
                  <div>
                    <p className="text-[13px] font-semibold text-txt-heading">{labels[key]}</p>
                  </div>
                  <button
                    onClick={() => setNotifPrefs((p) => ({ ...p, [key]: !val }))}
                    className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${val ? "bg-primary" : "bg-bg-border"}`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${val ? "translate-x-6" : "translate-x-0.5"}`} />
                  </button>
                </div>
              )
            })}
          </div>
        )

      case "Appearance":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-[13px] font-bold text-txt-heading mb-3">Color Theme</h3>
              <div className="grid grid-cols-2 gap-3 max-w-sm">
                {[
                  { label: "Light", value: "light" },
                  { label: "Dark",  value: "dark" },
                ].map((t) => (
                  <button
                    key={t.value}
                    onClick={() => { if (theme !== t.value) toggleTheme() }}
                    className={`p-4 rounded-[14px] border-2 cursor-pointer transition-all text-left ${theme === t.value ? "border-primary bg-primary-light" : "border-bg-border hover:border-primary/30"}`}
                  >
                    <div className={`w-full h-8 rounded-[8px] mb-2 ${t.value === "light" ? "bg-white border border-bg-border" : "bg-gray-900"}`} />
                    <span className="text-[12.5px] font-semibold text-txt-heading">{t.label}</span>
                    {theme === t.value && <span className="ml-2 text-[10.5px] text-primary font-bold">Active</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )

      case "Privacy":
        return (
          <div className="space-y-6">
            {Object.entries(privacyPrefs).map(([key, val]) => {
              const labels: Record<string, { title: string; desc: string }> = {
                profilePublic: { title: "Public Profile", desc: "Allow recruiters to discover your profile" },
                resumeVisible: { title: "Resume Visibility", desc: "Make resume visible to verified recruiters" },
                showActivity: { title: "Show Activity Status", desc: "Let recruiters see when you were last active" },
              }
              return (
                <div key={key} className="flex items-center justify-between p-4 rounded-[14px] border border-bg-border/60 bg-bg-secondary">
                  <div>
                    <p className="text-[13px] font-semibold text-txt-heading">{labels[key].title}</p>
                    <p className="text-[11.5px] text-txt-caption mt-0.5">{labels[key].desc}</p>
                  </div>
                  <button
                    onClick={() => setPrivacyPrefs((p) => ({ ...p, [key]: !val }))}
                    className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${val ? "bg-primary" : "bg-bg-border"}`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${val ? "translate-x-6" : "translate-x-0.5"}`} />
                  </button>
                </div>
              )
            })}

            <div className="pt-4 border-t border-bg-border/40">
              <h3 className="text-[13px] font-bold text-sec-red mb-2">Danger Zone</h3>
              <p className="text-[12px] text-txt-caption mb-3">Permanently delete your account and all associated data.</p>
              <Button
                variant="secondary"
                onClick={() => toast("Account deletion", "Please contact support to delete your account.", "info")}
                className="gap-2 cursor-pointer border-sec-red/30 text-sec-red hover:bg-sec-red/5"
              >
                <Trash2 className="w-4 h-4" /> Delete Account
              </Button>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div>
        <h1 className="text-[36px] font-bold text-txt-title tracking-tight">Settings</h1>
        <p className="text-body text-txt-body mt-1 font-medium">Manage your account, security, and preferences.</p>
      </div>

      <div className="flex gap-6">
        {/* Tab sidebar */}
        <div className="w-[220px] shrink-0 flex flex-col gap-1">
          {tabs.map(({ id, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-3 h-10 px-3.5 rounded-[13px] text-[13.5px] font-medium cursor-pointer transition-all text-left w-full ${
                activeTab === id
                  ? "bg-primary-light text-primary font-semibold"
                  : "text-txt-body hover:bg-bg-hover hover:text-txt-heading"
              }`}
            >
              <Icon className={`w-4.5 h-4.5 shrink-0 ${activeTab === id ? "text-primary" : "text-txt-caption"}`} />
              {id}
            </button>
          ))}
        </div>

        {/* Content */}
        <Card className="flex-1 p-8">
          <h2 className="text-[18px] font-bold text-txt-heading mb-6 pb-4 border-b border-bg-border/40">{activeTab}</h2>
          {renderTab()}
        </Card>
      </div>
    </div>
  )
}

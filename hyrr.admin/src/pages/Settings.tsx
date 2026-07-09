import { useState } from "react"
import { Settings, Shield, Key, Bell, Palette, Globe, Server, Database } from "lucide-react"
import { Card } from "hyrr.shared"
import { Badge } from "hyrr.shared"
import { Button } from "hyrr.shared"
import { Input } from "hyrr.shared"
import { useToast } from "hyrr.shared"

type SettingSection = "General" | "Branding" | "Email" | "Auth" | "FeatureFlags" | "Payments" | "Security"

export function PlatformSettingsPage() {
  const { toast } = useToast()
  const [activeSec, setActiveSec] = useState<SettingSection>("General")
  
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [allowRegistration, setAllowRegistration] = useState(true)
  const [mfaRequired, setMfaRequired] = useState(false)
  
  const [brandColor, setBrandColor] = useState("#6C63FF")
  const [platformName, setPlatformName] = useState("HYRR")

  const renderSection = () => {
    switch (activeSec) {
      case "General":
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[12.5px] font-bold text-txt-heading block">Platform Name</label>
              <Input value={platformName} onChange={(e) => setPlatformName(e.target.value)} className="max-w-sm h-9 text-[13px]" />
            </div>

            <div className="space-y-2">
              <label className="text-[12.5px] font-bold text-txt-heading block">Maintenance Mode</label>
              <div className="flex items-center justify-between p-3 rounded-[12px] bg-bg-secondary border border-bg-border/60 max-w-sm">
                <span className="text-[12.5px] text-txt-body">Activate maintenance shield</span>
                <button
                  onClick={() => { setMaintenanceMode(!maintenanceMode); toast("Maintenance", `Maintenance mode is now ${!maintenanceMode ? "active" : "disabled"}.`, "warning") }}
                  className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${maintenanceMode ? "bg-sec-orange" : "bg-bg-border"}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${maintenanceMode ? "translate-x-6" : "translate-x-0.5"}`} />
                </button>
              </div>
              <p className="text-[11px] text-txt-caption">Restricts applicant and recruiter access to platform. Returns HTTP 503.</p>
            </div>
            
            <Button onClick={() => toast("Saved", "General configurations stored.", "success")}>Save General Settings</Button>
          </div>
        )

      case "Branding":
        return (
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-[12.5px] font-bold text-txt-heading block">Brand Primary Hex</label>
              <div className="flex gap-2 items-center">
                <Input value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="w-32 h-9 text-[13px]" />
                <div className="w-8 h-8 rounded-lg border border-bg-border" style={{ backgroundColor: brandColor }} />
              </div>
            </div>
            <Button onClick={() => toast("Saved", "Theme parameters stored.", "success")}>Save Branding</Button>
          </div>
        )

      case "Email":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[12.5px] font-bold text-txt-heading block">SMTP Host</label>
              <Input defaultValue="smtp.sendgrid.net" className="max-w-sm h-9 text-[13px]" />
            </div>
            <div className="space-y-2">
              <label className="text-[12.5px] font-bold text-txt-heading block">Sender Name</label>
              <Input defaultValue="HYRR Alerts" className="max-w-sm h-9 text-[13px]" />
            </div>
            <Button onClick={() => toast("Saved", "Email configuration updated.", "success")}>Save SMTP</Button>
          </div>
        )

      case "Auth":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-[12px] bg-bg-secondary border border-bg-border/60 max-w-md">
              <div>
                <p className="text-[13px] font-semibold text-txt-heading">New Registrations</p>
                <p className="text-[11px] text-txt-caption mt-0.5">Allows new candidate and company signs ups.</p>
              </div>
              <button
                onClick={() => setAllowRegistration(!allowRegistration)}
                className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${allowRegistration ? "bg-primary" : "bg-bg-border"}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${allowRegistration ? "translate-x-6" : "translate-x-0.5"}`} />
              </button>
            </div>
          </div>
        )

      case "FeatureFlags":
        return (
          <div className="space-y-3">
            {[
              { key: "ai_review", title: "AI Cover Letter Analysis", desc: "Let recruiters check candidate portfolios using AI.", enabled: true },
              { key: "telebirr_direct", title: "Telebirr integration", desc: "Allows direct payment via Telebirr USSD gateway.", enabled: false },
            ].map(f => (
              <div key={f.key} className="flex items-center justify-between p-3 rounded-[12px] bg-bg-secondary border border-bg-border/60">
                <div>
                  <p className="text-[13px] font-semibold text-txt-heading">{f.title}</p>
                  <p className="text-[11.5px] text-txt-caption mt-0.5">{f.desc}</p>
                </div>
                <Badge variant={f.enabled ? "success" : "secondary"}>{f.enabled ? "Enabled" : "Disabled"}</Badge>
              </div>
            ))}
          </div>
        )

      case "Payments":
        return (
          <div className="space-y-3">
            {[
              { provider: "Stripe Connect", status: "Connected", action: "Configure" },
              { provider: "PayPal API", status: "Connected", action: "Configure" },
              { provider: "Chapa Payment Gateway", status: "Disconnected", action: "Connect" },
              { provider: "Telebirr API Portal", status: "Disconnected", action: "Connect" },
            ].map(gateway => (
              <div key={gateway.provider} className="flex items-center justify-between p-3 rounded-[12px] border border-bg-border/60">
                <div>
                  <span className="text-[13px] font-bold text-txt-heading">{gateway.provider}</span>
                  <span className="text-[11px] text-txt-caption block mt-0.5">Integrate direct checkouts.</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={gateway.status === "Connected" ? "success" : "secondary"}>{gateway.status}</Badge>
                  <Button variant="secondary" size="sm" onClick={() => toast("Gateway Config", `${gateway.provider} details wizard.`, "info")} className="text-[11.5px] cursor-pointer">{gateway.action}</Button>
                </div>
              </div>
            ))}
          </div>
        )

      case "Security":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-[12px] bg-bg-secondary border border-bg-border/60 max-w-md">
              <div>
                <p className="text-[13px] font-semibold text-txt-heading">Enforce MFA globally</p>
                <p className="text-[11px] text-txt-caption mt-0.5">Requires multi-factor setup on all recruiter accounts.</p>
              </div>
              <button
                onClick={() => setMfaRequired(!mfaRequired)}
                className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${mfaRequired ? "bg-primary" : "bg-bg-border"}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${mfaRequired ? "translate-x-6" : "translate-x-0.5"}`} />
              </button>
            </div>
            
            <div className="pt-3 border-t border-bg-border/30 max-w-md">
              <h3 className="text-[13px] font-bold text-txt-heading mb-2">DB Backup</h3>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => toast("Backup started", "Postgres dump initiated.", "success")} className="cursor-pointer text-[12px]">Backup Database Now</Button>
                <Button size="sm" variant="secondary" onClick={() => toast("Restore", "Access to restore requires 2FA authentication.", "warning")} className="cursor-pointer text-[12px]">Restore Backup</Button>
              </div>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div>
        <h1 className="text-[36px] font-bold text-txt-title tracking-tight">Platform Settings</h1>
        <p className="text-body text-txt-body mt-1 font-medium">Configure global features, system integration keys, branding, and billing providers.</p>
      </div>

      <div className="flex gap-6">
        <div className="w-[200px] shrink-0 flex flex-col gap-1">
          {[
            { id: "General", label: "General" },
            { id: "Branding", label: "Branding" },
            { id: "Email", label: "SMTP Email" },
            { id: "Auth", label: "Authentication" },
            { id: "FeatureFlags", label: "Feature Flags" },
            { id: "Payments", label: "Payment Gates" },
            { id: "Security", label: "System Security" },
          ].map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSec(s.id as SettingSection)}
              className={`px-3 py-2 text-left rounded-[10px] text-[13px] font-semibold transition-all cursor-pointer ${activeSec === s.id ? "bg-primary-light text-primary" : "text-txt-body hover:bg-bg-hover"}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <Card className="flex-1 p-6">
          <h2 className="text-[16px] font-bold text-txt-heading border-b border-bg-border/40 pb-2 mb-4">{activeSec} Rules</h2>
          {renderSection()}
        </Card>
      </div>
    </div>
  )
}

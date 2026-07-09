import { useState } from "react"
import { Zap, Plus, Settings, DollarSign, Gift, ArrowRight } from "lucide-react"
import { Card } from "hyrr.shared"
import { Badge } from "hyrr.shared"
import { Button } from "hyrr.shared"
import { Input } from "hyrr.shared"
import { useToast } from "hyrr.shared"

const packages = [
  { id: "p1", name: "Starter Bundle", credits: 100, price: 19.99, bonus: 0 },
  { id: "p2", name: "Professional Pack", credits: 300, price: 49.99, bonus: 50 },
  { id: "p3", name: "Enterprise Pool", credits: 1000, price: 149.99, bonus: 200 },
]

export function MomentumPage() {
  const { toast } = useToast()
  const [basePrice, setBasePrice] = useState("0.20")
  const [aiPricingEnabled, setAiPricingEnabled] = useState(true)

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[36px] font-bold text-txt-title tracking-tight">Momentum Credits</h1>
          <p className="text-body text-txt-body mt-1 font-medium">Manage virtual job listing credits, package parameters, and dynamic AI costing.</p>
        </div>
        <Button onClick={() => toast("Added Package", "Create package wizard coming soon.", "info")} className="gap-1.5 cursor-pointer text-[12px]">
          <Plus className="w-4 h-4" /> Add Package
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Core Config */}
        <Card className="p-6 space-y-5 xl:col-span-2">
          <h2 className="text-[16px] font-bold text-txt-heading border-b border-bg-border/40 pb-2">Credit Pricing Rules</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[12.5px] font-bold text-txt-heading block">Base Credit Cost ($)</label>
              <Input type="number" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} className="h-9 text-[13px]" />
              <p className="text-[11px] text-txt-caption">The baseline price per Momentum credit sold to recruiters.</p>
            </div>
            
            <div className="space-y-2">
              <label className="text-[12.5px] font-bold text-txt-heading block">AI Dynamic Costing</label>
              <div className="flex items-center justify-between p-2 rounded-[10px] bg-bg-secondary border border-bg-border/60">
                <span className="text-[12.5px] text-txt-body">Auto-price list cost</span>
                <button
                  onClick={() => setAiPricingEnabled(!aiPricingEnabled)}
                  className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${aiPricingEnabled ? "bg-primary" : "bg-bg-border"}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${aiPricingEnabled ? "translate-x-6" : "translate-x-0.5"}`} />
                </button>
              </div>
              <p className="text-[11px] text-txt-caption">Calculates cost dynamically based on competition, salary, and candidate volume.</p>
            </div>
          </div>

          <div className="space-y-3 pt-3 border-t border-bg-border/30">
            <h3 className="text-[13px] font-bold text-txt-heading">Costing Weights (AI Matrix)</h3>
            <div className="space-y-2.5">
              {[
                { factor: "Expected Salary Weight", value: "High (x1.5)" },
                { factor: "Applicant Pool Competition", value: "Medium (x1.2)" },
                { factor: "Category Rarity (e.g. AI Engineer)", value: "High (x1.8)" },
                { factor: "Remote Availability discount", value: "Reduced (x0.9)" },
              ].map(f => (
                <div key={f.factor} className="flex justify-between text-[12.5px] p-2 bg-bg-primary rounded-[8px] border border-bg-border/40">
                  <span className="text-txt-body">{f.factor}</span>
                  <span className="font-semibold text-txt-heading">{f.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Quick Packages */}
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="text-[14px] font-bold text-txt-heading mb-3">Package Schemes</h3>
            <div className="space-y-3">
              {packages.map(p => (
                <div key={p.id} className="p-3 bg-bg-primary rounded-[12px] border border-bg-border/60 flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-bold text-txt-heading">{p.name}</p>
                    <p className="text-[11.5px] text-txt-caption">{p.credits} Credits {p.bonus > 0 && <span className="text-sec-green font-bold">+{p.bonus} Bonus</span>}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[14px] font-extrabold text-txt-heading">${p.price}</p>
                    <button onClick={() => toast("Package updated", `${p.name} properties modified.`, "success")} className="text-[11px] text-primary hover:underline cursor-pointer">Edit</button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-[14px] font-bold text-txt-heading mb-3">Referrals & Campaigns</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[12.5px] text-txt-body">
                <Gift className="w-4 h-4 text-sec-orange" />
                <span>Referral bonus: <strong>50 credits</strong></span>
              </div>
              <div className="flex items-center gap-2 text-[12.5px] text-txt-body">
                <Zap className="w-4 h-4 text-primary" />
                <span>Signup bonus: <strong>20 credits</strong></span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

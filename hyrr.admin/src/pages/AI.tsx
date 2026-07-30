import { Button, Card, useToast } from "hyrr.shared"
import { AlertOctagon, Save } from "lucide-react"
import { useState } from "react"

export function AIManagementPage() {
  const { toast } = useToast()
  const [model, setModel] = useState("gemini-1.5-pro")
  const [temperature, setTemperature] = useState("0.2")
  const [systemPrompt, setSystemPrompt] = useState(
    "You are an AI recruiter screening candidate profiles against job postings. Rate matching strength from 0 to 100."
  )

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    toast("Saved", "AI configuration updated.", "success")
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div>
        <h1 className="text-[36px] font-bold text-txt-title tracking-tight">AI Management</h1>
        <p className="text-body text-txt-body mt-1 font-medium">
          Fine-tune matching prompts, configure engine model endpoints, and monitor parsing failure
          rates.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Configuration settings */}
        <Card className="xl:col-span-2 p-5">
          <h2 className="text-[16px] font-bold text-txt-heading border-b border-bg-border/40 pb-2 mb-4">
            Prompt & Model Rules
          </h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-txt-caption uppercase tracking-wider">
                  Model Selection
                </label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full h-9 px-3 rounded-[12px] border border-bg-border bg-bg-secondary text-[12.5px] text-txt-heading focus:outline-none"
                >
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro (Google)</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash (Google)</option>
                  <option value="gpt-4o">GPT-4o (OpenAI)</option>
                  <option value="claude-3-5-sonnet">Claude 3.5 Sonnet (Anthropic)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-txt-caption uppercase tracking-wider">
                  Temperature ({temperature})
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  className="w-full accent-primary h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-txt-caption uppercase tracking-wider">
                AI System Prompt
              </label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full p-3 rounded-[12px] border border-bg-border bg-bg-primary text-[12px] text-txt-body placeholder:text-txt-caption font-mono resize-none focus:outline-none focus:border-primary/20 transition-colors"
                rows={5}
              />
            </div>

            <Button type="submit" className="gap-2 cursor-pointer text-[12.5px]">
              <Save className="w-4 h-4" /> Save Weights & Prompts
            </Button>
          </form>
        </Card>

        {/* AI Stats */}
        <div className="space-y-4">
          <Card className="p-5 space-y-4">
            <h3 className="text-[14px] font-bold text-txt-heading">Engine Metrics</h3>
            <div className="space-y-2">
              {[
                { metric: "Total Parses (24h)", value: "14,892" },
                { metric: "Average Matching Speed", value: "320ms" },
                { metric: "Accuracy Yield Rate", value: "98.7%" },
              ].map((s) => (
                <div
                  key={s.metric}
                  className="flex justify-between text-[12.5px] py-1 border-b border-bg-border/30 last:border-0"
                >
                  <span className="text-txt-caption">{s.metric}</span>
                  <span className="font-semibold text-txt-heading">{s.value}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <h3 className="text-[14px] font-bold text-txt-heading">Error telemetry</h3>
            <div className="space-y-2">
              <div className="p-3 bg-sec-red/5 rounded-[12px] border border-sec-red/10 flex gap-2">
                <AlertOctagon className="w-4 h-4 text-sec-red mt-0.5 shrink-0" />
                <div>
                  <p className="text-[11.5px] font-bold text-sec-red">API Rate Limit Hit (429)</p>
                  <p className="text-[10px] text-txt-caption mt-0.5">
                    GPT-4o endpoint reported throttle conditions 5m ago.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

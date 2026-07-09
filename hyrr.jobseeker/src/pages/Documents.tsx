import { useState } from "react"
import { FileText, Upload, Trash2, Eye, Download, History, RefreshCw, CheckCircle2, Plus } from "lucide-react"
import { Card } from "hyrr.shared"
import { Badge } from "hyrr.shared"
import { Button } from "hyrr.shared"
import { useToast } from "hyrr.shared"

interface DocFile {
  id: string
  name: string
  type: "resume" | "cover" | "cert" | "portfolio" | "other"
  size: string
  uploaded: string
  version: number
  active: boolean
}

const typeLabel: Record<DocFile["type"], string> = {
  resume:    "Resume",
  cover:     "Cover Letter",
  cert:      "Certificate",
  portfolio: "Portfolio",
  other:     "Document",
}

const typeColor: Record<DocFile["type"], string> = {
  resume:    "text-primary bg-primary-light border-primary-border/30",
  cover:     "text-sec-blue bg-sec-blue/10 border-sec-blue/20",
  cert:      "text-sec-green bg-sec-green/10 border-sec-green/20",
  portfolio: "text-sec-orange bg-sec-orange/10 border-sec-orange/20",
  other:     "text-txt-caption bg-bg-primary border-bg-border",
}

export function Documents() {
  const { toast } = useToast()
  const [docs, setDocs] = useState<DocFile[]>([
    { id: "d1", name: "Emily_Carter_Resume_2026.pdf",       type: "resume",    size: "1.4 MB", uploaded: "2 days ago",  version: 3, active: true },
    { id: "d2", name: "Emily_Carter_Resume_2025.pdf",       type: "resume",    size: "1.2 MB", uploaded: "6 months ago", version: 2, active: false },
    { id: "d3", name: "Stripe_Cover_Letter.pdf",            type: "cover",     size: "320 KB", uploaded: "3 days ago",  version: 1, active: true },
    { id: "d4", name: "Vercel_Cover_Letter.pdf",            type: "cover",     size: "290 KB", uploaded: "1 week ago",  version: 1, active: true },
    { id: "d5", name: "AWS_Solutions_Architect.pdf",        type: "cert",      size: "540 KB", uploaded: "3 months ago", version: 1, active: true },
    { id: "d6", name: "Portfolio_2026.pdf",                 type: "portfolio", size: "8.2 MB", uploaded: "1 week ago",  version: 2, active: true },
  ])

  const [activeType, setActiveType] = useState<DocFile["type"] | "all">("all")

  const filtered = activeType === "all" ? docs : docs.filter((d) => d.type === activeType)
  const groups = ["all", "resume", "cover", "cert", "portfolio"] as const

  const handleDelete = (id: string) => {
    setDocs((prev) => prev.filter((d) => d.id !== id))
    toast("Deleted", "Document removed successfully.", "success")
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[36px] font-bold text-txt-title tracking-tight">Documents</h1>
          <p className="text-body text-txt-body mt-1 font-medium">Manage your resumes, cover letters, certificates, and portfolio files.</p>
        </div>
        <Button
          onClick={() => toast("Upload", "File upload coming soon.", "info")}
          className="gap-2 cursor-pointer shadow-button font-semibold"
        >
          <Upload className="w-4 h-4" /> Upload File
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Files",    value: docs.length },
          { label: "Resumes",        value: docs.filter((d) => d.type === "resume").length },
          { label: "Cover Letters",  value: docs.filter((d) => d.type === "cover").length },
          { label: "Certificates",   value: docs.filter((d) => d.type === "cert").length },
        ].map((s) => (
          <Card key={s.label} className="p-4 flex items-center gap-3">
            <FileText className="w-5 h-5 text-primary shrink-0" />
            <div>
              <p className="text-[20px] font-extrabold text-txt-title">{s.value}</p>
              <p className="text-[11px] text-txt-caption font-semibold uppercase tracking-wider">{s.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-bg-secondary p-1 border border-bg-border rounded-[14px] w-fit">
        {groups.map((g) => (
          <button
            key={g}
            onClick={() => setActiveType(g)}
            className={`px-4 py-1.5 rounded-[11px] text-[12.5px] font-semibold cursor-pointer transition-all capitalize ${
              activeType === g ? "bg-primary text-white" : "text-txt-body hover:bg-bg-hover hover:text-txt-heading"
            }`}
          >
            {g === "all" ? "All Files" : typeLabel[g]}
          </button>
        ))}
      </div>

      {/* Document Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((doc) => (
          <Card key={doc.id} hoverEffect className="p-5 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-[12px] border flex items-center justify-center shrink-0 ${typeColor[doc.type]}`}>
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-txt-heading truncate">{doc.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[10.5px] font-bold px-1.5 py-0.5 rounded-full border ${typeColor[doc.type]}`}>{typeLabel[doc.type]}</span>
                  {doc.active && <CheckCircle2 className="w-3.5 h-3.5 text-sec-green" />}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 text-[11.5px] text-txt-caption">
              <span>{doc.size}</span>
              <span>·</span>
              <span>v{doc.version}</span>
              <span>·</span>
              <span>{doc.uploaded}</span>
            </div>

            <div className="flex gap-2 pt-1 border-t border-bg-border/30">
              <button onClick={() => toast("Preview", `Opening ${doc.name}`, "info")} className="flex items-center gap-1 text-[11.5px] text-txt-caption hover:text-txt-heading transition-colors cursor-pointer px-2 py-1 rounded-[8px] hover:bg-bg-hover">
                <Eye className="w-3.5 h-3.5" /> Preview
              </button>
              <button onClick={() => toast("Download", `Downloading ${doc.name}`, "success")} className="flex items-center gap-1 text-[11.5px] text-txt-caption hover:text-txt-heading transition-colors cursor-pointer px-2 py-1 rounded-[8px] hover:bg-bg-hover">
                <Download className="w-3.5 h-3.5" /> Download
              </button>
              <button onClick={() => toast("History", `Version history for ${doc.name}`, "info")} className="flex items-center gap-1 text-[11.5px] text-txt-caption hover:text-txt-heading transition-colors cursor-pointer px-2 py-1 rounded-[8px] hover:bg-bg-hover">
                <History className="w-3.5 h-3.5" /> History
              </button>
              <button onClick={() => handleDelete(doc.id)} className="flex items-center gap-1 text-[11.5px] text-sec-red/60 hover:text-sec-red transition-colors cursor-pointer px-2 py-1 rounded-[8px] hover:bg-bg-hover ml-auto">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </Card>
        ))}

        {/* Upload CTA */}
        <button
          onClick={() => toast("Upload", "File upload coming soon.", "info")}
          className="p-5 rounded-card border-2 border-dashed border-bg-border/60 hover:border-primary/40 hover:bg-bg-hover/30 transition-all cursor-pointer flex flex-col items-center justify-center gap-3 min-h-[140px]"
        >
          <div className="w-10 h-10 rounded-[12px] bg-primary-light flex items-center justify-center">
            <Plus className="w-5 h-5 text-primary" />
          </div>
          <p className="text-[13px] font-semibold text-txt-caption">Upload new file</p>
        </button>
      </div>
    </div>
  )
}

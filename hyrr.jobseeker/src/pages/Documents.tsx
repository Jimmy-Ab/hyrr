import { useState, useEffect } from "react"
import { FileText, Upload, Trash2, Eye, Download, History, CheckCircle2, Plus, Loader2 } from "lucide-react"
import { Card, Badge, Button, useToast, useJobStore } from "hyrr.shared"

type DocType = "resume" | "cover" | "cert" | "portfolio" | "other"

const typeLabel: Record<DocType, string> = {
  resume: "Resume",
  cover: "Cover Letter",
  cert: "Certificate",
  portfolio: "Portfolio",
  other: "Document",
}

const typeColor: Record<DocType, string> = {
  resume: "text-primary bg-primary-light border-primary-border/30",
  cover: "text-sec-blue bg-sec-blue/10 border-sec-blue/20",
  cert: "text-sec-green bg-sec-green/10 border-sec-green/20",
  portfolio: "text-sec-orange bg-sec-orange/10 border-sec-orange/20",
  other: "text-txt-caption bg-bg-primary border-bg-border",
}

export function Documents() {
  const { toast } = useToast()
  const { documents, documentsLoading, fetchDocuments, deleteDocument, toggleDocumentActive } = useJobStore()
  const [activeType, setActiveType] = useState<DocType | "all">("all")

  useEffect(() => {
    fetchDocuments()
  }, []) // eslint-disable-line

  const filtered = activeType === "all" ? documents : documents.filter(d => d.type === activeType)
  const groups = ["all", "resume", "cover", "cert", "portfolio"] as const

  const handleDelete = async (id: string) => {
    await deleteDocument(id)
    toast("Deleted", "Document removed successfully.", "success")
  }

  const handleToggle = async (id: string) => {
    await toggleDocumentActive(id)
    toast("Updated", "Document status changed.", "success")
  }

  const handleUpload = () => {
    toast("Upload", "File upload UI coming soon. Use the API to upload documents directly.", "info")
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[36px] font-bold text-txt-title tracking-tight">Documents</h1>
          <p className="text-body text-txt-body mt-1 font-medium">Manage your resumes, cover letters, certificates, and portfolio files.</p>
        </div>
        <Button onClick={handleUpload} className="gap-2 cursor-pointer shadow-button font-semibold">
          <Upload className="w-4 h-4" /> Upload File
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Files", value: documents.length, color: "text-primary bg-primary-light" },
          { label: "Resumes", value: documents.filter(d => d.type === "resume").length, color: "text-primary bg-primary-light" },
          { label: "Cover Letters", value: documents.filter(d => d.type === "cover").length, color: "text-sec-blue bg-sec-blue/10" },
          { label: "Certificates", value: documents.filter(d => d.type === "cert").length, color: "text-sec-green bg-sec-green/10" },
        ].map(s => (
          <Card key={s.label} className="p-4 flex items-center gap-3 hover:shadow-card-hover transition-shadow">
            <div className={`w-10 h-10 rounded-[12px] border flex items-center justify-center shrink-0 ${s.color}`}>
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[22px] font-extrabold text-txt-title leading-none">{s.value}</p>
              <p className="text-[11px] text-txt-caption font-semibold uppercase tracking-wider mt-0.5">{s.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-bg-secondary p-1 border border-bg-border rounded-[14px] w-fit">
        {groups.map(g => (
          <button
            key={g}
            onClick={() => setActiveType(g)}
            className={`px-4 py-1.5 rounded-[11px] text-[12.5px] font-semibold cursor-pointer transition-all capitalize ${
              activeType === g ? "bg-primary text-white shadow-button" : "text-txt-body hover:bg-bg-hover hover:text-txt-heading"
            }`}
          >
            {g === "all" ? "All Files" : typeLabel[g as DocType]}
          </button>
        ))}
      </div>

      {documentsLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.length === 0 && !documentsLoading ? (
            <div className="col-span-full flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary-light flex items-center justify-center">
                <FileText className="w-7 h-7 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-[15px] font-bold text-txt-heading">No documents yet</p>
                <p className="text-[12.5px] text-txt-caption mt-1">Upload your resume, cover letters, or certificates to get started.</p>
              </div>
              <Button onClick={handleUpload} className="gap-2 cursor-pointer shadow-button">
                <Upload className="w-4 h-4" /> Upload Your First File
              </Button>
            </div>
          ) : (
            <>
              {filtered.map(doc => {
                const t = (doc.type as DocType) || "other"
                return (
                  <Card key={doc.id} hoverEffect className="p-5 flex flex-col gap-4 group">
                    <div className="flex items-start gap-3">
                      <div className={`w-11 h-11 rounded-[14px] border flex items-center justify-center shrink-0 ${typeColor[t]} transition-transform group-hover:scale-105`}>
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-txt-heading truncate">{doc.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10.5px] font-bold px-1.5 py-0.5 rounded-full border ${typeColor[t]}`}>{typeLabel[t]}</span>
                          {doc.active && <CheckCircle2 className="w-3.5 h-3.5 text-sec-green" />}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-[11.5px] text-txt-caption">
                      <span>{doc.size}</span>
                      <span>·</span>
                      <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                      <span>·</span>
                      <span className={doc.active ? "text-sec-green font-semibold" : "text-txt-disabled"}>
                        {doc.active ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <div className="flex gap-1 pt-1 border-t border-bg-border/30">
                      <button
                        onClick={() => doc.url && doc.url !== "#" ? window.open(doc.url, "_blank") : toast("Preview", `Opening ${doc.name}`, "info")}
                        className="flex items-center gap-1 text-[11.5px] text-txt-caption hover:text-txt-heading transition-colors cursor-pointer px-2 py-1.5 rounded-[8px] hover:bg-bg-hover"
                      >
                        <Eye className="w-3.5 h-3.5" /> Preview
                      </button>
                      <button
                        onClick={() => doc.url && doc.url !== "#" ? window.open(doc.url, "_blank") : toast("Download", `Downloading ${doc.name}`, "success")}
                        className="flex items-center gap-1 text-[11.5px] text-txt-caption hover:text-txt-heading transition-colors cursor-pointer px-2 py-1.5 rounded-[8px] hover:bg-bg-hover"
                      >
                        <Download className="w-3.5 h-3.5" /> Download
                      </button>
                      <button
                        onClick={() => handleToggle(doc.id)}
                        className="flex items-center gap-1 text-[11.5px] text-txt-caption hover:text-txt-heading transition-colors cursor-pointer px-2 py-1.5 rounded-[8px] hover:bg-bg-hover"
                      >
                        <History className="w-3.5 h-3.5" /> {doc.active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="flex items-center gap-1 text-[11.5px] text-sec-red/60 hover:text-sec-red transition-colors cursor-pointer px-2 py-1.5 rounded-[8px] hover:bg-red-50 ml-auto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </Card>
                )
              })}

              {/* Upload CTA */}
              <button
                onClick={handleUpload}
                className="p-5 rounded-card border-2 border-dashed border-bg-border/60 hover:border-primary/40 hover:bg-primary-light/30 transition-all cursor-pointer flex flex-col items-center justify-center gap-3 min-h-[160px] group"
              >
                <div className="w-12 h-12 rounded-[14px] bg-primary-light flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Plus className="w-6 h-6 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-[13px] font-semibold text-txt-caption group-hover:text-txt-heading transition-colors">Upload new file</p>
                  <p className="text-[11px] text-txt-disabled mt-0.5">PDF, DOCX, or image files</p>
                </div>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

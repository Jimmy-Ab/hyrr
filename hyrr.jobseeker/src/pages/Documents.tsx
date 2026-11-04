import {
  apiFetch,
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  errorMessage,
  useJobStore,
  useToast,
  type Document as SeekerDocument,
} from "hyrr.shared"
import {
  CheckCircle2,
  Download,
  Eye,
  FileText,
  History,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react"
import { useRef, useState } from "react"

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

// ─── Upload validation ────────────────────────────────────────────────
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const ALLOWED_EXTENSIONS = ["pdf", "doc", "docx", "jpg", "jpeg", "png", "webp"]
const ALLOWED_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
]

function validateFile(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
  if (!ALLOWED_EXTENSIONS.includes(ext) || (file.type && !ALLOWED_MIME.includes(file.type))) {
    return "Unsupported file type. Upload a PDF, DOC, DOCX, JPG, PNG or WEBP file."
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). The maximum size is 10 MB.`
  }
  if (file.size === 0) return "The selected file is empty."
  return null
}

// ─── Upload Modal ──────────────────────────────────────────────────────
function UploadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [docType, setDocType] = useState<DocType>("resume")
  const [uploading, setUploading] = useState(false)
  // Keeps the stored upload if registering the document fails, so a retry
  // doesn't upload (and orphan) the same file twice.
  const [uploaded, setUploaded] = useState<{ file: File; url: string; size: string } | null>(null)
  const { uploadDocument } = useJobStore()

  const reset = () => {
    setFile(null)
    setFileError(null)
    setUploaded(null)
    setDocType("resume")
  }

  const close = () => {
    if (uploading) return
    reset()
    onClose()
  }

  const pickFile = (f: File | undefined) => {
    if (!f) return
    const error = validateFile(f)
    setFileError(error)
    setFile(error ? null : f)
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    try {
      let stored = uploaded && uploaded.file === file ? uploaded : null
      if (!stored) {
        const formData = new FormData()
        formData.append("file", file)
        const result = await apiFetch("/uploads", { method: "POST", body: formData })
        stored = { file, url: result.url, size: result.size }
        setUploaded(stored)
      }

      await uploadDocument({ name: file.name, type: docType, size: stored.size, url: stored.url })

      toast("Upload successful", `${file.name} has been uploaded.`, "success")
      reset()
      onClose()
    } catch (err) {
      toast("Upload failed", errorMessage(err, "Could not upload the file."), "error")
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
        </DialogHeader>

        <div className="mt-4 flex flex-col gap-5">
          {/* Document type selector */}
          <div role="radiogroup" aria-labelledby="doc-type-label">
            <p
              id="doc-type-label"
              className="text-[13px] font-bold text-txt-heading uppercase tracking-wider mb-2"
            >
              Document Type
            </p>
            <div className="flex flex-wrap gap-2">
              {(["resume", "cover", "cert", "portfolio", "other"] as DocType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={docType === t}
                  onClick={() => setDocType(t)}
                  className={`px-3 py-1.5 rounded-[10px] text-[13px] font-semibold border transition-all cursor-pointer ${
                    docType === t
                      ? "bg-primary text-white border-primary"
                      : "border-bg-border text-txt-body hover:border-primary/30"
                  }`}
                >
                  {typeLabel[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Drop zone */}
          <button
            type="button"
            onDrop={(e) => {
              e.preventDefault()
              pickFile(e.dataTransfer.files?.[0])
            }}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className={`w-full border-2 border-dashed rounded-[14px] p-8 flex flex-col items-center gap-3 cursor-pointer transition-all ${
              file
                ? "border-primary bg-primary-light/40"
                : fileError
                  ? "border-sec-red/50"
                  : "border-bg-border hover:border-primary/40 hover:bg-primary-light/20"
            }`}
          >
            <div className="w-12 h-12 rounded-[14px] bg-primary-light flex items-center justify-center">
              {file ? (
                <CheckCircle2 className="w-6 h-6 text-primary" />
              ) : (
                <Upload className="w-6 h-6 text-primary" />
              )}
            </div>
            {file ? (
              <div className="text-center min-w-0 max-w-full">
                <p className="text-[13px] font-bold text-txt-heading break-all">{file.name}</p>
                <p className="text-[12px] text-txt-caption mt-1">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-[13px] font-semibold text-txt-body">
                  Drop file here or click to browse
                </p>
                <p className="text-[12px] text-txt-caption mt-1">
                  PDF, DOC, DOCX, JPG, PNG or WEBP — up to 10 MB
                </p>
              </div>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            aria-label="Choose file"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
            onChange={(e) => {
              pickFile(e.target.files?.[0])
              e.target.value = ""
            }}
          />
          {fileError && (
            <p role="alert" className="text-[13px] font-medium text-sec-red">
              {fileError}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={close} disabled={uploading}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleUpload}
            disabled={!file || uploading}
            className="cursor-pointer gap-2"
          >
            {uploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Upload File
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Documents Page ────────────────────────────────────────────────
export function Documents() {
  const { toast } = useToast()
  const { documents, documentsLoading, deleteDocument, toggleDocumentActive } = useJobStore()
  const [activeType, setActiveType] = useState<DocType | "all">("all")
  const [showUpload, setShowUpload] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<SeekerDocument | null>(null)

  const filtered = activeType === "all" ? documents : documents.filter((d) => d.type === activeType)
  const groups = ["all", "resume", "cover", "cert", "portfolio"] as const

  const handleDelete = async () => {
    if (!pendingDelete) return
    try {
      await deleteDocument(pendingDelete.id)
      toast("Deleted", `${pendingDelete.name} was removed.`, "success")
    } catch (err) {
      toast("Couldn't delete document", errorMessage(err), "error")
      throw err
    }
  }

  const handleToggle = async (doc: SeekerDocument) => {
    try {
      await toggleDocumentActive(doc.id)
      toast(
        "Updated",
        doc.active ? `${doc.name} is now inactive.` : `${doc.name} is now active.`,
        "success"
      )
    } catch (err) {
      toast("Couldn't update document", errorMessage(err), "error")
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300 relative">
      <UploadModal open={showUpload} onClose={() => setShowUpload(false)} />
      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete document?"
        description={`${pendingDelete?.name ?? "This document"} will be permanently deleted.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] sm:text-[36px] font-extrabold tracking-tight">
            <span className="premium-gradient-text text-glow">Documents</span>
          </h1>
          <p className="text-body text-txt-body mt-1 font-medium">
            Manage your resumes, cover letters, certificates, and portfolio files.
          </p>
        </div>
        <Button
          onClick={() => setShowUpload(true)}
          className="gap-2 cursor-pointer shadow-button font-semibold"
        >
          <Upload className="w-4 h-4" /> Upload File
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Files", value: documents.length, color: "text-primary bg-primary-light" },
          {
            label: "Resumes",
            value: documents.filter((d) => d.type === "resume").length,
            color: "text-primary bg-primary-light",
          },
          {
            label: "Cover Letters",
            value: documents.filter((d) => d.type === "cover").length,
            color: "text-sec-blue bg-sec-blue/10",
          },
          {
            label: "Certificates",
            value: documents.filter((d) => d.type === "cert").length,
            color: "text-sec-green bg-sec-green/10",
          },
        ].map((s) => (
          <Card
            key={s.label}
            className="p-4 flex items-center gap-3 hover:shadow-card-hover transition-shadow"
          >
            <div
              className={`w-10 h-10 rounded-[12px] border flex items-center justify-center shrink-0 ${s.color}`}
            >
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[22px] font-extrabold text-txt-title leading-none">{s.value}</p>
              <p className="text-[12px] text-txt-caption font-semibold uppercase tracking-wider mt-0.5">
                {s.label}
              </p>
            </div>
          </Card>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex max-w-full overflow-x-auto custom-scrollbar-none gap-1 bg-bg-secondary p-1 border border-bg-border rounded-[14px] w-fit">
        {groups.map((g) => (
          <button
            key={g}
            type="button"
            aria-pressed={activeType === g}
            onClick={() => setActiveType(g)}
            className={`shrink-0 whitespace-nowrap px-4 py-1.5 rounded-[11px] text-[13.5px] font-semibold cursor-pointer transition-all ${
              activeType === g
                ? "bg-primary text-white shadow-button"
                : "text-txt-body hover:bg-bg-hover hover:text-txt-heading"
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
                <p className="text-[13.5px] text-txt-caption mt-1">
                  Upload your resume, cover letters, or certificates to get started.
                </p>
              </div>
              <Button
                onClick={() => setShowUpload(true)}
                className="gap-2 cursor-pointer shadow-button"
              >
                <Upload className="w-4 h-4" /> Upload Your First File
              </Button>
            </div>
          ) : (
            <>
              {filtered.map((doc) => {
                const t = (doc.type as DocType) || "other"
                return (
                  <Card key={doc.id} hoverEffect className="p-5 flex flex-col gap-4 group">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-11 h-11 rounded-[14px] border flex items-center justify-center shrink-0 ${typeColor[t]} transition-transform group-hover:scale-105`}
                      >
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-txt-heading truncate">
                          {doc.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`text-[11.5px] font-bold px-1.5 py-0.5 rounded-full border ${typeColor[t]}`}
                          >
                            {typeLabel[t]}
                          </span>
                          {doc.active && <CheckCircle2 className="w-3.5 h-3.5 text-sec-green" />}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-[12.5px] text-txt-caption">
                      <span>{doc.size}</span>
                      <span>·</span>
                      <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                      <span>·</span>
                      <span
                        className={
                          doc.active ? "text-sec-green font-semibold" : "text-txt-disabled"
                        }
                      >
                        {doc.active ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1 pt-1 border-t border-bg-border/30">
                      {doc.url && (
                        <>
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[12.5px] text-txt-caption hover:text-txt-heading transition-colors cursor-pointer px-2 py-1.5 rounded-[8px] hover:bg-bg-hover"
                          >
                            <Eye className="w-3.5 h-3.5" /> Preview
                          </a>
                          <a
                            href={doc.url}
                            download={doc.name}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[12.5px] text-txt-caption hover:text-txt-heading transition-colors cursor-pointer px-2 py-1.5 rounded-[8px] hover:bg-bg-hover"
                          >
                            <Download className="w-3.5 h-3.5" /> Download
                          </a>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => handleToggle(doc)}
                        className="flex items-center gap-1 text-[12.5px] text-txt-caption hover:text-txt-heading transition-colors cursor-pointer px-2 py-1.5 rounded-[8px] hover:bg-bg-hover"
                      >
                        <History className="w-3.5 h-3.5" /> {doc.active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(doc)}
                        aria-label={`Delete ${doc.name}`}
                        className="flex items-center gap-1 text-[12.5px] text-sec-red/60 hover:text-sec-red transition-colors cursor-pointer px-2 py-1.5 rounded-[8px] hover:bg-sec-red/10 ml-auto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </Card>
                )
              })}

              {/* Upload CTA */}
              <button
                type="button"
                onClick={() => setShowUpload(true)}
                className="p-5 rounded-card border-2 border-dashed border-bg-border/60 hover:border-primary/40 hover:bg-primary-light/30 transition-all cursor-pointer flex flex-col items-center justify-center gap-3 min-h-[160px] group"
              >
                <div className="w-12 h-12 rounded-[14px] bg-primary-light flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Plus className="w-6 h-6 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-[13px] font-semibold text-txt-caption group-hover:text-txt-heading transition-colors">
                    Upload new file
                  </p>
                  <p className="text-[12px] text-txt-caption mt-0.5">
                    PDF, DOC, DOCX, or image files
                  </p>
                </div>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

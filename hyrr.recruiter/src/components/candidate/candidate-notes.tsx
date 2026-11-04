import { Button, Skeleton, useToast, type CandidateNote } from "hyrr.shared"
import { Loader2, Pencil, StickyNote, Trash2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { avatarFallback, errorMessage, formatDateTime, relativeTime } from "../../lib/recruiter"
import { useJobStore } from "../../store/useJobStore"
import { ConfirmDialog } from "../layout/confirm-dialog"

const MAX_NOTE_LENGTH = 5000
const textareaCls =
  "w-full min-h-[84px] px-3.5 py-2.5 rounded-xl border border-bg-border bg-bg-secondary text-[13px] text-txt-heading placeholder:text-txt-caption focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10 resize-y"

const newestFirst = (a: CandidateNote, b: CandidateNote) =>
  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()

export function CandidateNotes({ applicationId }: { applicationId: string }) {
  const { fetchNotes, addNote, updateNote, deleteNote } = useJobStore()
  const { toast } = useToast()

  const [notes, setNotes] = useState<CandidateNote[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<CandidateNote | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const list = await fetchNotes(applicationId)
      setNotes([...list].sort(newestFirst))
    } catch (err) {
      setError(errorMessage(err, "Could not load notes."))
    }
  }, [applicationId, fetchNotes])

  useEffect(() => {
    setNotes(null)
    setDraft("")
    setEditingId(null)
    load()
  }, [load])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const body = draft.trim()
    if (!body) return
    setAdding(true)
    try {
      await addNote(applicationId, body)
      setDraft("")
      await load()
      toast("Note added", "Your note is visible to your team.", "success")
    } catch (err) {
      toast("Could not add note", errorMessage(err), "error")
    } finally {
      setAdding(false)
    }
  }

  const handleSaveEdit = async (note: CandidateNote) => {
    const body = editText.trim()
    if (!body) return
    setSavingEdit(true)
    try {
      await updateNote(note.id, body)
      setNotes(
        (prev) =>
          prev?.map((n) =>
            n.id === note.id ? { ...n, body, updatedAt: new Date().toISOString() } : n
          ) ?? prev
      )
      setEditingId(null)
      toast("Note updated", "Your changes were saved.", "success")
    } catch (err) {
      toast("Could not update note", errorMessage(err), "error")
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDelete = async () => {
    if (!pendingDelete) return
    try {
      await deleteNote(pendingDelete.id)
      setNotes((prev) => prev?.filter((n) => n.id !== pendingDelete.id) ?? prev)
      toast("Note deleted", "The note was removed.", "success")
    } catch (err) {
      toast("Could not delete note", errorMessage(err), "error")
      throw err
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="space-y-2">
        <label
          htmlFor="candidate-note-new"
          className="text-[11px] font-bold text-txt-caption uppercase tracking-wider block"
        >
          Add a note
        </label>
        <textarea
          id="candidate-note-new"
          value={draft}
          maxLength={MAX_NOTE_LENGTH}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Only your team can see notes."
          className={textareaCls}
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={adding || !draft.trim()} className="gap-1.5">
            {adding && <Loader2 className="w-4 h-4 animate-spin" />}
            Add note
          </Button>
        </div>
      </form>

      {error ? (
        <div role="alert" className="text-[13px] text-sec-red flex items-center gap-2">
          {error}
          <button
            type="button"
            onClick={load}
            className="font-semibold text-primary hover:underline cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : notes === null ? (
        <div className="space-y-3" role="status" aria-label="Loading notes">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : notes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <StickyNote className="w-6 h-6 text-txt-caption" />
          <p className="text-[13px] text-txt-caption">
            No notes yet. Add the first one to share context with your team.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <li
              key={note.id}
              className="group rounded-xl border border-bg-border bg-bg-secondary p-3.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src={note.author.avatar || avatarFallback(note.author.name)}
                    alt=""
                    className="w-6 h-6 rounded-full object-cover shrink-0"
                  />
                  <span className="text-[13px] font-semibold text-txt-heading truncate">
                    {note.mine ? "You" : note.author.name}
                  </span>
                  <time
                    dateTime={note.createdAt}
                    title={formatDateTime(note.createdAt)}
                    className="text-[12px] text-txt-caption shrink-0"
                  >
                    {relativeTime(note.createdAt)}
                    {note.updatedAt && note.updatedAt !== note.createdAt ? " · edited" : ""}
                  </time>
                </div>
                {note.mine && editingId !== note.id && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(note.id)
                        setEditText(note.body)
                      }}
                      aria-label="Edit note"
                      className="p-1.5 rounded-lg text-txt-caption hover:text-txt-heading hover:bg-bg-hover cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(note)}
                      aria-label="Delete note"
                      className="p-1.5 rounded-lg text-txt-caption hover:text-sec-red hover:bg-sec-red/10 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              {editingId === note.id ? (
                <div className="mt-2 space-y-2">
                  <label htmlFor={`note-edit-${note.id}`} className="sr-only">
                    Edit note
                  </label>
                  <textarea
                    id={`note-edit-${note.id}`}
                    value={editText}
                    maxLength={MAX_NOTE_LENGTH}
                    onChange={(e) => setEditText(e.target.value)}
                    className={textareaCls}
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                      disabled={savingEdit}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleSaveEdit(note)}
                      disabled={savingEdit || !editText.trim()}
                      className="gap-1.5"
                    >
                      {savingEdit && <Loader2 className="w-4 h-4 animate-spin" />}
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-[13px] text-txt-body whitespace-pre-wrap break-words">
                  {note.body}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="Delete note?"
        description="This note will be permanently removed for everyone on your team."
        onConfirm={handleDelete}
      />
    </div>
  )
}

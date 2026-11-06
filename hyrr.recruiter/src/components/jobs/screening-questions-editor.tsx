import { Button, Input, type ScreeningQuestion } from "hyrr.shared"
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react"
import { useState } from "react"

export const MAX_SCREENING_QUESTIONS = 10
const MAX_QUESTION_LENGTH = 500

export interface DraftQuestion extends ScreeningQuestion {
  /** Stable React key (new questions have no id yet). */
  key: string
}

let keySeq = 0
const nextKey = () => `q-${Date.now()}-${keySeq++}`

export function toDraftQuestions(questions: ScreeningQuestion[]): DraftQuestion[] {
  return questions.map((q) => ({ ...q, key: q.id ?? nextKey() }))
}

/** Strips UI-only fields and empty questions before `saveJobQuestions`. */
export function toScreeningQuestions(drafts: DraftQuestion[]): ScreeningQuestion[] {
  return drafts
    .map(({ id, question, required }) => ({
      ...(id ? { id } : {}),
      question: question.trim(),
      required,
    }))
    .filter((q) => q.question.length > 0)
}

interface ScreeningQuestionsEditorProps {
  idPrefix: string
  questions: DraftQuestion[]
  onChange: (questions: DraftQuestion[]) => void
  loading?: boolean
  error?: string | null
  onRetry?: () => void
}

export function ScreeningQuestionsEditor({
  idPrefix,
  questions,
  onChange,
  loading,
  error,
  onRetry,
}: ScreeningQuestionsEditorProps) {
  const [draft, setDraft] = useState("")
  const full = questions.length >= MAX_SCREENING_QUESTIONS

  const add = () => {
    const text = draft.trim()
    if (!text || full) return
    onChange([...questions, { key: nextKey(), question: text, required: false }])
    setDraft("")
  }

  const update = (index: number, patch: Partial<DraftQuestion>) =>
    onChange(questions.map((q, i) => (i === index ? { ...q, ...patch } : q)))

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta
    if (target < 0 || target >= questions.length) return
    const next = [...questions]
    ;[next[index], next[target]] = [next[target]!, next[index]!]
    onChange(next)
  }

  const remove = (index: number) => onChange(questions.filter((_, i) => i !== index))

  if (loading) {
    return (
      <div role="status" className="flex items-center gap-2 text-[13px] text-txt-caption py-3">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading questions…
      </div>
    )
  }

  if (error) {
    return (
      <p role="alert" className="text-[13px] text-sec-red flex items-center gap-2 py-2">
        {error}
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="font-semibold text-primary hover:underline cursor-pointer"
          >
            Retry
          </button>
        )}
      </p>
    )
  }

  return (
    <div className="space-y-2.5">
      {questions.length === 0 && (
        <p className="text-[12.5px] text-txt-caption">
          No screening questions. Candidates answer these when they apply.
        </p>
      )}
      <ol className="space-y-2">
        {questions.map((q, i) => {
          const inputId = `${idPrefix}-q-${q.key}`
          return (
            <li
              key={q.key}
              className="rounded-xl border border-bg-border bg-bg-secondary p-3 flex flex-col gap-2"
            >
              <div className="flex items-start gap-2">
                <span className="text-[12px] font-bold text-txt-caption mt-2.5 w-5 shrink-0">
                  {i + 1}.
                </span>
                <label htmlFor={inputId} className="sr-only">
                  Question {i + 1}
                </label>
                <Input
                  id={inputId}
                  value={q.question}
                  maxLength={MAX_QUESTION_LENGTH}
                  onChange={(e) => update(i, { question: e.target.value })}
                  className="h-9 text-[13px] flex-1"
                />
              </div>
              <div className="flex items-center justify-between gap-2 pl-7">
                <label className="flex items-center gap-2 cursor-pointer text-[12.5px] font-medium text-txt-body">
                  <input
                    type="checkbox"
                    checked={q.required}
                    onChange={(e) => update(i, { required: e.target.checked })}
                    className="w-4 h-4 accent-primary rounded cursor-pointer"
                  />
                  Required
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label={`Move question ${i + 1} up`}
                    className="p-1.5 rounded-lg text-txt-caption hover:text-txt-heading hover:bg-bg-hover disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === questions.length - 1}
                    aria-label={`Move question ${i + 1} down`}
                    className="p-1.5 rounded-lg text-txt-caption hover:text-txt-heading hover:bg-bg-hover disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    aria-label={`Delete question ${i + 1}`}
                    className="p-1.5 rounded-lg text-txt-caption hover:text-sec-red hover:bg-sec-red/10 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
      {full ? (
        <p className="text-[12px] text-txt-caption">
          You can ask up to {MAX_SCREENING_QUESTIONS} questions.
        </p>
      ) : (
        <div className="flex gap-2">
          <label htmlFor={`${idPrefix}-new-question`} className="sr-only">
            New screening question
          </label>
          <Input
            id={`${idPrefix}-new-question`}
            value={draft}
            maxLength={MAX_QUESTION_LENGTH}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                add()
              }
            }}
            placeholder="e.g. Do you have a valid work permit?"
            className="h-9 text-[12px]"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={add}
            disabled={!draft.trim()}
            aria-label="Add question"
            className="h-9 px-3 shrink-0"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

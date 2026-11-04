import { AlertTriangle, ArrowLeft } from "lucide-react"
import * as React from "react"
import { PRIVACY, TERMS } from "./legal-content"

export interface LegalPageProps {
  kind: "terms" | "privacy"
}

/** Public Terms of Service / Privacy Policy page (rendered without login). */
export function LegalPage({ kind }: LegalPageProps) {
  const doc = kind === "terms" ? TERMS : PRIVACY
  const other =
    kind === "terms"
      ? { href: "/privacy", label: "Privacy Policy" }
      : { href: "/terms", label: "Terms of Service" }

  React.useEffect(() => {
    const previous = document.title
    document.title = `${doc.title} · Hyrr`
    return () => {
      document.title = previous
    }
  }, [doc.title])

  return (
    <div className="min-h-dvh w-full overflow-y-auto bg-bg-primary text-txt-body">
      <header className="border-b border-bg-border bg-bg-secondary">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <a href="/" className="text-[18px] font-extrabold tracking-tight text-txt-title">
            hyrr
          </a>
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to Hyrr
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <div
          role="note"
          className="mb-8 flex items-start gap-3 rounded-2xl border border-sec-orange/30 bg-sec-orange/10 p-4 text-[13px] text-txt-heading"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-sec-orange" aria-hidden="true" />
          <p>
            <strong>Template — have this reviewed by a lawyer before launch.</strong> Replace every
            [placeholder] with your own details.
          </p>
        </div>

        <h1 className="text-[28px] font-bold text-txt-title">{doc.title}</h1>
        <p className="mt-1 text-[12px] text-txt-caption">Last updated: {doc.updated}</p>
        <p className="mt-6 text-[14px] leading-relaxed">{doc.intro}</p>

        {doc.sections.map((section) => (
          <section key={section.heading} className="mt-8">
            <h2 className="text-[16px] font-semibold text-txt-heading">{section.heading}</h2>
            {section.paragraphs?.map((p) => (
              <p key={p} className="mt-3 text-[14px] leading-relaxed">
                {p}
              </p>
            ))}
            {section.bullets && (
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed">
                {section.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <footer className="mt-12 border-t border-bg-border pt-6 text-[13px] text-txt-caption">
          See also our{" "}
          <a href={other.href} className="font-semibold text-primary hover:underline">
            {other.label}
          </a>
          .
        </footer>
      </main>
    </div>
  )
}

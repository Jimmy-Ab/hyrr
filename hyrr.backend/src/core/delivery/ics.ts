/** Minimal RFC 5545 calendar invite (one VEVENT) so the interview lands in any calendar app. */
const stamp = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "")

/** Escapes text values and folds lines to 75 octets as the spec requires. */
const text = (v: string) =>
  v.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n")

function fold(line: string): string {
  const out: string[] = []
  let rest = line
  while (rest.length > 74) {
    out.push(rest.slice(0, 74))
    rest = " " + rest.slice(74)
  }
  out.push(rest)
  return out.join("\r\n")
}

export function buildIcs(input: {
  uid: string
  start: Date
  end: Date
  title: string
  description?: string | null
  location?: string | null
  url?: string | null
  method?: "REQUEST" | "PUBLISH" | "CANCEL"
}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Hyrr//Interview//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${input.method ?? "PUBLISH"}`,
    "BEGIN:VEVENT",
    `UID:${input.uid}@hyrr`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(input.start)}`,
    `DTEND:${stamp(input.end)}`,
    `SUMMARY:${text(input.title)}`,
    ...(input.description ? [`DESCRIPTION:${text(input.description)}`] : []),
    ...(input.location ? [`LOCATION:${text(input.location)}`] : []),
    ...(input.url ? [`URL:${text(input.url)}`] : []),
    ...(input.method === "CANCEL" ? ["STATUS:CANCELLED"] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ]
  return lines.map(fold).join("\r\n") + "\r\n"
}

export const icsAttachment = (ics: string, filename = "interview.ics") => ({
  filename,
  content: ics,
  contentType: "text/calendar; charset=utf-8; method=PUBLISH",
})

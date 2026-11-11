/** Jobs without a stated language are treated as English (also the column default). */
export const DEFAULT_JOB_LANGUAGES = ["English"]

/** "english (fluent)" → "English", "brazilian portuguese" → "Brazilian Portuguese". */
export function normalizeLanguage(raw: string): string | null {
  const name = raw
    .replace(/\(.*?\)/g, " ")
    .split(/[,;/|–-]/)[0]
    .trim()
    .replace(/\s+/g, " ")
  if (!name) return null
  return name
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
}

/** Normalised, de-duplicated job languages (English when none are given). */
export function normalizeJobLanguages(list: string[] | null | undefined): string[] {
  const out = [...new Set((list ?? []).map(normalizeLanguage).filter((l): l is string => !!l))]
  return out.length ? out : DEFAULT_JOB_LANGUAGES
}

/**
 * Names to match a seeker's free-text profile languages against job languages: the normalised
 * name and its first word ("Brazilian Portuguese" also matches "Portuguese" jobs via the job side,
 * "English (native)" matches "English").
 */
export function seekerLanguageKeys(list: string[] | null | undefined): string[] {
  const keys = new Set<string>()
  for (const raw of list ?? []) {
    const n = normalizeLanguage(raw)
    if (!n) continue
    keys.add(n)
    const words = n.split(" ")
    keys.add(words[0])
    keys.add(words[words.length - 1])
  }
  return [...keys]
}

/**
 * Phrase-based scam screening for job postings. Each rule is evaluated per sentence and only
 * fires on candidate-directed phrasing (e.g. "applicants must pay a $50 registration fee"), so
 * ordinary postings mentioning fees, payments or messaging apps ("we pay relocation and visa
 * fees", "Telegram bot developer") pass. Returns human-readable reasons; empty = acceptable.
 */

type PolicyRule = {
  reason: string
  /** Every pattern must match the same sentence. */
  all: RegExp[]
  /** Any match here exempts the sentence (negations, employer-paid wording). */
  none?: RegExp[]
}

const CANDIDATE = String.raw`(?:you|candidates?|applicants?|new hires?|trainees?|selected|successful|shortlisted|interested)`
const MONEY = String.raw`(?:\$|€|£|usd|eur|gbp|etb|birr|br\b)`
const CRYPTO = String.raw`(?:bitcoin|btc|usdt|tether|crypto(?:currency|currencies)?|ethereum)`
const MESSENGER = String.raw`(?:whatsapp|telegram|signal|wechat|viber)`
const SENSITIVE = String.raw`(?:bank (?:account|details|information|info|login|credentials)|account numbers?|routing numbers?|credit card|debit card|card (?:number|details|pin)|social security(?: number)?|ssn|passport(?: copy| number| scan| details)?|national id(?: number)?)`

const EMPLOYER_PAYS = [
  /\b(?:no|zero|free of|without|never|not)\b[^,]{0,25}\b(?:fees?|charges?|deposits?|cost)\b/,
  /\b(?:we|the company|our company|the employer|employer)\s+(?:will\s+)?(?:fully\s+)?(?:cover|covers|pay|pays|reimburse|reimburses|refund|refunds|sponsor|sponsors|handle|handles)\b/,
  /\b(?:reimbursed|covered by (?:us|the company|the employer)|paid by (?:us|the company|the employer))\b/,
]

const RULES: PolicyRule[] = [
  {
    reason: "Asks candidates to pay a fee or deposit (registration, training, equipment, visa…)",
    all: [
      /\b(?:registration|application|training|processing|placement|onboarding|enrol?ment|interview|activation|verification|starter|kit|equipment|joining|visa|uniform|admin(?:istration|istrative)?|refundable)\b/,
      new RegExp(
        String.raw`\b${CANDIDATE}\b[^.]{0,40}\b(?:pay|send|transfer|wire|deposit)\b(?!\s+attention)[^.]{0,40}(?:\b(?:fees?|deposit|charge)\b|${MONEY}\s?\d)` +
          String.raw`|\b(?:fees?|deposit|charge)\b\s*(?:is|are|will be)?\s*(?:required|payable|mandatory|non-refundable|refundable|due)\b` +
          String.raw`|\b(?:fees?|deposit|charge) of\s*${MONEY}?\s?\d` +
          String.raw`|${MONEY}\s?\d[\d,.]*\s+(?:\w+\s+){0,2}(?:fees?|deposit)\b` +
          String.raw`|\brefundable (?:fees?|deposit)\b` +
          String.raw`|\b(?:pay|send|make)\s+(?:a|an|the)\s+(?:small\s+|one[- ]time\s+|initial\s+)?(?:deposit|fee|payment)\s+(?:to|before)\s+(?:secure|start|begin|confirm|reserve|receive|get|activate|process)\b`
      ),
    ],
    none: EMPLOYER_PAYS,
  },
  {
    reason: "Requests money transfers via Western Union or MoneyGram",
    all: [
      new RegExp(
        String.raw`\b(?:send|sent|transfer(?:red)?|wired?|pay|paid|deposit(?:ed)?)\b[^.]{0,30}\b(?:via|through|by|using|with)\s+(?:western union|moneygram|money gram)\b` +
          String.raw`|\b${CANDIDATE}\b[^.]{0,40}\b(?:western union|moneygram|money gram)\b`
      ),
    ],
  },
  {
    reason: "Asks candidates to buy gift cards or share gift card codes",
    all: [
      new RegExp(
        String.raw`\bgift ?cards?\b[^.]{0,60}\b(?:codes?|pins?|photos?|pictures?|scratch)\b` +
          String.raw`|\b${CANDIDATE}\b[^.]{0,40}\b(?:buy|purchase)\b[^.]{0,30}\bgift ?cards?\b`
      ),
    ],
  },
  {
    reason: "Asks candidates to send cryptocurrency",
    all: [
      new RegExp(
        String.raw`\b${CANDIDATE}\b[^.]{0,40}\b(?:send|deposit|transfer|pay|buy|purchase)\b[^.]{0,40}\b${CRYPTO}\b` +
          String.raw`|\b(?:send|deposit|transfer|pay)\b[^.]{0,40}\b${CRYPTO}\b[^.]{0,20}\bto\s+(?:our|my|this|the following)\b`
      ),
    ],
    none: [/\b(?:we|the company|employer)\s+(?:will\s+)?(?:pay|pays)\b/],
  },
  {
    reason: "Asks candidates to deposit a cheque and forward part of the money",
    all: [
      /\b(?:deposit|cash)\b[^.]{0,25}\b(?:cheques?|checks?)\b[^.]{0,80}\b(?:send|transfer|wire|forward|return)\b[^.]{0,40}\b(?:remaining|rest|balance|difference|portion|part|money|funds|amount)\b/,
    ],
  },
  {
    reason: "Asks candidates to communicate only via WhatsApp/Telegram outside the platform",
    all: [
      new RegExp(
        String.raw`\b${MESSENGER}\s*(?:only|exclusively)\b` +
          String.raw`|\b(?:only|exclusively)\s+(?:via|on|through|by|using|over)\s+${MESSENGER}\b` +
          String.raw`|\b(?:contact|message|text|reach|apply|dm|chat|add)\b[^.]{0,40}\b${MESSENGER}\b[^.]{0,40}\b(?:do not|don't|instead of)\s+apply`
      ),
    ],
  },
  {
    reason: "Asks for bank details, ID or passport data before an interview",
    all: [
      new RegExp(
        String.raw`\b(?:send|provide|submit|share|email|include|attach|enter|give|forward)\b[^.]{0,30}\b${SENSITIVE}\b`
      ),
      /\b(?:before (?:the |an |your |any )?interview|prior to (?:the |an |your |any )?interview|with your (?:application|cv|resume)|to apply|in order to (?:apply|be considered|be shortlisted|proceed|secure|get)|to be (?:considered|shortlisted|hired)|to (?:secure|reserve|confirm|hold) (?:the |your |a )?(?:position|spot|slot|job|place|role)|before (?:we|you) (?:can )?(?:proceed|start|schedule|continue)|up ?front)\b/,
    ],
  },
  {
    reason: "Asks for online-banking passwords or PINs",
    all: [
      /\b(?:online banking|bank(?:ing)?|account) (?:password|pin|login credentials|passcode)s?\b/,
      /\b(?:send|provide|submit|share|email|give|enter|need|require)\b/,
    ],
  },
]

function normalize(text: string) {
  return text.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-")
}

/** Sentence-ish chunks; a period between digits (prices like $49.99) does not split. */
function sentences(text: string) {
  return normalize(text)
    .split(/(?<!\d)[.!?;](?!\d)|\n+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean)
}

export type JobContent = {
  title?: string | null
  description?: string | null
  requirements?: string[] | null
  benefits?: string[] | null
}

/** Returns the distinct human-readable reasons a posting looks like a scam (empty = OK). */
export function evaluateJobContent(job: JobContent): string[] {
  const text = [job.title, job.description, ...(job.requirements ?? []), ...(job.benefits ?? [])]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join("\n")
  if (!text) return []
  const reasons = new Set<string>()
  for (const sentence of sentences(text)) {
    for (const rule of RULES) {
      if (reasons.has(rule.reason)) continue
      if (!rule.all.every((re) => re.test(sentence))) continue
      if (rule.none?.some((re) => re.test(sentence))) continue
      reasons.add(rule.reason)
    }
  }
  return [...reasons]
}

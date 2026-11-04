import { Injectable, Logger } from "@nestjs/common"
import { UserRole } from "@prisma/client"
import { PrismaService } from "../../prisma/prisma.service"

/** Consumer mailbox providers: an address there proves nothing about a company domain. */
const FREE_MAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "ymail.com",
  "rocketmail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
  "protonmail.ch",
  "pm.me",
  "gmx.com",
  "gmx.net",
  "gmx.de",
  "aol.com",
  "yandex.com",
  "yandex.ru",
  "ya.ru",
  "mail.ru",
  "mail.com",
  "inbox.ru",
  "bk.ru",
  "list.ru",
  "zoho.com",
  "zohomail.com",
  "tutanota.com",
  "tuta.io",
  "fastmail.com",
  "hey.com",
  "web.de",
  "qq.com",
  "163.com",
  "126.com",
  "naver.com",
  "rediffmail.com",
])

/** Providers that also run country domains (yahoo.co.uk, hotmail.fr, gmx.at …). */
const FREE_MAIL_BRANDS = new Set([
  "gmail",
  "googlemail",
  "outlook",
  "hotmail",
  "live",
  "yahoo",
  "ymail",
  "icloud",
  "proton",
  "protonmail",
  "gmx",
  "aol",
  "yandex",
])

/** Second-level labels under a ccTLD that act as public suffixes (co.uk, com.au, co.et …). */
const SECOND_LEVEL_SUFFIX_LABELS = new Set([
  "co",
  "com",
  "net",
  "org",
  "gov",
  "edu",
  "ac",
  "or",
  "ne",
  "go",
  "ltd",
  "plc",
  "nom",
  "gob",
])

/** Lowercase hostname from a URL, bare host or e-mail domain; null when unusable. */
export function hostnameOf(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null
  let raw = value.trim().toLowerCase()
  if (!raw) return null
  if (raw.includes("@") && !raw.includes("/")) raw = raw.slice(raw.lastIndexOf("@") + 1)
  if (!/^[a-z][a-z0-9+.-]*:\/\//.test(raw)) raw = `http://${raw}`
  let host: string
  try {
    host = new URL(raw).hostname
  } catch {
    return null
  }
  host = host.replace(/\.$/, "")
  if (!host.includes(".") || /^[\d.]+$/.test(host) || host.includes(":")) return null
  return host
}

/**
 * Registrable domain ("eTLD+1"): strips www. and subdomains; keeps three labels for common
 * two-part public suffixes (example.co.uk, example.com.au, example.co.et).
 */
export function registrableDomain(value: string | null | undefined): string | null {
  const host = hostnameOf(value)
  if (!host) return null
  const labels = host.split(".").filter(Boolean)
  if (labels.length < 2) return null
  const tld = labels[labels.length - 1]
  const second = labels[labels.length - 2]
  const twoPartSuffix = tld.length === 2 && SECOND_LEVEL_SUFFIX_LABELS.has(second)
  const keep = twoPartSuffix ? 3 : 2
  if (labels.length < keep) return null
  return labels.slice(-keep).join(".")
}

export function isFreeMailDomain(domain: string | null | undefined): boolean {
  const registrable = registrableDomain(domain)
  if (!registrable) return true
  if (FREE_MAIL_DOMAINS.has(registrable)) return true
  return FREE_MAIL_BRANDS.has(registrable.split(".")[0])
}

/** The verified domain an e-mail address proves for a website, or null. */
export function matchingCompanyDomain(
  email: string | null | undefined,
  website: string | null | undefined
) {
  if (!email || !website) return null
  const emailDomain = registrableDomain(email)
  if (!emailDomain || isFreeMailDomain(emailDomain)) return null
  return emailDomain === registrableDomain(website) ? emailDomain : null
}

/**
 * Marks a company verified when one of its recruiters has a verified e-mail on the company
 * website's domain. Revokes the badge when the website moves to another domain. Never throws.
 */
@Injectable()
export class CompanyVerificationService {
  private readonly logger = new Logger(CompanyVerificationService.name)

  constructor(private readonly prisma: PrismaService) {}

  async refreshForUser(userId: string): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, companyId: true },
      })
      if (!user || user.role !== UserRole.RECRUITER || !user.companyId) return
      await this.evaluate(user.companyId)
    } catch (error) {
      this.logger.warn(
        `Company verification failed for user ${userId}: ${(error as Error)?.message}`
      )
    }
  }

  /** Re-evaluates a company (e.g. after its website changed). Never throws. */
  async refreshForCompany(companyId: string): Promise<void> {
    try {
      await this.evaluate(companyId)
    } catch (error) {
      this.logger.warn(`Company verification failed for ${companyId}: ${(error as Error)?.message}`)
    }
  }

  private async evaluate(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, website: true, verified: true, verifiedDomain: true },
    })
    if (!company) return
    const websiteDomain = registrableDomain(company.website)

    if (websiteDomain && !(company.verified && company.verifiedDomain === websiteDomain)) {
      const recruiters = await this.prisma.user.findMany({
        where: {
          role: UserRole.RECRUITER,
          emailVerifiedAt: { not: null },
          OR: [{ companyId }, { companyMemberships: { some: { companyId } } }],
        },
        select: { email: true },
        take: 200,
      })
      const domain = recruiters
        .map((r) => matchingCompanyDomain(r.email, company.website))
        .find((d): d is string => !!d)
      if (domain) {
        await this.prisma.company.update({
          where: { id: companyId },
          data: { verified: true, verifiedDomain: domain, verifiedAt: new Date() },
        })
        return
      }
    }

    // The badge belongs to a domain: moving the website elsewhere (or removing it) revokes it.
    if (company.verified && company.verifiedDomain && company.verifiedDomain !== websiteDomain) {
      await this.prisma.company.update({
        where: { id: companyId },
        data: { verified: false, verifiedDomain: null, verifiedAt: null },
      })
    }
  }
}

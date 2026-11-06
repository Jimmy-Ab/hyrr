/**
 * Generic legal templates for a recruiting marketplace.
 * TEMPLATE: have these texts reviewed by a lawyer and fill in every [placeholder] before launch.
 */

export interface LegalSection {
  heading: string
  paragraphs?: string[]
  bullets?: string[]
}

export interface LegalDocument {
  title: string
  updated: string
  intro: string
  sections: LegalSection[]
}

const CONTROLLER = "[Company legal name], [street address, postcode, city, country]"
const CONTACT_EMAIL = "[privacy@your-domain.com]"
const SUPPORT_EMAIL = "[support@your-domain.com]"

export const TERMS: LegalDocument = {
  title: "Terms of Service",
  updated: "[date]",
  intro:
    'These Terms of Service ("Terms") govern your use of Hyrr, an online recruiting marketplace that connects job seekers with employers and recruiters (the "Service"). By creating an account or using the Service you agree to these Terms. If you use the Service on behalf of a company, you confirm that you are authorised to accept these Terms for that company.',
  sections: [
    {
      heading: "1. Who we are",
      paragraphs: [
        `The Service is operated by ${CONTROLLER} ("we", "us"). You can reach us at ${SUPPORT_EMAIL}.`,
      ],
    },
    {
      heading: "2. Accounts",
      bullets: [
        "You must be at least 16 years old (or the minimum working age in your country, if higher) to create an account.",
        "Provide accurate information and keep it up to date. One person may hold one account per role.",
        "Keep your password and two-factor codes confidential. You are responsible for activity under your account.",
        "Notify us immediately at the contact address above if you suspect unauthorised use.",
      ],
    },
    {
      heading: "3. Job seekers",
      bullets: [
        "You decide which information you share. Applying to a job shares your application (profile details, CV, cover letter and messages) with the hiring company.",
        "Employers make their own hiring decisions. We do not guarantee interviews, offers or employment.",
        "Never pay a fee to apply for a job or to be hired. Report any posting that asks for money, bank details or identity documents before an interview.",
      ],
    },
    {
      heading: "4. Employers and recruiters",
      bullets: [
        "Only publish genuine, currently open positions that you are authorised to recruit for.",
        "Job postings must comply with applicable employment, anti-discrimination and data-protection laws and must not request payments from candidates.",
        "Use candidate data only to assess candidates for the positions they applied to, and delete it when it is no longer needed for that purpose. You act as an independent controller of candidate data you receive.",
        'A "Verified company" badge only confirms that a team member verified an e-mail address on the company\'s website domain. It is not an endorsement.',
      ],
    },
    {
      heading: "5. Acceptable use",
      paragraphs: ["You must not:"],
      bullets: [
        "post false, misleading, discriminatory, fraudulent or unlawful content;",
        "harass, spam or solicit other users for purposes unrelated to recruiting;",
        "scrape, copy or bulk-export data from the Service, or circumvent rate limits and security measures;",
        "upload malware or content that infringes the rights of others;",
        "impersonate another person or company.",
      ],
    },
    {
      heading: "6. Content and reports",
      paragraphs: [
        "You keep ownership of content you submit and grant us a non-exclusive, worldwide licence to host, display and process it as needed to operate the Service.",
        "Users can report postings. We may review, hide, edit or remove content and suspend or close accounts that breach these Terms or put others at risk. Where reasonable we will tell you why and give you a chance to respond.",
      ],
    },
    {
      heading: "7. AI-assisted features",
      paragraphs: [
        "Some features use automated tools to summarise or rank applications and suggest jobs. These suggestions support, but never replace, human decisions. Employers remain responsible for their hiring decisions.",
      ],
    },
    {
      heading: "8. Fees",
      paragraphs: [
        "The Service is free for job seekers. Paid plans for employers, if any, are described at the point of purchase and governed by the order terms shown there.",
      ],
    },
    {
      heading: "9. Availability and changes",
      paragraphs: [
        "We work to keep the Service available but do not guarantee uninterrupted access. We may change or discontinue features. We will announce material changes to these Terms in advance by e-mail or in the app; continued use after they take effect means you accept them.",
      ],
    },
    {
      heading: "10. Liability",
      paragraphs: [
        'To the extent permitted by law, the Service is provided "as is". We are not liable for the content of job postings or applications, for hiring decisions, or for indirect or consequential losses. Nothing in these Terms limits liability that cannot be limited by law, such as liability for intent, gross negligence or injury to life, body or health.',
      ],
    },
    {
      heading: "11. Termination",
      paragraphs: [
        "You can delete your account at any time in Settings. We may suspend or terminate accounts that breach these Terms. Sections that by their nature should survive termination will survive.",
      ],
    },
    {
      heading: "12. Governing law",
      paragraphs: [
        "These Terms are governed by the laws of [country/state], without prejudice to mandatory consumer protection rules of your country of residence. Courts of [city] have jurisdiction where permitted by law.",
      ],
    },
    {
      heading: "13. Contact",
      paragraphs: [`Questions about these Terms: ${SUPPORT_EMAIL}.`],
    },
  ],
}

export const PRIVACY: LegalDocument = {
  title: "Privacy Policy",
  updated: "[date]",
  intro:
    "This Privacy Policy explains how we collect, use and protect personal data when you use Hyrr, and which rights you have. It applies to job seekers, recruiters and visitors of our applications.",
  sections: [
    {
      heading: "1. Data controller",
      paragraphs: [
        `The controller responsible for your personal data is ${CONTROLLER}. Contact: ${CONTACT_EMAIL}. [If applicable: our Data Protection Officer can be reached at [dpo@your-domain.com].]`,
        "When an employer processes your application, that employer is an independent controller for the data you share with them. Please also read the employer's own privacy notice.",
      ],
    },
    {
      heading: "2. Data we collect",
      bullets: [
        "Account data: name, e-mail address, password hash, role, sign-in provider (Google, GitHub, LinkedIn), two-factor settings.",
        "Profile data you choose to add: title, location, phone, skills, languages, experience, education, salary expectations, links, photo.",
        "Documents: CVs, cover letters and other files you upload.",
        "Application data: jobs you save or apply to, application status, interview events, messages with recruiters.",
        "Recruiter and company data: company name, website, team members, job postings.",
        "Technical data: IP address, device and browser information, log and security events (e.g. failed sign-in attempts), error reports.",
      ],
    },
    {
      heading: "3. Purposes and legal bases",
      bullets: [
        "Providing the Service and your account (performance of a contract, Art. 6(1)(b) GDPR).",
        "Sharing your application with the employer you apply to (contract / your request).",
        "Security, fraud and abuse prevention, including captcha checks and scam detection in job postings (legitimate interests, Art. 6(1)(f)).",
        "Service e-mails such as verification, password reset and application updates (contract).",
        "AI-assisted matching and summaries to help you find jobs or review applications (legitimate interests; you can object at any time).",
        "Complying with legal obligations, e.g. tax and record-keeping (Art. 6(1)(c)).",
        "Optional notifications and job alerts (consent, Art. 6(1)(a), which you can withdraw at any time in Settings).",
      ],
    },
    {
      heading: "4. Recipients",
      paragraphs: [
        "We share data only where needed: with employers you apply to; with service providers acting on our behalf under data processing agreements (e.g. hosting, file storage, e-mail delivery, error monitoring, captcha, AI model providers); and with authorities where required by law. We do not sell personal data.",
        "[List your processors here, e.g. hosting provider, e-mail provider, Cloudflare Turnstile, Sentry, AI provider, with their location.]",
      ],
    },
    {
      heading: "5. International transfers",
      paragraphs: [
        "Where providers process data outside the EEA/UK, we rely on adequacy decisions or Standard Contractual Clauses with additional safeguards where necessary. [Describe the transfers that apply.]",
      ],
    },
    {
      heading: "6. Retention",
      bullets: [
        "Account and profile data: as long as your account exists; deleted when you delete your account.",
        "Applications and messages: for the duration of the recruiting process and up to [6] months afterwards unless you consent to a longer period or the law requires otherwise.",
        "Security logs: up to [90] days.",
        "Data we must keep by law (e.g. invoices): for the statutory period.",
      ],
    },
    {
      heading: "7. Your rights",
      paragraphs: ["Under the GDPR and similar laws you have the right to:"],
      bullets: [
        "access your data and receive a copy (Settings → Security → Download my data);",
        "rectify inaccurate data;",
        "erase your data (Settings → Security → Delete account);",
        "restrict or object to processing based on legitimate interests;",
        "data portability;",
        "withdraw consent at any time without affecting earlier processing;",
        "lodge a complaint with a supervisory authority, in particular in your country of residence.",
      ],
    },
    {
      heading: "8. Cookies and local storage",
      paragraphs: [
        "We use only essential cookies and storage that are necessary to run the Service: a secure, HTTP-only cookie that keeps you signed in, and local storage for preferences such as your theme or dismissing this notice. The captcha provider may set strictly necessary cookies to protect forms from abuse. We do not use advertising or analytics cookies, so no consent banner is required for them.",
      ],
    },
    {
      heading: "9. Security",
      paragraphs: [
        "We protect your data with encryption in transit, hashed passwords, optional two-factor authentication, access controls and regular backups. No system is perfectly secure; please use a strong, unique password.",
      ],
    },
    {
      heading: "10. Automated decisions",
      paragraphs: [
        "We do not make decisions with legal or similarly significant effects solely by automated means. AI scores and summaries are aids for human reviewers.",
      ],
    },
    {
      heading: "11. Children",
      paragraphs: ["The Service is not intended for anyone under 16."],
    },
    {
      heading: "12. Changes and contact",
      paragraphs: [
        `We will update this policy when our processing changes and notify you of material changes. Questions or requests: ${CONTACT_EMAIL}.`,
      ],
    },
  ],
}

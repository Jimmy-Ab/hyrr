# Hyrr: Global Competitive Roadmap & 3-App Synchronization Specification

> **Target Audience**: AI assistants (Claude, Antigravity) and core engineers developing the Hyrr platform.  
> **Repository**: [Hyrr Monorepo](file:///Users/Jimmy/Documents/hyrr) (`hyrr.jobseeker`, `hyrr.recruiter`, `hyrr.admin`, `hyrr.shared`, `hyrr.backend`).  
> **Standard**: Apple/Linear-grade UI (8px grid, design tokens, spring physics) + Real-time socket event synchronization across all three applications.

---

## Implementation status (kept current with the code)

Plan: `~/.claude/plans/floofy-yawning-cascade.md`. Decisions: talent search is **opt-in** (`openToRecruiters`, off by default); interview scheduling is **native slots first** (+ .ics), Google/Outlook sync later; seeker AI tools cost **Momentum credits** (admin-editable).

| Phase | Item                                                                                                                        | Status  |
| ----- | --------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1     | Live sync: `candidate_applied`, team-wide `application_status_updated`, `job_moderated` / `job_removed`, admin live metrics | ✅ Done |
| 2     | Interview slot booking · Scorecards · Offers · Talent search                                                                | Planned |
| 3     | External tracker · Resume tailor · Mock interview · Salary benchmark · Skill badges                                         | Planned |
| 4     | Scam detection · Responsiveness score · Liquidity heatmap · AI usage observatory · Public job pages + embed                 | Planned |

**Corrections to the sections below (as built):**

- There is no `admin_channel`: admins with 2FA join the socket room `admin` (on connect, or via `join_admin` after enabling 2FA) and receive `admin_metric` hints `{kind, at}` with no personal data. The admin app refreshes its queries (throttled 5 s).
- `application_status_updated` goes to the seeker **and** `company_<id>`, carrying `actorId` so the mover's own client ignores the echo.
- Job removal is `POST /api/admin/moderation/:jobId/remove`; the company gets `job_moderated {jobId, removedAt, removedReason, status}`, applicants get `job_removed {jobId}`.
- The applicant chime is generated with Web Audio and is **off by default** (Recruiter → Settings → "Sound for new applicants").
- Slot booking (as built): `POST /api/calendar/invites` (recruiter, 1–10 non-overlapping future times, one open invite per application), `GET /api/calendar/invites` (seeker: own; recruiter: `?applicationId=`), `POST /api/calendar/invites/:id/book {slotId}` (only one booking wins, 409 `SLOT_TAKEN`), `POST /api/calendar/invites/:id/cancel`. Booking creates the calendar event, moves APPLIED/IN_PROCESS to INTERVIEWING and e-mails both sides an .ics. Events: `interview_invite_received`, `interview_invite_updated`, `calendar_event_confirmed`.
- Scorecards (as built): `GET/PUT /api/scorecards/applications/:id`, criteria per job via `PUT /api/scorecards/jobs/:jobId/competencies` (default four). OWNER, RECRUITER and HIRING_MANAGER submit; VIEWERs see only the submitted count. Blind: content and debrief unlock after you submit (owners always see). `scorecard_submitted` carries only `{applicationId, interviewerId, submittedCount}`. Seekers never see scorecards.
- Offers (as built): `POST /api/offers` (one live offer per application; moves to OFFER), `GET /api/offers` (seeker: own; team: `?applicationId=`), `POST /api/offers/:id/accept {signatureName, agree:true}`, `/decline {reason?}`, `/withdraw`. Acceptance is a **typed-name signature** with time + IP in the audit log (not a qualified e-signature). Events: `offer_extended` (seeker), `offer_updated`, `offer_accepted` / `offer_declined` (team), admin `placement` metric. SENT offers past `expiresAt` read as EXPIRED.
- Talent search (as built): seekers opt in via Settings → Privacy (`openToRecruiters`, off by default). `GET /api/talent-search?q=&location=` ranks opted-in, active, non-blocking seekers (title ×3, skills ×2, experience ×2, bio ×1; embeddings not used yet). Cards never include e-mail, phone or CV. `POST /api/talent-search/:seekerId/outreach {jobId, message}` debits `outreachCost` (default 5, admin-editable) and creates a `SOURCED` application (source `OUTREACH`) with the first message; contact details stay masked until the seeker answers `POST /api/talent-search/outreach/:applicationId/respond {interested}` (Interested → APPLIED, free; else ARCHIVED). Seekers can block a company (`CompanyBlock`). Event: `outreach_received`. The board shows a \"Reached out\" column only while it has cards.
- Jobs from the web (as built): postings from **licensed job APIs** (Adzuna, Jooble with keys; Remotive and Arbeitnow free), never scraped. LinkedIn and Indeed forbid scraping and offer no open jobs API. Sync every 6 h when `EXTERNAL_JOBS_ENABLED=true` (`external-jobs` queue), de-duplicated across sources, scam-filtered with the same content policy as Hyrr jobs, and hidden `EXTERNAL_JOBS_TTL_DAYS` after last seen. Seekers see them in Discover → From the web; `POST /api/external-jobs/:id/apply` charges `externalApplyCost` (default 1, admin-editable) once, adds the job to the tracker and returns the original URL, which opens in a new tab (reopening is free). Admin → Settings shows provider status and has Sync now (audited).
- Resume tailor (as built): Discover job details → "Tailor my CV" (`POST /api/seeker-ai/tailor {jobId, rerun?}`, `GET /api/seeker-ai/tailor/:jobId`). Uses the active CV text plus the profile and returns match score, summary, strengths, missing keywords, gaps and rewritten bullets (zod-validated). Costs `resumeTailorCost` (default 2, admin-editable), is refunded automatically if the AI fails, charges nothing without an AI provider, and is saved per job so reopening is free. Prices for the mock interview (3) and negotiation advice (1) are already in Admin → Pricing. Adapters gained a generic `structured()` call.
- Practice interview (as built): Applications → "Practice interview" on applied, in-process and interviewing applications. `POST /api/seeker-ai/mock-interviews {jobId}` charges `mockInterviewCost` (default 3; refunded if question generation fails) and creates 5 questions (3 role, 2 behavioural, using the job's screening questions). `POST /api/seeker-ai/mock-interviews/:id/answers {index, answer}` grades each written answer with STAR flags, feedback and a stronger answer, included in the price; after the last answer a readiness summary completes the session. Voice answers come later.
- Salary benchmark (as built): `GET /api/seeker-ai/salary-benchmark?title=&currency=&location=` gives yearly p25/median/p75 from real postings (Hyrr jobs and jobs from the web) in **one currency, with no currency conversion**, and no figures below 10 samples. It's free and shown as "Market check" in the seeker's offer panel. `POST /api/seeker-ai/offers/:offerId/negotiation` (open offers only) returns an assessment, a counter-offer in the offer's currency and period, talking points and an e-mail draft; it costs `negotiationAdviceCost` (default 1, refunded on AI failure).
- Skill badges (as built): 14 curated skills (`ASSESSABLE_SKILLS`). `POST /api/seeker-ai/skills/tests {skill}` samples 10 questions from a server-side bank (AI tops it up to 15+ when low; answers never leave the server), with a 10-minute limit enforced on submit. `POST …/:id/submit {answers}` grades on the server and returns only the score; at least 80% earns a badge for 12 months, and a retake is allowed after 7 days. It's free. Badges show on the seeker profile and on talent-search cards, with a ×1.25 ranking boost.
- External tracker (as built): `GET/POST/PATCH/DELETE /api/external-applications` (seeker-only, private, max 300, free). Shown on the seeker's Applications page under "Jobs you applied to elsewhere", grouped by stage (Bookmarked, Applied, Interviewing, Offer, Rejected) with a stage select per card rather than drag and drop.
- The event catalogue lives in `hyrr.shared/src/lib/contracts.ts` (`SYNC_SOCKET_EVENTS`); new events are added there as each phase lands.

---

## 1. System Architecture & Foundation

Hyrr is a multi-sided recruiting platform consisting of three frontends, one shared core library, and one backend:

```
                                 ┌────────────────────────────────────────────────┐
                                 │                  hyrr.shared                   │
                                 │ (Zustand Store, API Client, Zod Schemas, UI Kit)│
                                 └───────────────┬────────────────┬───────────────┘
                                                 │                │
                        ┌────────────────────────┼────────────────────────┐
                        ▼                        ▼                        ▼
               hyrr.jobseeker             hyrr.recruiter             hyrr.admin
             (Candidate Career OS)       (Employer ATS)        (Governance & Ops)
             Port: 5174                  Port: 5173            Port: 5175
                        │                        │                        │
                        └────────────────────────┼────────────────────────┘
                                                 │ REST API (/api) + WebSockets
                                                 ▼
                                           hyrr.backend
                               (NestJS 11 + Prisma 6 + PostgreSQL +
                                Redis + BullMQ + Socket.io + Meilisearch)
```

### Core Mechanisms Already in Place:

- **Design System**: Strict 8px spacing grid, rounded cards (`rounded-card` = 24px), buttons/inputs (`rounded-button` = 18px), spring physics (`stiffness: 350, damping: 25`), dark/light tokens in [`hyrr.shared`](file:///Users/Jimmy/Documents/hyrr/hyrr.shared).
- **Momentum Credits Economy**: Dual-sided micro-economy ([`CreditWallet`](file:///Users/Jimmy/Documents/hyrr/hyrr.backend/prisma/schema.prisma#L746), [`CreditTransaction`](file:///Users/Jimmy/Documents/hyrr/hyrr.backend/prisma/schema.prisma#L757)):
  - Recruiters pay credits to publish, feature jobs, and re-run AI matching.
  - Job seekers pay 1 credit per application (preventing resume blast spam; refunded if job is removed unreviewed).
- **FinTech Integration**: Dual-gateway processing in [`Payment`](file:///Users/Jimmy/Documents/hyrr/hyrr.backend/prisma/schema.prisma#L471):
  - **Stripe** (USD) for global credit card checkout and subscriptions.
  - **Chapa** (Ethiopian Birr / Santim) for East African and emerging market payments.
- **AI Matching**: Multi-dimensional scoring ([`scoring.ts`](file:///Users/Jimmy/Documents/hyrr/hyrr.backend/src/matching/scoring.ts)) + OpenAI vector embeddings ([`text-embedding-3-small`](file:///Users/Jimmy/Documents/hyrr/hyrr.backend/src/embeddings/embeddings.service.ts)).
- **Real-Time Sockets**: Redis-backed Socket.io gateway ([`MessagesGateway`](file:///Users/Jimmy/Documents/hyrr/hyrr.backend/src/messages/messages.gateway.ts)) broadcasting to rooms:
  - `user_${userId}`: Personal notifications, status changes, wallet balance updates.
  - `company_${companyId}`: Recruiter team-wide pipeline events, applicant arrivals, AI scores.
  - `chat_${applicationId}`: Real-time messaging, typing indicators, read receipts.

---

## 2. Global Benchmark: What World-Class Platforms Do

To build a globally dominant recruiting app, Hyrr incorporates the best features from market leaders worldwide:

```
                            GLOBAL RECRUITING & ATS LANDSCAPE
   Modern ATS / Hiring Platforms    Global Talent Networks       AI Seeker Tools
   ┌───────────────────────────┐    ┌────────────────────┐    ┌─────────────────┐
   │ Ashby                     │    │ LinkedIn Recruiter │    │ Teal HQ         │
   │ Greenhouse / Lever        │    │ Otta (Welcome)     │    │ Huntr           │
   │ Rippling Recruiting       │    │ Wellfound          │    │ Metaview        │
   └───────────────────────────┘    └────────────────────┘    └─────────────────┘
```

| Dimension                 | Leading Competitors Worldwide                                                                  | Hyrr Current State                                                                                                                    | Target Competitive Advantage                                                                                             |
| :------------------------ | :--------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------- |
| **Recruiter Sourcing**    | **LinkedIn Recruiter & Ashby**: AI search across passive candidate pools, InMail outreach.     | Recruiters only see inbound candidates who applied to their jobs.                                                                     | **AI Semantic Headhunting**: Search public seeker profiles with natural language + 1-click Momentum InMail.              |
| **Interview Scheduling**  | **Ashby & Calendly**: Self-serve candidate booking links with calendar synchronization.        | Basic manual event creation in [`CalendarService`](file:///Users/Jimmy/Documents/hyrr/hyrr.backend/src/calendar/calendar.service.ts). | **Native In-App Slot Booking**: Recruiter shares slots; candidate picks inside Seeker app; auto-syncs to Google/Outlook. |
| **Structured Hiring**     | **Greenhouse**: Standardized scorecards, blind evaluation rubrics, stage SLAs.                 | Free-text [`ApplicationNote`](file:///Users/Jimmy/Documents/hyrr/hyrr.backend/prisma/schema.prisma#L607-L617).                        | **Collaborative Scorecards**: 1–5 competency rating rubrics with team debrief consensus mode.                            |
| **Candidate Empowerment** | **Teal & Kickresume**: AI ATS resume customization per job; **Huntr**: Multi-platform tracker. | Static PDF uploads in [`Documents.tsx`](file:///Users/Jimmy/Documents/hyrr/hyrr.jobseeker/src/pages/Documents.tsx).                   | **1-Click AI Resume Tailor** + **Interactive AI Mock Interview Simulator**.                                              |
| **Candidate Trust**       | **Otta & Wellfound**: Salary transparency bands, "Fast Responder" badges, no ghosting.         | Salary ranges displayed in [`DiscoverJobs.tsx`](file:///Users/Jimmy/Documents/hyrr/hyrr.jobseeker/src/pages/DiscoverJobs.tsx).        | **Anti-Ghosting SLAs**: Recruiter responsiveness score + automated constructive candidate feedback.                      |
| **Offer Management**      | **Rippling & Ashby**: Digital offer letters, compensation breakdowns, e-signatures.            | Plain text `offerAmount` field in [`Application`](file:///Users/Jimmy/Documents/hyrr/hyrr.backend/prisma/schema.prisma#L356).         | **Digital Interactive Offer Letters**: Formalized terms with in-app candidate acceptance and e-signature.                |

---

## 3. High-Impact Feature Roadmap by Application

### 📱 A. Job Seeker App (`hyrr.jobseeker`) — "The AI Career Copilot & Operating System"

1. **1-Click AI Resume Tailor & ATS Keyword Gap Analyzer**:
   - Location: Job detail view in [`DiscoverJobs.tsx`](file:///Users/Jimmy/Documents/hyrr/hyrr.jobseeker/src/pages/DiscoverJobs.tsx).
   - Compares candidate's uploaded resume/profile against the specific job posting.
   - Outputs: ATS Match Score (0–100%), missing keywords list, hard skills gap, and generated bullet point revisions with quantified achievements.
2. **Interactive AI Mock Interview Simulator**:
   - Location: New tab in [`Applications.tsx`](file:///Users/Jimmy/Documents/hyrr/hyrr.jobseeker/src/pages/Applications.tsx) or standalone practice room.
   - Generates 5 dynamic technical and behavioral interview questions tailored to the job's requirements and screening questions.
   - Candidate records/types answers; AI provides real-time scoring and coaching based on the **STAR framework** (Situation, Task, Action, Result).
3. **Universal Job Tracker (Unified Career Kanban)**:
   - Location: [`Applications.tsx`](file:///Users/Jimmy/Documents/hyrr/hyrr.jobseeker/src/pages/Applications.tsx).
   - Allows seekers to manually add external job applications (from LinkedIn, Indeed, direct company portals) alongside Hyrr applications.
   - Custom stages (Bookmarked, Applied, Interviewing, Offer, Rejected).
   - Makes Hyrr the candidate's **daily job hunt dashboard**, driving continuous daily retention.
4. **"Hyrr Verified" Skills Badges**:
   - 10-minute micro-assessments (TypeScript, React, Python, Product Design, Financial Modeling).
   - Candidates earning $\ge 80\%$ get a glowing "Verified" badge on their profile and a 1.25x ranking boost in recruiter candidate searches.
5. **Salary Benchmarking & AI Offer Negotiation Advisor**:
   - Real-time salary percentile distribution based on country, seniority, and remote status.
   - When an application moves to `OFFER`, unlocks an AI Negotiation Copilot with customized counter-offer email templates and total compensation analysis.

---

### 💼 B. Recruiter App (`hyrr.recruiter`) — "The High-Velocity ATS & Talent Sourcing Engine"

1. **AI Talent Sourcing & Outbound Headhunting (Passive Talent Pool)**:
   - Location: New _"Talent Search"_ view in [`Candidates.tsx`](file:///Users/Jimmy/Documents/hyrr/hyrr.recruiter/src/pages/Candidates.tsx).
   - Natural language search across all public seeker profiles (e.g. _"Full stack engineer with 3+ years NestJS and PostgreSQL in Nairobi or Remote"_).
   - Direct outreach costs 5 Momentum credits (Hyrr's native InMail).
2. **Self-Serve Automated Interview Scheduling (Built-In Calendly)**:
   - Location: Integrated into candidate modal in [`candidate-detail-dialog.tsx`](file:///Users/Jimmy/Documents/hyrr/hyrr.recruiter/src/components/layout/candidate-detail-dialog.tsx).
   - Recruiter connects Google Calendar / Outlook or defines availability blocks.
   - Recruiter sends a scheduling invite; candidate picks a time slot directly in the Seeker App; calendar event is created for both parties with meeting link (Google Meet / Zoom).
3. **Structured Interview Scorecards & Blind Evaluation Rubrics**:
   - Standardized evaluation criteria: Technical Competence, Problem Solving, Communication, Culture Add (1–5 scale + written feedback).
   - **Blind evaluation mode**: interviewers cannot view colleagues' scorecards until their own is submitted, preventing groupthink and anchoring bias.
   - Hiring team debrief summary screen with consensus recommendation.
4. **Automated Drip Sequences & Anti-Ghosting Triggers**:
   - Auto-acknowledgment emails upon application submission.
   - Inactivity alerts when a candidate has spent $>5$ business days in a stage without recruiter action.
   - 1-click courteous rejection with optional AI-assisted constructive feedback.
5. **Digital Offer Management & In-App E-Signature**:
   - Formalized offer generator (Base salary, Bonus/Equity, Start date, Benefits, Expiration date).
   - Candidate receives an interactive offer card with "Review & Accept" and digital signature directly inside the Seeker app.
6. **Career Site Embed & Google for Jobs Rich Microdata**:
   - 1-click embeddable JavaScript snippet for company websites (`careers.yourcompany.com`).
   - Schema.org `JobPosting` JSON-LD microdata on all public job URLs for organic Google for Jobs indexing.

---

### 🛡️ C. Admin App (`hyrr.admin`) — "Platform Governance, Liquidity & Trust"

1. **Marketplace Liquidity & Talent Supply/Demand Heatmap**:
   - Location: [`Analytics.tsx`](file:///Users/Jimmy/Documents/hyrr/hyrr.admin/src/pages/Analytics.tsx).
   - Ratio of active candidates vs. open positions per category, seniority, and location.
   - Identifies undersupplied markets to guide recruiter acquisition and pricing.
2. **Company Trust Score & "Fast Responder" Badging**:
   - Tracks median recruiter response time and application review rate.
   - Grants "Fast Responder" badge to responsive companies (increasing candidate application rates by $\sim 35\%$).
   - Flags companies with $>80\%$ ghosting rates for admin follow-up.
3. **AI Performance, Drift & Cost Observatory**:
   - Location: [`Settings.tsx`](file:///Users/Jimmy/Documents/hyrr/hyrr.admin/src/pages/Settings.tsx).
   - Real-time token consumption, latency, and costs per provider (OpenAI, Anthropic, Gemini).
   - Recruiter feedback analytics (ratio of thumbs-up on AI candidate scores) to detect prompt drift.
4. **Scam Job & Fraud Detection Engine**:
   - Automated screening heuristics flagging scam postings (unrealistic compensation, external Telegram/WhatsApp wire traps, phishing links) before jobs go live.

---

## 4. Cross-App Real-Time Synchronization Specification

The three apps must function as a single live synchronized ecosystem through Redis-backed WebSockets:

```mermaid
sequenceDiagram
    autonumber
    actor Seeker as hyrr.jobseeker (Candidate)
    participant Backend as hyrr.backend (API & Sockets)
    actor Recruiter as hyrr.recruiter (Employer ATS)
    actor Admin as hyrr.admin (Platform Ops)

    %% Flow 1: Candidate Applies
    Note over Seeker,Admin: Flow 1: Candidate Applies to Job
    Seeker->>Backend: POST /api/applications (Deducts 1 Momentum Credit)
    Backend->>Backend: BullMQ Queue: Score application in background
    Backend-->>Seeker: 201 Created (Wallet balance decremented)
    Backend-->>Recruiter: socket.to("company_id").emit("candidate_applied", application)
    Note over Recruiter: Kanban "Applied" column gains card live with ping sound!
    Backend-->>Admin: socket.to("admin_channel").emit("credit_ledger_entry", tx)
    Note over Admin: Revenue & credit velocity counters increment live!

    %% Flow 2: Recruiter Advances Stage & Invites to Interview
    Note over Seeker,Admin: Flow 2: Recruiter Moves Candidate & Offers Interview Slots
    Recruiter->>Backend: PATCH /api/applications/:id/status ("INTERVIEWING")
    Backend-->>Seeker: socket.to("user_seekerId").emit("application_status_updated")
    Note over Seeker: Candidate Applications board transitions status in real-time
    Recruiter->>Backend: POST /api/calendar/slots/invite (dates, meetingLink)
    Backend-->>Seeker: socket.to("user_seekerId").emit("interview_invite_received")
    Note over Seeker: Interactive modal opens: "Choose your interview time slot"
    Seeker->>Backend: POST /api/calendar/slots/book
    Backend-->>Recruiter: socket.to("company_id").emit("calendar_event_confirmed")
    Note over Recruiter: Recruiter Calendar updates live with confirmed slot

    %% Flow 3: Recruiter Extends Offer & Candidate Signs
    Note over Seeker,Admin: Flow 3: Digital Offer Letter & E-Signature
    Recruiter->>Backend: POST /api/applications/:id/offer (terms)
    Backend-->>Seeker: socket.to("user_seekerId").emit("offer_extended", offer)
    Note over Seeker: Offer modal opens with compensation & e-signature pad
    Seeker->>Backend: POST /api/applications/:id/offer/accept (signature)
    Backend-->>Recruiter: socket.to("company_id").emit("offer_accepted")
    Backend-->>Admin: socket.to("admin_channel").emit("placement_recorded")
    Note over Recruiter,Admin: Recruiter Kanban shows confetti banner; Admin tracks placement!

    %% Flow 4: Admin Moderation
    Note over Seeker,Admin: Flow 4: Admin Moderates Job or Verifies Company
    Admin->>Backend: POST /api/admin/jobs/:id/remove
    Backend-->>Seeker: socket.emit("job_removed", { jobId })
    Backend-->>Recruiter: socket.to("company_id").emit("job_moderated", { reason })
    Note over Seeker,Recruiter: Job disappears from Discover; Recruiter sees moderation alert banner
```

---

## 5. Synchronized Data Contracts (`hyrr.shared`)

Add the following unified types to [`hyrr.shared/src/store/types.ts`](file:///Users/Jimmy/Documents/hyrr/hyrr.shared/src/store/types.ts) and [`hyrr.shared/src/lib/contracts.ts`](file:///Users/Jimmy/Documents/hyrr/hyrr.shared/src/lib/contracts.ts):

```typescript
// Shared Real-Time Socket Event Catalog
export const SYNC_SOCKET_EVENTS = {
  // Candidate Lifecycle
  CANDIDATE_APPLIED: "candidate_applied",
  APPLICATION_STATUS_UPDATED: "application_status_updated",
  CANDIDATE_AI_SCORED: "candidate_ai_scored",
  SCORECARD_SUBMITTED: "scorecard_submitted",

  // Scheduling Lifecycle
  INTERVIEW_INVITE_RECEIVED: "interview_invite_received",
  INTERVIEW_SLOT_BOOKED: "interview_slot_booked",
  CALENDAR_EVENT_CONFIRMED: "calendar_event_confirmed",

  // Offer Lifecycle
  OFFER_EXTENDED: "offer_extended",
  OFFER_ACCEPTED: "offer_accepted",
  OFFER_DECLINED: "offer_declined",

  // Governance & Economy
  WALLET_UPDATED: "wallet_updated",
  JOB_MODERATED: "job_moderated",
  COMPANY_VERIFIED: "company_verified",
} as const

// Structured Scorecard Contract
export interface ScorecardInput {
  applicationId: string
  interviewerId: string
  recommendation: "STRONG_YES" | "YES" | "NEUTRAL" | "NO" | "STRONG_NO"
  ratings: {
    competency: string // e.g. "Technical Skills", "Communication", "Culture Add"
    score: number // 1 to 5
    notes?: string
  }[]
  overallNotes: string
}

// Digital Offer Contract
export interface DigitalOffer {
  id: string
  applicationId: string
  jobTitle: string
  baseSalary: number
  salaryCurrency: string
  salaryPeriod: "YEAR" | "MONTH"
  equityPercentage?: number
  bonusAmount?: number
  startDate: string
  expiresAt: string
  benefits: string[]
  status: "DRAFT" | "SENT" | "ACCEPTED" | "DECLINED" | "EXPIRED"
  signatureUrl?: string
  signedAt?: string
}
```

---

## 6. Implementation Phasing

```
PHASE 1: Core Real-Time Synchronization (Priority: Critical)
├── Backend: Broadcast `candidate_applied` to `company_${companyId}` on application submission
├── Backend: Broadcast `application_status_updated` to candidate socket on kanban drag
├── Recruiter App: Listen to `candidate_applied` and append card with animation + sound
└── Seeker App: Listen to status updates and animate stage changes in real time

PHASE 2: Recruiter Superpowers (Priority: High)
├── Recruiter App: Outbound Talent Search tab in Candidates.tsx (search public SeekerProfiles)
├── Recruiter App: Self-serve Calendly-style interview slot creator
├── Seeker App: Interactive slot selection dialog in Calendar & Messages
└── Backend: Structured Scorecards & Blind Rubric evaluation schema

PHASE 3: Seeker AI Copilot & Career CRM (Priority: High)
├── Seeker App: 1-click AI Resume Tailor & ATS keyword gap analysis modal
├── Seeker App: Interactive AI Mock Interview practice room (STAR feedback)
└── Seeker App: External Job Application tracker on candidate board

PHASE 4: Admin Liquidity & Governance (Priority: Medium)
├── Admin App: Supply/Demand Marketplace Liquidity Heatmap
├── Admin App: Company Responsiveness Score & "Fast Responder" badging
└── Backend: Scam job detection heuristics in the job ingestion queue
```

# Hyrr

A recruiting platform made of three web apps and one API:

| App                      | Who uses it                                                                                                        | Local URL                 | Folder           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------- | ---------------- |
| **Recruiter**            | Companies: post jobs, run the hiring pipeline (kanban), message candidates, manage their team and Momentum credits | http://localhost:5173     | `hyrr.recruiter` |
| **Careers** (job seeker) | Candidates: discover jobs ("For you" matching), apply, track applications, message recruiters, job alerts          | http://localhost:5174     | `hyrr.jobseeker` |
| **Admin**                | Hyrr staff: dashboard and analytics, moderation, users, companies, money, pricing, AI settings, audit log          | http://localhost:5175     | `hyrr.admin`     |
| **API**                  | REST under `/api` + socket.io (live messages, notifications, admin actions)                                        | http://localhost:3000/api | `hyrr.backend`   |

`hyrr.shared` holds the code shared by the three apps (store, API client, UI kit, auth pages, messaging). It isn't deployed on its own.

**Stack:** NestJS 11 + Prisma 6 + PostgreSQL, optionally Redis, Meilisearch and ClamAV. The apps use React 19 + Vite + Tailwind 4. Everything is TypeScript in one npm workspaces monorepo.

---

## Contents

1. [Quick start with Docker](#1-quick-start-with-docker)
2. [Local development without Docker](#2-local-development-without-docker)
3. [Accounts: seekers, recruiters, companies and admins](#3-accounts-seekers-recruiters-companies-and-admins)
4. [Configuration overview](#4-configuration-overview)
5. [Backend configuration (`hyrr.backend/.env`)](#5-backend-configuration-hyrrbackendenv)
6. [Frontend configuration (the three apps)](#6-frontend-configuration-the-three-apps)
7. [Setting up each external service, step by step](#7-setting-up-each-external-service-step-by-step)
8. [Database and migrations](#8-database-and-migrations)
9. [Deploying to staging or production](#9-deploying-to-staging-or-production)
10. [Commands reference](#10-commands-reference)
11. [Testing and CI](#11-testing-and-ci)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Quick start with Docker

Requirements: Docker Desktop (or Docker Engine with Compose v2).

```bash
cp hyrr.backend/.env.example hyrr.backend/.env
# Required: set JWT_SECRET to a long random value
openssl rand -base64 48        # paste the output into JWT_SECRET in hyrr.backend/.env

docker compose up --build
```

This starts:

| Service                             | Host port               | Notes                                                                 |
| ----------------------------------- | ----------------------- | --------------------------------------------------------------------- |
| `postgres`                          | **5433**                | user `hyrr_user`, password `hyrr_password`, DB `hyrr_db`              |
| `redis`                             | **6380**                | queues, cache, shared rate limits, socket fan-out                     |
| `meilisearch`                       | 7701                    | job search (the API falls back to Postgres without it)                |
| `backend`                           | `${BACKEND_PORT:-3000}` | runs `prisma migrate deploy` before starting                          |
| `recruiter` / `jobseeker` / `admin` | 5173 / 5174 / 5175      | static builds served by nginx                                         |
| `backup`                            | none                    | nightly `pg_dump` (7 daily + 4 weekly) into the `backups_data` volume |

Options:

- **Demo data** (companies, jobs and a demo seeker): `SEED_DEMO_DATA=true docker compose up --build`. Never use it in production.
- **Port 3000 taken** by another app: create a root `.env` with `BACKEND_PORT=3001`. The API and the apps' `VITE_API_URL`/`VITE_SOCKET_URL` defaults follow that port automatically.
- **Virus scanning:** `CLAMAV_HOST=clamav docker compose --profile security up`.
- **Separate queue workers:** `QUEUE_WORKER=false docker compose --profile worker up --scale worker=2`.

Then create your first admin (see [§3](#3-accounts-seekers-recruiters-companies-and-admins)).

> The compose file reads two env files:
>
> - `hyrr.backend/.env` holds every backend secret.
> - An optional root `.env` holds compose-level values (`BACKEND_PORT`, `MEILI_MASTER_KEY`, the `VITE_*` build args, public URLs).
>
> Values under `environment:` in `docker-compose.yml` win over `hyrr.backend/.env`. Inside Docker, `DATABASE_URL`, `REDIS_HOST` and `MEILI_HOST` always point at the containers.

---

## 2. Local development without Docker

Requirements: Node 22+, npm 10+, PostgreSQL 16+ (Redis optional).

```bash
npm install                                   # installs every workspace
cp hyrr.backend/.env.example hyrr.backend/.env  # then edit it (§5)

# Database: either the docker one only…
docker compose up -d postgres redis           # Postgres on 5433, Redis on 6380
# …or your own Postgres: point DATABASE_URL at it.

cd hyrr.backend
npx prisma generate
npx prisma migrate deploy                     # applies every migration
npm run seed                                  # optional demo data
cd ..

npm run dev:backend      # API on :3000 (watch mode, reads hyrr.backend/.env)
npm run dev:recruiter    # :5173
npm run dev:jobseeker    # :5174
npm run dev:admin        # :5175
```

Without any optional keys the platform still works:

- E-mails are printed to the API log, including verification and reset links.
- AI scoring is off and the assistant gives canned tips.
- Search uses Postgres, files are stored on disk, captcha is off and payments return "unavailable".

Add services one by one as you need them ([§7](#7-setting-up-each-external-service-step-by-step)).

**Demo accounts** (only after seeding):

| Role       | E-mail                                                                        | Password       |
| ---------- | ----------------------------------------------------------------------------- | -------------- |
| Seeker     | `jordan@example.com`                                                          | `Password123!` |
| Recruiters | `alex@acme.com`, `sara@nexuslabs.io`, `marcus@stellar.io`, `layla@orbit.tech` | `Password123!` |

---

## 3. Accounts: seekers, recruiters, companies and admins

### Roles

- `SEEKER` uses the Careers app. Sign-up gives a personal Momentum wallet with a welcome bonus (default 10 credits); each application costs 1 credit.
- `RECRUITER` uses the Recruiter app and always works inside a **company**. Company roles are `OWNER`, `RECRUITER`, `HIRING_MANAGER` and `VIEWER`; viewers and hiring managers can't change data.
- `ADMIN` uses the Admin app. Admins can't sign up.

### How companies and teams are created

1. **Recruiter sign-up** asks for a company name and an optional website. The new company gets the recruiter welcome bonus (default 20 credits), and the recruiter becomes its OWNER.
2. **Sign-up with Google, GitHub or LinkedIn**, or **leaving a team**, leads to a "Set up your company" screen. There the recruiter creates a company or asks to join one. Each person gets the welcome bonus only once.
3. **Invites:** the owner opens **Team → Invite a colleague**. The colleague receives an e-mail link (`/invite?token=…`) that is valid for 7 days and works once.
   - Open invites count toward the plan's seats (Starter 3, Pro 10, Enterprise unlimited).
   - New people sign up straight through the link, so no extra company is created.
   - Existing recruiters get an Accept/Decline dialog.
4. **Join requests:** if a recruiter's e-mail domain matches a **verified** company's website domain, sign-up offers "Ask to join". The owner approves (choosing a role) or declines in the Team panel. Free-mail domains such as Gmail never match.
5. **The verified badge** appears automatically when a member with a verified e-mail on the website's domain exists. Admins can also verify or remove the badge.
6. **Ownership:** owners can transfer ownership to a teammate, and members can leave. If an owner is gone, an admin can transfer ownership (a reason is required, and the action is audited).

### Admin accounts

Admins are created from the command line only. 2FA is required to use the Admin app.

```bash
# Local (uses hyrr.backend/.env → DATABASE_URL)
npm run admin:create --workspace=hyrr.backend -- admin@yourcompany.com "Your Name"

# Against the docker database from your machine
DATABASE_URL="postgresql://hyrr_user:hyrr_password@localhost:5433/hyrr_db?schema=public" \
  npm run admin:create --workspace=hyrr.backend -- admin@yourcompany.com "Your Name"

# Inside the running container
docker compose exec backend node scripts/admin-create.cjs admin@yourcompany.com "Your Name"
```

- **New account:** a random password is printed **once**, and the e-mail is marked verified.
- **Existing account:** it is promoted to admin.
- **First sign-in** at http://localhost:5175 asks you to turn on two-factor authentication with any authenticator app. Keep the recovery codes.
- **Removing admin rights:** `npm run admin:revoke --workspace=hyrr.backend -- admin@yourcompany.com`.

---

## 4. Configuration overview

| Where                  | What goes there                                                                                                                                             | Read when                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `hyrr.backend/.env`    | Every backend setting and secret ([§5](#5-backend-configuration-hyrrbackendenv)). Template: `hyrr.backend/.env.example`. **Never commit it.**               | API start-up              |
| Root `.env` (optional) | Docker Compose variables: `BACKEND_PORT`, `MEILI_MASTER_KEY`, `PUBLIC_API_URL`, `CORS_ORIGINS`, `FRONTEND_URL`, `VITE_*`, `BACKUP_SCHEDULE`, `QUEUE_WORKER` | `docker compose`          |
| `VITE_*` variables     | The apps' API URL, captcha site key and Sentry DSN ([§6](#6-frontend-configuration-the-three-apps)). **Baked in at build time.**                            | `vite build` / `vite dev` |
| Admin app → Settings   | Momentum prices and packs, signup bonuses, AI model. Stored in the database, so they override the env defaults.                                             | Live (cached 60 s)        |

Placeholder values (`your_google_client_id`, `sk-...`, `AIza...`) count as **not set**: the feature simply turns off.

---

## 5. Backend configuration (`hyrr.backend/.env`)

### 5.1 Application

| Key              | Required | Default                 | Description                                                                                                  |
| ---------------- | -------- | ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| `NODE_ENV`       |          | `development`           | `production` enables strict checks (the JWT secret must be real, demo seeding is refused) and hides Swagger. |
| `PORT`           |          | `3000`                  | API port inside the process/container.                                                                       |
| `PUBLIC_API_URL` | prod     | `http://localhost:3000` | Public base URL of the API. Used for upload links and the Chapa callback.                                    |
| `ENABLE_SWAGGER` |          | `false`                 | API docs at `/api/docs` are on outside production; `true` forces them on in production.                      |
| `TRUST_PROXY`    | prod     | `false`                 | `true` behind a reverse proxy or load balancer (trusts one `X-Forwarded-For` hop, for rate limits and logs). |
| `SUPPORT_EMAIL`  |          | `EMAIL_FROM` address    | Shown to suspended users and companies ("contact …").                                                        |

### 5.2 Database and Redis

| Key                          | Required | Default    | Description                                                                                                                                               |
| ---------------------------- | -------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`               | **yes**  |            | PostgreSQL URL. The Docker DB from your machine is `postgresql://hyrr_user:hyrr_password@localhost:5433/hyrr_db?schema=public`.                           |
| `REDIS_HOST`                 |          | empty      | Empty means no Redis: in-process cache, queues and rate limits, which is fine for a single instance. Set it for production or for more than one instance. |
| `REDIS_PORT`                 |          | `6379`     | The Docker Redis is on **6380** from your machine.                                                                                                        |
| `REDIS_PASSWORD`, `REDIS_DB` |          | empty, `0` |                                                                                                                                                           |

### 5.3 Authentication and security

| Key                         | Required    | Default                  | Description                                                                                                                                                |
| --------------------------- | ----------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `JWT_SECRET`                | **yes**     |                          | At least 32 random characters (`openssl rand -base64 48`). The server refuses to start in production with the placeholder. Changing it signs everyone out. |
| `COOKIE_SAMESITE`           |             | `lax`                    | Refresh-token cookie: `lax`, `strict`, or `none` (forces `Secure`). Use `none` only when the apps and API are on different sites over HTTPS.               |
| `TWO_FACTOR_ENCRYPTION_KEY` | recommended | `JWT_SECRET`             | Encrypts stored 2FA secrets. Set it once and never change it, because changing it invalidates every enrolled authenticator.                                |
| `TWO_FACTOR_ISSUER`         |             | `Hyrr`                   | Name shown in authenticator apps.                                                                                                                          |
| `TURNSTILE_SECRET_KEY`      |             | empty                    | Cloudflare Turnstile captcha ([§7.4](#74-captcha--cloudflare-turnstile)). Pair it with `VITE_TURNSTILE_SITE_KEY`.                                          |
| `CORS_ORIGINS`              | **yes**     | the three localhost apps | Comma-separated origins of the three apps. Used for CORS, sockets and OAuth redirect validation.                                                           |
| `FRONTEND_URL`              | **yes**     | `http://localhost:5174`  | Careers app URL: seeker e-mail links and the OAuth fallback redirect.                                                                                      |
| `RECRUITER_APP_URL`         | **yes**     | `http://localhost:5173`  | Recruiter app URL: recruiter and admin e-mail links, team invite links, payment return pages.                                                              |

### 5.4 Sign-in with Google, GitHub and LinkedIn

All three are optional; set up only the ones you want ([§7.1](#71-google-sign-in)). The buttons are always shown, so an unset provider ends on the provider's own error page. Configure every provider you keep visible.

| Key                                            | Value                                          |
| ---------------------------------------------- | ---------------------------------------------- |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`     | From Google Cloud Console                      |
| `GOOGLE_CALLBACK_URL`                          | `${PUBLIC_API_URL}/api/auth/google/callback`   |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`     | From the GitHub OAuth App                      |
| `GITHUB_CALLBACK_URL`                          | `${PUBLIC_API_URL}/api/auth/github/callback`   |
| `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | From the LinkedIn app                          |
| `LINKEDIN_CALLBACK_URL`                        | `${PUBLIC_API_URL}/api/auth/linkedin/callback` |

### 5.5 E-mail (SMTP)

| Key                      | Default                        | Description                                                     |
| ------------------------ | ------------------------------ | --------------------------------------------------------------- |
| `SMTP_HOST`              | empty                          | Empty means e-mails are written to the API log instead of sent. |
| `SMTP_PORT`              | `587`                          | `587` uses STARTTLS; `465` uses implicit TLS.                   |
| `SMTP_SECURE`            | auto                           | `true` for port 465.                                            |
| `SMTP_USER`, `SMTP_PASS` |                                | SMTP login.                                                     |
| `EMAIL_FROM`             | `"Hyrr <no-reply@hyrr.local>"` | Must be a sender **verified** with your provider.               |

These e-mails are sent: verification, password reset and changed, team invites, application status, interviews, new messages, job alert digests, payment receipts, and notifications (respecting each user's preferences). Test the setup with `npm run email:test --workspace=hyrr.backend -- you@example.com`.

### 5.6 AI

| Key                                                       | Default                                                  | Description                                                                             |
| --------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `OPENAI_API_KEY`                                          |                                                          | Enough on its own for everything: scoring, the assistant, CV reading and embeddings.    |
| `ANTHROPIC_API_KEY`, `GOOGLE_AI_API_KEY`                  |                                                          | Alternative providers.                                                                  |
| `AI_PROVIDER`                                             | empty                                                    | Optional preference: `openai`, `anthropic` or `google`.                                 |
| `AI_MODEL_OPENAI` / `AI_MODEL_CLAUDE` / `AI_MODEL_GEMINI` | `gpt-4o-mini` / `claude-sonnet-5-5` / `gemini-2.5-flash` | The model per provider. These are also the choices in Admin → Settings → AI.            |
| `AI_FEATURED_MAX_CALLS`                                   | `5`                                                      | Cap on LLM calls per "featured jobs" computation.                                       |
| `EMBEDDINGS_ENABLED`                                      | `true`                                                   | Blends embedding similarity into "For you" matches. Needs an OpenAI key, which it uses. |
| `EMBEDDINGS_MODEL`                                        | `text-embedding-3-small`                                 |                                                                                         |

The active model is chosen in this order:

1. the admin-chosen model, if its provider has a key;
2. otherwise the `AI_PROVIDER` provider, if it has a key;
3. otherwise the first provider with a key, in the order OpenAI → Anthropic → Google.

With no key at all, AI analysis shows as "disabled"; it never records a fake score of 0.

### 5.7 Payments and Momentum credits

| Key                           | Description                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| `STRIPE_SECRET_KEY`           | Card payments (USD) and monthly plans. Without it, Stripe checkout returns 503 `PAYMENTS_UNAVAILABLE`. |
| `STRIPE_WEBHOOK_SECRET`       | Signing secret of `POST ${PUBLIC_API_URL}/api/billing/webhooks/stripe` ([§7.5](#75-payments--stripe)). |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Optional; hosted Checkout doesn't need it.                                                             |
| `CHAPA_SECRET_KEY`            | Ethiopian Birr payments ([§7.6](#76-payments--chapa)).                                                 |
| `CHAPA_WEBHOOK_SECRET`        | Optional HMAC secret for Chapa webhooks.                                                               |

The following pricing keys are **defaults only**: Admin → Settings → Pricing overrides them at runtime.

| Key                                               | Default | Meaning                                                                        |
| ------------------------------------------------- | ------- | ------------------------------------------------------------------------------ |
| `MOMENTUM_PUBLISH_BASE`                           | 10      | Credits to publish a job (×1.2 for remote, high-salary or premium categories). |
| `MOMENTUM_FEATURE_COST` / `MOMENTUM_FEATURE_DAYS` | 25 / 14 | Featuring a job.                                                               |
| `MOMENTUM_AI_RERUN_COST`                          | 2       | Re-running AI scoring.                                                         |
| `MOMENTUM_SIGNUP_BONUS`                           | 20      | Welcome credits for a new recruiter company.                                   |
| `MOMENTUM_APPLY_COST`                             | 1       | Credits per seeker application. Refunded if the job is removed before review.  |
| `MOMENTUM_SEEKER_SIGNUP_BONUS`                    | 10      | Welcome credits for a new seeker.                                              |
| `MOMENTUM_PREMIUM_CATEGORIES`                     | empty   | Comma-separated category slugs or names that cost ×1.2.                        |

### 5.8 File uploads

| Key                                                                                                                     | Default                   | Description                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `STORAGE_DRIVER`                                                                                                        | `local`                   | `local` (disk) or `s3` (AWS S3, Cloudflare R2 or MinIO).                                                                                       |
| `UPLOAD_DIR`                                                                                                            | `./uploads`               | Local driver directory. In Docker it is `/app/uploads`, on a volume.                                                                           |
| `UPLOAD_URL_SECRET`                                                                                                     | `JWT_SECRET`              | Signs download links. Stored URLs are re-signed on every read.                                                                                 |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`, `S3_PREFIX` |                           | S3 settings ([§7.7](#77-file-storage--s3--cloudflare-r2--minio)). Without `S3_BUCKET` the local driver is used.                                |
| `CLAMAV_HOST`, `CLAMAV_PORT`, `CLAMAV_TIMEOUT_MS`, `CLAMAV_FAIL_OPEN`                                                   | empty, 3310, 15000, false | Virus scanning of uploads. Empty host means no scanning. With `CLAMAV_FAIL_OPEN=false`, uploads are rejected (503) while clamd is unreachable. |

### 5.9 Search, queues, monitoring, limits and other settings

| Key                                                                               | Default                | Description                                                                                                           |
| --------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `MEILI_HOST`, `MEILI_MASTER_KEY`                                                  | empty                  | Meilisearch for public job search; Postgres is used when unset. In production the key must be at least 16 characters. |
| `MEILI_JOBS_INDEX`, `MEILI_TIMEOUT_MS`                                            | `jobs`, 2000           |                                                                                                                       |
| `QUEUE_DRIVER`                                                                    | auto                   | With Redis the queue runs on BullMQ; without it, in process. `inline` forces in-process.                              |
| `QUEUE_WORKER`                                                                    | `true`                 | `false` makes the instance enqueue jobs only (an API-only replica). At least one instance must process them.          |
| `QUEUE_CONCURRENCY_<QUEUE>`                                                       | 2 for AI, 5 for others | For example `QUEUE_CONCURRENCY_EMAIL=5`.                                                                              |
| `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`, `SENTRY_TRACES_SAMPLE_RATE` | empty                  | Error reporting (5xx only) ([§7.8](#78-error-monitoring--sentry)).                                                    |
| `RATE_LIMIT_PER_MINUTE`                                                           | 120                    | General per-IP limit.                                                                                                 |
| `RATE_LIMIT_STRICT_PER_MINUTE`                                                    | 10                     | Login, register, password reset, verification, 2FA and apply.                                                         |
| `RATE_LIMIT_AI_PER_MINUTE`                                                        | strict                 | `/api/ai/*`.                                                                                                          |
| `RATE_LIMIT_ADMIN_PER_MINUTE`                                                     | 300                    | Admin API.                                                                                                            |
| `JOB_REPORT_FLAG_THRESHOLD`                                                       | 5                      | Unique reports that hide a live job until an admin reviews it.                                                        |
| `ALERT_DIGESTS_ENABLED`                                                           | `true`                 | Daily (08:00 UTC) and weekly (Monday 08:00 UTC) job alert digests.                                                    |
| `SEED_DEMO_DATA`                                                                  | `false`                | Allows demo seeding in production. Leave it `false`.                                                                  |

---

## 6. Frontend configuration (the three apps)

All three apps read the same variables, and Vite bakes them into the bundle **at build time**. Changing one therefore needs a rebuild (`docker compose up --build`, or a new `npm run build`).

| Variable                  | Default                     | Description                                                                                          |
| ------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------- |
| `VITE_API_URL`            | `http://localhost:3000/api` | API base URL, including `/api`.                                                                      |
| `VITE_SOCKET_URL`         | origin of `VITE_API_URL`    | socket.io URL (no `/api`).                                                                           |
| `VITE_TURNSTILE_SITE_KEY` | empty                       | Captcha site key. The widget shows only when set, and the backend also needs `TURNSTILE_SECRET_KEY`. |
| `VITE_SENTRY_DSN`         | empty                       | Browser error reporting.                                                                             |

How to set them:

- **Local dev:** create `hyrr.recruiter/.env.local`, `hyrr.jobseeker/.env.local` and `hyrr.admin/.env.local`, for example `VITE_API_URL=http://localhost:3001/api`. The defaults work when the API runs on 3000.
- **Docker:** put them in the root `.env` or the shell. Compose passes them as build args to all three images.

Ports are fixed: Recruiter **5173**, Careers **5174**, Admin **5175** (`strictPort`). Keep the three origins in the backend's `CORS_ORIGINS`.

Each app works as follows:

- **Recruiter (5173):**
  - jobs, applications kanban, candidates, calendar, messages, analytics, Momentum (credits and plans), settings;
  - the Team panel (invites, join requests, ownership);
  - "Set up your company" for recruiters without a company;
  - links: e-mail verification, password reset, `/invite?token=…`.
- **Interview scheduling:** in the candidate panel's "Interview Scheduler" tab, recruiters can offer up to 10 times ("Let … pick a time"). The seeker picks one in the Careers app, which opens the picker live. Both calendars update instantly, and both sides get an e-mail with an `.ics` invite. Candidates without a Hyrr account are scheduled with a fixed time instead.
- **Offers:** the candidate panel's Offer tab sends formal terms (salary, currency, period, bonus, equity, start date, deadline, benefits). The candidate reviews them in the Careers app and accepts by typing their name; Hyrr records the time and IP address. This is an in-app acceptance, not a qualified e-signature. The hiring team sees the answer live.
- **Talent search:** seekers who turn on "Open to recruiters" (Settings → Privacy, off by default) can be found in the recruiter app (Candidates → Talent search). Reaching out costs `outreachCost` credits (default 5, set in Admin → Pricing). The seeker answers Interested (free, they become an applicant), Not interested, or blocks the company. Their e-mail, phone and CV stay hidden until they're interested.
- **Careers (5174):** Discover ("For you" or all jobs), applications, messages, notifications, calendar, documents (CV), job alerts, Momentum (seeker credits), profile, settings.
- **Live updates (all apps):** new applicants appear on the recruiter board without reloading (optional chime in Recruiter → Settings), teammates see each other's kanban moves, seekers see status changes and removed jobs, and the admin dashboard refreshes itself ("Live" dot) for admins with 2FA. Several API instances need Redis for this ([§7.11](#711-redis)).
- **Admin (5175):**
  - sign-in needs an admin account and 2FA;
  - every admin action is written to the audit log, and actions with consequences ask for a reason;
  - the people affected are notified in-app, by e-mail, and live over sockets.

---

## 7. Setting up each external service, step by step

Each one is optional. After changing `hyrr.backend/.env`, restart the API (`docker compose up -d --build backend`, or restart `npm run dev:backend`).

### 7.1 Google sign-in

1. Go to https://console.cloud.google.com and create a project (or select one).
2. Open **APIs & Services → OAuth consent screen**. Choose External, enter the app name and support e-mail, and add the scopes `openid`, `email` and `profile`. While the app is in "Testing", add your testers.
3. Open **Credentials → Create credentials → OAuth client ID** and choose **Web application**.
   - **Authorized redirect URI:** `http://localhost:3000/api/auth/google/callback` (production: `https://api.yourdomain.com/api/auth/google/callback`).
   - **Authorized JavaScript origins:** your app URLs.
4. Copy the client ID and secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and set `GOOGLE_CALLBACK_URL` to the same redirect URI.

### 7.2 GitHub sign-in

1. Go to https://github.com/settings/developers and choose **OAuth Apps → New OAuth App**.
2. Enter:
   - **Homepage URL:** your Careers URL.
   - **Authorization callback URL:** `http://localhost:3000/api/auth/github/callback`.
3. Generate a client secret, then set `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` and `GITHUB_CALLBACK_URL`. The app requests `read:user user:email`.

### 7.3 LinkedIn sign-in

1. Go to https://www.linkedin.com/developers/apps and create an app (it needs a LinkedIn company page).
2. Under **Products**, add **Sign In with LinkedIn using OpenID Connect**.
3. Under **Auth**, add the redirect URL `http://localhost:3000/api/auth/linkedin/callback`.
4. Set `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` and `LINKEDIN_CALLBACK_URL`. The scopes used are `openid profile email`.

> Sign-ins only succeed when the provider confirms the e-mail address. A recruiter's first OAuth sign-in leads to "Set up your company".

### 7.4 Captcha (Cloudflare Turnstile)

1. In https://dash.cloudflare.com → **Turnstile → Add widget**, add your hostnames (`localhost` for dev) and choose the "Managed" mode.
2. Put the **Site key** in `VITE_TURNSTILE_SITE_KEY` (frontends) and the **Secret key** in `TURNSTILE_SECRET_KEY` (backend). Then rebuild the apps.
3. The captcha is then required on sign-up, on forgot-password, and on login after repeated failures.

### 7.5 Payments (Stripe)

1. At https://dashboard.stripe.com, use **test mode** first. Under **Developers → API keys**, copy the secret key (`sk_test_…`) into `STRIPE_SECRET_KEY`.
2. Set up the webhook:
   - **Local:** run `stripe listen --forward-to localhost:3000/api/billing/webhooks/stripe` and copy the printed `whsec_…` into `STRIPE_WEBHOOK_SECRET`.
   - **Production:** in **Developers → Webhooks → Add endpoint**, use the URL `https://api.yourdomain.com/api/billing/webhooks/stripe`. Select these events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`. Copy its signing secret.
3. Payments return to `${RECRUITER_APP_URL}/momentum`. Credits are added when the webhook confirms the payment, so the webhook must be configured.
4. Test card: `4242 4242 4242 4242`, any future date, any CVC.

### 7.6 Payments (Chapa)

1. At https://dashboard.chapa.co → **Settings → API**, copy the secret key into `CHAPA_SECRET_KEY` (test keys work in test mode).
2. Optional: set a webhook secret in Chapa and put the same value in `CHAPA_WEBHOOK_SECRET`.
3. Chapa calls back `${PUBLIC_API_URL}/api/billing/webhooks/chapa`, so `PUBLIC_API_URL` must be reachable from the internet. For local testing, use a tunnel (for example `ngrok http 3000`) and set `PUBLIC_API_URL` to the tunnel URL.

### 7.7 File storage (S3, Cloudflare R2 or MinIO)

1. Create a **private** bucket.
2. Create access keys limited to that bucket (read, write, delete).
3. Set the keys:
   ```env
   STORAGE_DRIVER=s3
   S3_BUCKET=hyrr-uploads
   S3_ACCESS_KEY_ID=…
   S3_SECRET_ACCESS_KEY=…
   # AWS:   S3_REGION=eu-central-1   (no S3_ENDPOINT)
   # R2:    S3_REGION=auto  S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   # MinIO: S3_REGION=us-east-1  S3_ENDPOINT=http://minio:9000  S3_FORCE_PATH_STYLE=true
   ```
   Files are served through short-lived signed links, so the bucket never needs to be public.

### 7.8 Error monitoring (Sentry)

1. At https://sentry.io, create a **Node.js** project for the API and a **React** project for the apps (or one project for both).
2. Put the API DSN in `SENTRY_DSN` (backend) and the browser DSN in `VITE_SENTRY_DSN` (rebuild the apps). Optionally set `SENTRY_ENVIRONMENT` (for example `staging`) and `SENTRY_RELEASE`.

### 7.9 AI (OpenAI, Anthropic or Google)

- **OpenAI** (recommended; it also powers embeddings): at https://platform.openai.com/api-keys, create a key, put it in `OPENAI_API_KEY`, and add billing credit.
- **Anthropic:** at https://console.anthropic.com, create a key and put it in `ANTHROPIC_API_KEY`.
- **Google:** at https://aistudio.google.com/apikey, create a key and put it in `GOOGLE_AI_API_KEY`.
- **Choosing a model:** Admin → Settings → AI. The choices come from `AI_MODEL_*`.

### 7.10 Search (Meilisearch)

Docker Compose already runs Meilisearch and connects the backend to it. Elsewhere, set `MEILI_HOST=https://your-meili:7700` and `MEILI_MASTER_KEY` (at least 16 characters in production). The jobs index is filled automatically by the queue.

### 7.11 Redis

Docker Compose runs Redis for you. For a managed Redis, set `REDIS_HOST`, `REDIS_PORT` and `REDIS_PASSWORD`. Redis is required as soon as you run more than one API instance, because sockets, rate limits and queues are shared through it.

---

## 8. Database and migrations

- The schema is in `hyrr.backend/prisma/schema.prisma`; the migrations are in `hyrr.backend/prisma/migrations`.
- **Apply migrations** (dev, staging, production): `cd hyrr.backend && npx prisma migrate deploy`. Docker runs this automatically on every backend start.
- **After a pull** that adds migrations, when running without Docker: `npx prisma migrate deploy && npx prisma generate`.
- **Creating a migration** after a schema change: don't run `prisma migrate dev` against a database you care about. Generate the SQL against a throwaway database with `prisma migrate diff` (see `.claude/skills/hyrr-migration/SKILL.md`). CI fails if the migrations and the schema drift apart.
- **Backups:** the `backup` service writes `.sql.gz` files to the `backups_data` volume. To restore:
  ```bash
  gunzip -c <file>.sql.gz | docker compose exec -T postgres psql -U hyrr_user -d hyrr_db
  ```

---

## 9. Deploying to staging or production

```bash
docker compose -f docker-compose.yml -f docker-compose.staging.yml up -d --build
```

The staging override runs everything in production mode, closes the Postgres, Redis and Meilisearch ports to the host, restarts services on failure, and requires `MEILI_MASTER_KEY`.

**Checklist:**

1. **Domains:** for example `app.yourdomain.com` (Recruiter), `jobs.yourdomain.com` (Careers), `admin.yourdomain.com` (Admin) and `api.yourdomain.com` (API), all on HTTPS behind a reverse proxy (Caddy, nginx, Traefik or a cloud load balancer).
2. **Root `.env`** (build args and public URLs):
   ```env
   VITE_API_URL=https://api.yourdomain.com/api
   VITE_SOCKET_URL=https://api.yourdomain.com
   VITE_TURNSTILE_SITE_KEY=…
   VITE_SENTRY_DSN=…
   PUBLIC_API_URL=https://api.yourdomain.com
   CORS_ORIGINS=https://app.yourdomain.com,https://jobs.yourdomain.com,https://admin.yourdomain.com
   FRONTEND_URL=https://jobs.yourdomain.com
   MEILI_MASTER_KEY=<16+ random chars>
   ```
3. **`hyrr.backend/.env`:**
   - a real `JWT_SECRET` and `TWO_FACTOR_ENCRYPTION_KEY`;
   - `RECRUITER_APP_URL=https://app.yourdomain.com` and `TRUST_PROXY=true`;
   - SMTP with a verified sender, plus `SUPPORT_EMAIL`;
   - the OAuth callback URLs on the API domain;
   - live Stripe and Chapa keys and webhooks;
   - S3/R2 storage, `SENTRY_DSN` and `TURNSTILE_SECRET_KEY`.
4. **Database password:** change the default Postgres credentials in `docker-compose.yml`, or point `DATABASE_URL` at a managed database.
5. **Proxy:** route the `/socket.io` WebSocket upgrade to the API.
6. **Admin:** create the first admin with `docker compose exec backend node scripts/admin-create.cjs …` and turn on 2FA.
7. **Pricing:** check the prices and packs in Admin → Settings before going live.
8. **Smoke test:** sign up as a seeker and as a recruiter, verify the e-mails, publish a job, apply, send a message, and buy credits in test mode.

---

## 10. Commands reference

Run these from the repo root unless noted.

| Command                                                                 | What it does                                                          |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `npm install`                                                           | Installs all workspaces.                                              |
| `npm run dev:backend` / `dev:recruiter` / `dev:jobseeker` / `dev:admin` | Dev servers.                                                          |
| `npm run build`                                                         | Builds every workspace.                                               |
| `npm run build --workspace=hyrr.recruiter`                              | Builds one app (also `hyrr.jobseeker`, `hyrr.admin`, `hyrr.backend`). |
| `npm run typecheck`                                                     | `tsc -b` over all workspaces.                                         |
| `npm run lint` / `npm run lint:hooks`                                   | oxlint / React hook-order check (fails CI).                           |
| `npx prettier --write <files>`                                          | Formatting: no semicolons, double quotes, width 100.                  |
| `npm run docker:up` / `docker:down`                                     | `docker compose up --build -d` / `down`.                              |
| `npm run admin:create --workspace=hyrr.backend -- <email> "<name>"`     | Creates or promotes an admin.                                         |
| `npm run admin:revoke --workspace=hyrr.backend -- <email>`              | Removes admin rights.                                                 |
| `npm run email:test --workspace=hyrr.backend -- <email>`                | Sends a test e-mail through the SMTP settings.                        |
| `npm run seed --workspace=hyrr.backend`                                 | Loads demo data (dev only).                                           |
| `cd hyrr.backend && npx prisma generate`                                | Regenerates the Prisma client.                                        |
| `cd hyrr.backend && npx prisma migrate deploy`                          | Applies migrations.                                                   |
| `cd hyrr.backend && npx jest [path]`                                    | Backend unit tests.                                                   |
| `npm run e2e`                                                           | Playwright end-to-end tests ([§11](#11-testing-and-ci)).              |

---

## 11. Testing and CI

- **Backend unit tests:** `cd hyrr.backend && npx jest`.
- **End-to-end tests** (Playwright, `e2e/`): these start the API and the apps themselves.
  - They need a **disposable**, migrated Postgres in `E2E_DATABASE_URL`; the default is `postgresql://u@localhost:5499/smoke`. Never point it at your dev database.
  - Run: `npx playwright install chromium` once, then `npm run e2e`.
- **CI** (`.github/workflows/ci.yml`) runs on every push and PR:
  - typecheck (each app, the backend and `tsc -b`), React hook rules, backend tests;
  - the builds of all three apps;
  - a migration-parity check (migrations applied from scratch must match `schema.prisma`).

---

## 12. Troubleshooting

| Symptom                                                   | Fix                                                                                                                                                                                               |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Bind for 0.0.0.0:3000 failed: port is already allocated` | Another app uses 3000. Set `BACKEND_PORT=3001` in the root `.env` and rebuild.                                                                                                                    |
| The API refuses to start: "JWT_SECRET …"                  | Set a real `JWT_SECRET` of at least 32 characters in `hyrr.backend/.env`.                                                                                                                         |
| `admin:create` fails with "denied access" / auth error    | Your `DATABASE_URL` points at another Postgres. The Docker DB is on **5433**: prefix the command with `DATABASE_URL="postgresql://hyrr_user:hyrr_password@localhost:5433/hyrr_db?schema=public"`. |
| No e-mails arrive                                         | Without `SMTP_HOST` they are only logged. With SMTP, run `npm run email:test …` and check that `EMAIL_FROM` is a verified sender.                                                                 |
| Brevo: `525 5.7.1 Unauthorized IP address`                | In Brevo → **Security → Authorised IPs**, add your server's IP (or turn off IP blocking).                                                                                                         |
| CORS errors / "socket disconnected"                       | Add the app's exact origin (scheme + host + port) to `CORS_ORIGINS`, and check `VITE_API_URL`/`VITE_SOCKET_URL`, then rebuild the apps.                                                           |
| OAuth returns "redirect_uri mismatch"                     | The provider's redirect URL must exactly equal `*_CALLBACK_URL`.                                                                                                                                  |
| Recruiter sees "Set up your company"                      | Expected for OAuth sign-ups and for people who left a team. Create a company or accept an invite.                                                                                                 |
| Payment succeeded but no credits                          | The webhook isn't reaching the API. Check `STRIPE_WEBHOOK_SECRET` / the Stripe dashboard's webhook log, or that `PUBLIC_API_URL` is public for Chapa.                                             |
| AI shows "disabled"                                       | No real AI key is set; placeholder keys count as unset.                                                                                                                                           |
| Admin app: "Two-factor authentication required"           | Sign in and finish the 2FA setup. Admin APIs refuse admins without 2FA.                                                                                                                           |

### Brevo SMTP (free tier: 300 e-mails a day)

1. Create an account at https://www.brevo.com.
2. Open **Senders, Domains & Dedicated IPs → Senders**, add your sender address and confirm it. A verified domain gives better deliverability.
3. Open **SMTP & API → SMTP** and generate an SMTP key. The login is shown on the same page.
4. Set the keys:
   ```env
   SMTP_HOST=smtp-relay.brevo.com
   SMTP_PORT=587
   SMTP_USER=<your Brevo SMTP login>
   SMTP_PASS=<the SMTP key>
   EMAIL_FROM="Hyrr <the-verified-sender@yourdomain.com>"
   ```
5. If your account has IP blocking on, authorise the server's IP under **Security → Authorised IPs**.

Any other SMTP provider (Postmark, SES, Mailgun, Gmail with an app password) works the same way.

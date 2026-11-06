# Hyrr: recruiting platform (npm workspaces monorepo)

| Workspace | What | Stack |
|---|---|---|
| `hyrr.backend` | REST + socket.io API under `/api` | NestJS 11, Prisma 6, Postgres, Redis (optional), CommonJS |
| `hyrr.shared` | Source-only lib: zustand store, API client, contracts, UI kit, auth pages, `MessagesView` | React 19, consumed via Vite alias `hyrr.shared` |
| `hyrr.recruiter` | Recruiter app (port 5173) | Vite 8, Tailwind 4, dnd-kit, recharts |
| `hyrr.jobseeker` | Job-seeker app (port 5174) | Vite 8, Tailwind 4 |
| `hyrr.admin` | Admin app (port 5175): dashboard, analytics, moderation, users, companies, money, AI settings, audit log. API under `/api/admin` (AdminGuard: ADMIN + 2FA). Admins are created only with `npm run admin:create --workspace=hyrr.backend -- <email> "<name>"`. | Vite 8, react-query, recharts |

Roles: `SEEKER`, `RECRUITER`, `ADMIN`; company roles `OWNER | RECRUITER | HIRING_MANAGER | VIEWER`.

## Commands (run from repo root unless noted)
- Typecheck: `npx tsc --noEmit -p hyrr.shared`, `npx tsc --noEmit -p hyrr.recruiter/tsconfig.app.json`, `npx tsc --noEmit -p hyrr.jobseeker/tsconfig.app.json`, backend `cd hyrr.backend && npx tsc --noEmit -p .`
- Tests (backend only): `cd hyrr.backend && npx jest [path]`; target a folder first, run everything before finishing.
- Builds: `npm run build` (all workspaces) or `npm run build --workspace=hyrr.recruiter` (also `hyrr.jobseeker`, `hyrr.admin`, which must keep building). `npm run typecheck` = `tsc -b` over every workspace with the root TypeScript 6 (stricter than the backend's own 5.9, e.g. `catch (err)` is `unknown`: write `catch (err: any)`).
- Dev: `npm run dev:backend`, `npm run dev:recruiter`, `npm run dev:jobseeker`.
- Prisma: `cd hyrr.backend && npx prisma generate`. Never `migrate dev` against the user's DB; use the `hyrr-migration` skill.
- Docker: `docker compose up --build` (backend reads `hyrr.backend/.env`; demo data only with `SEED_DEMO_DATA=true`).
- Lint/format: `npx oxlint`, `npx prettier --write <files>` (no semicolons, double quotes, width 100).

## Conventions
- **Store actions** (`hyrr.shared/src/store/slices/*.ts`, composed in `useJobStore.ts`; types in `store/types.ts`, mappers in `store/mappers.ts`, socket listeners in `store/socket.ts`): optimistic update → API → on failure roll back and **re-throw** (`ApiError`). UI awaits, toasts success after resolve, catches to toast `err.message`.
- **Backend access**: always go through `AccessService` (`src/core/access/access.service.ts`): `applicationFor(actor, id, "view"|"manage")`, `jobScopeWhere`, `companyScope`. Recruiters see their **company's** data.
- **Errors**: throw `AppException`/helpers from `src/core/exceptions/app-exception.ts` with a stable `errorCode`; Prisma P2002/P2025/P2003 are mapped by the global filter.
- **DTOs / forms**: class-validator on every body (messages shown to users), mirrored by zod in `hyrr.shared/src/lib/validation.ts`; unknown fields are 400. Invalid bodies return 400 `VALIDATION_FAILED` with a per-field `fields` map, shown inline via `<FieldError>`. Salary/dates are structured (`SalaryRangeInput`, `MonthRangeInput`, `YearRangeInput`), never free text. See the `hyrr-validation` skill.
- **Seeker payloads never contain `ai*` fields or recruiter notes** (`SEEKER_APPLICATION_FIELDS` in applications.service).
- **Messaging**: per-user state lives in `ConversationState` (`lastReadAt`, `clearedAt`); the legacy `deletedBy*` columns are unused. Sends are idempotent on `(senderId, clientId)`.
- **Momentum credits**: `WalletService` (`src/billing/wallet.service.ts`) is the only way to change a balance. A wallet belongs to a company (recruiters) or a user (seekers): pass `{ companyId }` or `{ userId }`. Debit inside the action's transaction so a 402 `INSUFFICIENT_CREDITS` writes nothing.
- **Background work**: enqueue with `QueueService.add` (`src/queue`), never fire-and-forget; it runs on BullMQ with Redis and in-process without.
- **AI**: provider picked by `resolveActiveModel()` (`src/ai/ai.models.ts`) from configured keys; placeholder keys (`sk-...`) count as unset. Never write `aiScore = 0` on failure.
- **UI**: use design tokens (`text-txt-*`, `bg-bg-*`, `border-bg-border`, `primary`), shared components from `hyrr.shared`, no hard-coded `bg-white`/hex colours (dark mode). See the `hyrr-ui` skill.

## Gotchas
- Tailwind only generates classes it scans: each app's `src/index.css` has `@source "../../hyrr.shared/src";`. Keep it, or shared components lose styles.
- Contracts between front and back are informal: when changing a payload, grep `hyrr.shared/src/store` for its consumers.
- `hyrr.backend/.env` is the user's file: read keys only to check presence, never print values.
- The dev Postgres in docker is on **5433**; Redis on **6380**.
- The user's Docker may be stopped. For throwaway DBs use Homebrew Postgres (`hyrr-smoke` skill), not their containers.
- Uploads: stored as permanent token-less URLs, re-signed on read (`UploadsService.signStoredUrl`).

## Working style for this repo
- Big changes: write a short contract (payload shapes, store API) first, then split work by file ownership.
- Verify with the `hyrr-verify` skill before claiming done; run a live smoke test (`hyrr-smoke`) for API/socket flows.
- Plans and decisions in progress: `~/.claude/plans/` and the memory directory.

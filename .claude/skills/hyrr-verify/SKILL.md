---
name: hyrr-verify
description: Use before saying any Hyrr change is done, or when asked to check/test/build. The cheapest command sequence to prove backend, shared and frontend changes compile, pass tests and build, from narrowest to widest.
---

# Verify a Hyrr change (narrow → wide; stop at the first failure and fix it)

Run from `/Users/Jimmy/Documents/hyrr`.

## 1. Only what you touched
| Touched | Command |
|---|---|
| Backend file in `src/<feature>` | `cd hyrr.backend && npx tsc --noEmit -p . && npx jest src/<feature>` |
| `prisma/schema.prisma` | `cd hyrr.backend && npx prisma validate && npx prisma generate`, then the parity check in `hyrr-migration` |
| `hyrr.shared` | `npx tsc --noEmit -p hyrr.shared` **and** both app typechecks below (shared changes ripple) |
| Recruiter app | `npx tsc --noEmit -p hyrr.recruiter/tsconfig.app.json` |
| Job-seeker app | `npx tsc --noEmit -p hyrr.jobseeker/tsconfig.app.json` |

## 2. Full gate (before handing back)
```bash
(cd hyrr.backend && npx tsc --noEmit -p . && npx jest 2>&1 | grep -E "Tests:|Suites:|✕")
for w in hyrr.recruiter hyrr.jobseeker hyrr.admin; do npm run build --workspace=$w 2>&1 | grep -qE "✓ built" && echo "$w ok" || echo "$w FAIL"; done
npx prettier --check <touched files>
```
Filter output with `grep`/`tail` to keep it short; only read full logs on failure.

## 3. Behaviour (when API, socket or DB logic changed)
Run the `hyrr-smoke` skill: throwaway Postgres + backend on port 3101 + scripted REST/socket checks. Type checks don't catch payload mismatches with the strict DTO whitelist.

## 4. UI-visible change
State plainly whether it was viewed in a browser. If not, say so; don't claim visual correctness.

## Reporting
Report exact results ("150/150 tests, 3 builds OK"), what was not verified, and why.

---
name: hyrr-smoke
description: Use to prove backend behaviour end to end (REST + socket.io) after API, auth, messaging, billing or AI changes. Runs the real backend against a throwaway Postgres and drives it with a script; never touches the user's database or Docker containers.
---

# Live smoke test

1. **Throwaway DB**: follow steps 2 and 5 of the `hyrr-migration` skill (Homebrew PG on port 5499, `migrate deploy` into a `smoke` DB). Optional demo data: `SEED_DEMO_DATA=true npx prisma db seed` with the same `DATABASE_URL`.

2. **Run the built backend** (background), isolated from the user's `.env` values that matter:
   ```bash
   cd hyrr.backend && npx nest build
   DATABASE_URL="postgresql://u@localhost:5499/smoke?schema=public" \
   JWT_SECRET="smoke-test-secret-0123456789abcdef0123456789" PORT=3101 NODE_ENV=development \
   UPLOAD_DIR=$(mktemp -d) EMAIL_WEBHOOK_URL= SMTP_HOST= \
   node dist/main > /tmp/hyrr-smoke.log 2>&1 &
   ```
   Blank AI keys (`OPENAI_API_KEY= ANTHROPIC_API_KEY= GOOGLE_AI_API_KEY=`) unless the test is about AI. Wait for `GET http://localhost:3101/api/jobs/categories` to return 200.

3. **Drive it** with a Node script (`NODE_PATH=$PWD/node_modules node script.cjs` from the repo root). Start from `template.cjs` in this folder: it has `api()`, `sock()` and `check()` helpers and a register → job → apply → message baseline.
   - Use unique emails per run (`Date.now()`).
   - Registration and login are rate-limited (10/min): keep account creation low, or restart the server between runs.
   - Assert status codes and error codes, not just "it didn't crash".
   - Count socket events per recipient to catch duplicates.

4. **Report** pass/fail counts, then investigate every FAIL in the server log (`sed 's/\x1b\[[0-9;]*m//g' /tmp/hyrr-smoke.log | grep -iE "error|warn"`) before deciding whether it's a bug or a wrong test expectation.

5. **Clean up**: kill the server (`pkill -f "node dist/main"`), stop the PG cluster, delete temp upload dirs. Never leave files in `hyrr.backend/uploads`.

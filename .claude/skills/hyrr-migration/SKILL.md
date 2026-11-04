---
name: hyrr-migration
description: Use whenever hyrr.backend/prisma/schema.prisma changes (new model, field, enum value, index). Generates a correct migration without touching the user's database, adds backfills, and proves migrations match the schema.
---

# Prisma migration workflow (never `prisma migrate dev` on the user's DB)

1. **Edit `prisma/schema.prisma` surgically.** Do not run `prisma format` on the whole file; it reformats everything and buries the real diff. Then:
   `cd hyrr.backend && npx prisma validate && npx prisma generate`

2. **Start a throwaway Postgres** (Homebrew PG18; the scratchpad path is too long for a unix socket, so use TCP only):
   ```bash
   PG=/opt/homebrew/opt/postgresql@18/bin; D=$(mktemp -d /tmp/hyrrpg.XXXX)
   $PG/initdb -D $D -U u --auth=trust >/dev/null && $PG/pg_ctl -D $D -o "-p 5499 -k '' -c listen_addresses=localhost" -l $D/log start
   $PG/createdb -h localhost -p 5499 -U u shadow; $PG/createdb -h localhost -p 5499 -U u smoke
   ```

3. **Generate the SQL:**
   ```bash
   N=prisma/migrations/$(date +%Y%m%d%H%M%S)_<name>; mkdir -p $N
   npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma \
     --shadow-database-url "postgresql://u@localhost:5499/shadow" --script > $N/migration.sql
   ```

4. **Add backfills by hand** at the end of `migration.sql` (move data before dropping columns, set defaults for new state). Make destructive steps (DROP) only after the data has been copied.

5. **Prove it:**
   ```bash
   DATABASE_URL="postgresql://u@localhost:5499/smoke?schema=public" npx prisma migrate deploy   # all apply from scratch
   npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma \
     --shadow-database-url "postgresql://u@localhost:5499/shadow" --script                     # must print "empty migration"
   ```
   Test backfills by inserting representative rows into the `smoke` DB and running the backfill section with `psql -h localhost -p 5499 -U u -d smoke -f ...`.

6. **Clean up:** `$PG/pg_ctl -D $D stop && rm -rf $D`.

7. Tell the user to run `npx prisma migrate deploy` on their dev DB (Docker runs it automatically on start).

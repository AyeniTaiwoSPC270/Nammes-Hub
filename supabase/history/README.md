# Schema history

The live Supabase project was built before migrations were tracked in this repo. These files are the
exact SQL Supabase recorded as applied (2026-07-24 to 2026-09-28), exported so the database can be
rebuilt from the repo alone.

Rebuild order on a fresh project: `01`, `02`, `03`, `04` in this folder, then every file in
`supabase/migrations` in name order. Run them in the Supabase SQL editor.

After rebuilding: restore table data from a backup (`scripts/backup-database.mjs`), recreate the auth users
(they reset their passwords), re-run `select vault.create_secret(...)` if the webhook secret was lost, and
set the owner (see the comment in file 03).

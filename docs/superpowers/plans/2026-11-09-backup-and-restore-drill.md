# Backup and Restore Drill (Free Tier) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Nightly encrypted `pg_dump` of production, stored as GitHub Release assets, with a rehearsed quarterly restore — at zero cost, honestly sized RPO (≤24h).

**Architecture:** A scheduled GitHub Action (public repo → free minutes) dumps the production database read-only via a dedicated `backup_reader` role, pipes through `age` (public-key encryption) into `backup.sqlite.age`, uploads it as a release asset tagged `db-backup-YYYYMMDD`, prunes releases older than 30 days, and pings Telegram on failure. Restore is rehearsed quarterly into the staging project.

**Tech Stack:** GitHub Actions, `pg_dump` (postgresql-client), `age`, GitHub Releases (free for public repos), `gh` CLI (preinstalled on runners).

**Spec:** `docs/superpowers/specs/2026-11-09-backup-and-restore-drill-design.md`

## Global Constraints

- Free tier only. No Supabase PITR, no Pro plan, no new paid accounts. (Owner's hard constraint, 2026-11-09.)
- The dump is encrypted before it leaves the workflow; the `age` **private** key never enters GitHub — only `BACKUP_AGE_KEY` (public recipient) and `SUPABASE_DB_URL` (read-only role) are repo secrets.
- Do not restore over the staging project without first confirming staging holds nothing you need (it is fixtures; safe to wipe by design).
- Migrations already carry rollback siblings in `supabase/rollbacks/` — this plan does not create them.

---

## Task 1: Create the read-only backup role (production, manual)

- [ ] **Step 1:** In the production SQL editor run:

```sql
create role backup_reader nologin;
grant usage on schema public to backup_reader;
grant select on all tables in schema public to backup_reader;
alter default privileges in schema public grant select on tables to backup_reader;
create role backup_login login password '<long-random-string>' in role backup_reader;
```

- [ ] **Step 2:** Test from a scratch machine: `PGPASSWORD='<pw>' pg_dump "host=db.<ref>.supabase.co dbname=postgres user=backup_login sslmode=require" -Fc --no-owner --no-privileges -f /tmp/test.dump && ls -lh /tmp/test.dump` — expect a multi-MB file, no errors.
- [ ] **Step 3:** Add `SUPABASE_DB_URL` (the connection string above, with the password) as a repo secret: `gh secret set SUPABASE_DB_URL` — paste at prompt; never echo it.

## Task 2: Encryption keypair

- [ ] **Step 1 (manual):** `age-keygen -o backup-key.txt` — or `npx age-keygen`. Print the private key line, sign/initial the envelope, store with the handover documents. Do NOT commit `backup-key.txt`; add it to a local-only location the owner keeps.
- [ ] **Step 2:** `gh secret set BACKUP_AGE_KEY` with the **public** recipient line (starts with `age1…`).
- [ ] **Step 3:** Verify: `age -e -r "$BACKUP_AGE_KEY" <<< test | age -d -i backup-key.txt` → prints `test`.

## Task 3: The workflow

**Files:** Create `.github/workflows/backup.yml`

```yaml
name: nightly-backup
on:
  schedule: [{ cron: '30 3 * * *' }]
  workflow_dispatch:
permissions: { contents: write }
jobs:
  dump:
    runs-on: ubuntu-latest
    steps:
      - run: sudo apt-get update && sudo apt-get install -y postgresql-client age
      - run: pg_dump "${{ secrets.SUPABASE_DB_URL }}" -Fc --no-owner --no-privileges --no-comments | age -r "${{ secrets.BACKUP_AGE_KEY }}" -o backup.dump.age
      - run: gh release create "db-backup-$(date -u +%F)" backup.dump.age --title "DB backup $(date -u +%F)" --notes "Nightly encrypted dump" || gh release upload "db-backup-$(date -u +%F)" backup.dump.age --clobber
        env: { GH_TOKEN: ${{ secrets.GITHUB_TOKEN }} }
      - name: Prune releases older than 30 days
        run: |
          gh release list --limit 100 --json tagName,createdAt \
            --jq '.[] | select((.createdAt | fromdateiso8601) < (now - 2592000)) | .tagName' \
            | while read t; do gh release delete "$t" --yes --cleanup-tag; done
        env: { GH_TOKEN: ${{ secrets.GITHUB_TOKEN }} }
      - name: Notify on failure
        if: failure()
        run: gh issue create --title "BACKUP FAILED $(date -u +%F)" --body "Nightly dump failed. Check the workflow log. Do NOT close until a green run exists." || true
```

- [ ] **Step 1:** Commit: `git add .github/workflows/backup.yml && git commit -m "ci: nightly encrypted pg_dump to releases"`. Push, then `gh workflow run nightly-backup`.
- [ ] **Step 2:** After the run: `gh release list` shows today's tag; `gh release download "db-backup-$(date -u +%F)" -O /tmp/b.age && age -d -i backup-key.txt /tmp/b.age | pg_restore -l | head` lists tables. **Do not** restore into any live project.

## Task 4: The restore drill

**Files:** Create `docs/runbooks/restore-drill.md`, `scripts/verify-restore.mjs`

- [ ] **Step 1:** `docs/runbooks/restore-drill.md`: download → decrypt → `pg_restore --clean --if-exists` into the **staging** project (after a `pg_dump` of staging is also taken, or accept it is fixtures and wipe) → row-count checklist for 10 tables (`profiles, quizzes, quiz_questions, quiz_answers, cbt_attempts, awards…, audit_log, page_views, admins, feature_flags`) → timings → sign-off lines.
- [ ] **Step 2:** `scripts/verify-restore.mjs` — compares counts between two connection strings (`SOURCE_DB_URL`, `TARGET_DB_URL`) for those 10 tables, prints a table, exits non-zero on mismatch.
- [ ] **Step 3:** Execute the drill once now; paste real timings/counts into the runbook.
- [ ] **Step 4:** Commit: `git add docs/runbooks/restore-drill.md scripts/verify-restore.mjs && git commit -m "docs(runbook): restore drill procedure and verifier"`

## Task 5: Alerting

- [ ] **Step 1 (optional but recommended):** add `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` secrets and a curl-notify step on `failure()` — same bot as the SLO plan if that landed first.

## Rollback

Disable the schedule (`gh workflow disable nightly-backup`). Existing releases remain as offline backups. Revoking `backup_reader` is `drop role` in prod.

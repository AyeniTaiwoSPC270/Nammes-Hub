# Backup and Restore Drill (Free Tier)

No tracked evidence that a database restore has ever been rehearsed — and **Supabase backups/PITR are
paid-plan only, so this spec is built entirely from free services** (GitHub Actions free minutes on public
repos, GitHub Release asset storage, a second free Supabase project). Honest RPO here is ~24 h, not minutes;
the mitigation is frequency + rehearsal, not money.

**Status:** draft. **Date:** 2026-11-09. **Plan:** none yet.

**Hard constraint (owner's statement, 2026-11-09): no paid plans. PITR is explicitly out.**

---

## 1. Scope

### In

| Piece | What it is |
|---|---|
| Nightly dump | GitHub Action, 03:30 UTC: `pg_dump -Fc --no-owner --no-privileges` of prod → encrypted release asset on this repo (tag `db-backup-YYYYMMDD`) |
| Retention | Keep last 30 nightly releases; older auto-deleted by the same workflow |
| Optional offsite | Cloudflare R2 free tier (10 GB) as a second copy if Releases ever feel risky — same workflow, one extra `rclone` step |
| Restore drill | Quarterly restore to the **staging free project** or a scratch free project; time-boxed ≤ 90 min; results in `docs/runbooks/restore-drill.md` |
| RPO/RTO | RPO ≤ 24 h (honest), RTO ≤ 2 h (restore + app repoint) |
| Guardrails | Backup workflow pings Telegram on failure (nobody reads Actions logs) |

### Out

- **PITR / granular point-in-time restore.** Pro-only. Not attempted.
- **Backing up files/storage buckets.** Supabase Storage objects are covered by a separate quarterly `rclone` check if the org depends on them; noted, not automated here.
- **Encryption-at-rest management.** `age` encrypts the dump before upload; key held offline by the owner (printed + stored with the handover docs).

---

## 2. The problem

68 tables, student answers, award votes, CGPA data, submissions — with zero backups on a free-tier project,
one bad migration or accidental `delete` (and the history shows 255 `ALTER TABLE` revisions plus dashboard-only
fixes) is permanent. GitHub's own storage of the repo is **not** a backup of the database.

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| Mechanism | `pg_dump -Fc` nightly | Complete, portable, restorable anywhere including free Postgres |
| Storage | **GitHub Releases on this public repo** (free) — asset per night, `--clobber` by tag keeps one file per date | Zero new accounts; public-repo minutes are free |
| Encryption | `age` symmetric key; never in Actions secrets unencrypted — use a `BACKUP_AGE_KEY` secret, printed for the owner | Release assets on a public repo are public; votes/student data must not be |
| Role for dump | Dedicated read-only `backup_reader` role (`pg_dump` needs read on all tables; service key avoided) | Least privilege even for backups |
| Drill | Quarterly: restore newest release into the **staging project** (after confirming it can be wiped) or a scratch free project; row counts on 10 key tables must match ±1% | Proves the dump works, not that the cron ran |
| Failure alert | On failure: Telegram message + GitHub issue auto-created | Silence kills backup systems first |

## 4. The change

`.github/workflows/backup.yml` (schedule + `workflow_dispatch`): install `postgresql-client`, `age`;
`pg_dump "$SUPABASE_DB_URL" -Fc --no-owner --no-privileges | age -r "$AGE_RECIPIENT" -o backup.sqlite.age`;
`gh release create db-backup-$(date +%F) backup.sqlite.age`; prune releases older than 30 days. `SUPABASE_DB_URL` secret = direct connection string with the `backup_reader` password. Runbook `docs/runbooks/restore-drill.md`: create scratch project → `gh release download` → `age -d` → `pg_restore --clean --if-exists -d "$SCRATCH_DB_URL" backup.sqlite` → row-count checklist → record times.

## 5. Verification

1. Workflow green 7 consecutive nights; asset count on Releases grows by one/night.
2. One dump downloaded and `age -d … | pg_restore -l | head` lists tables (do NOT restore to prod).
3. Quarterly drill executed once before declaring this done; timings written into the runbook.
4. Failure drill: revoke the secret → run → Telegram alert arrives.

## 6. Risk

**Public repo + encrypted dumps** relies entirely on the `age` key staying offline and the secret staying secret — if either leaks, the dump contents leak (student PII). The encryption key is therefore printed and stored with the handover envelope, and the workflow uses the public key only (private key never enters GitHub). RPO 24 h is real: a data-loss event loses up to a day of student actions — acceptable for a free tool and stated honestly in ADMIN.md. If the org ever gains even a small budget, the first purchase is Supabase Pro for PITR; until then, this is the honest maximum.

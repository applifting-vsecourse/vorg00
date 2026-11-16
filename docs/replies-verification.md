# Replies verification

Implementation branch: `codex/nested-replies`, based on `main` at `7e0613a`.

## Local evidence (2026-11-15)

- Real PostgreSQL integration suite: seven tests cover permanent content and poll removal, search exclusion, nested reply survival, hidden empty branches, author/admin permissions, cursor pagination, arbitrary-depth counts, concurrent reply/vote/delete writes, and restricted account deletion with cleanup.
- Four service tests cover listing, session-owned creation, deletion authorization, and reply validation including Unicode length.
- Seven frontend tests cover existing feed rendering, retry states, inline posting, failed-draft retention, anonymous placeholders, and deletion scrubbing across detail/search/infinite-page caches.
- Authorization mutation check: temporarily disabling the service permission condition made the non-owner regression test fail; the implementation was restored immediately.
- Migration rehearsal: applied the pre-reply migration history to a disposable database, inserted a quack with an author, mood, poll option and vote, then applied the reply migration. All original data and timestamps were identical; parentId and deletedAt were null.
- PostgreSQL tests are included in CI with an isolated PostgreSQL 17 service and the actual production migration chain. Local tests used PostgreSQL 18.

## Release gates

- Full `pnpm check-all`: passed with TEST_DATABASE_URL set: 11 backend tests, 7 frontend tests, lint, type checks, both builds, and formatting.
- PR and merge into main: pending.
- Deployment and production conversation: pending.
- Production removal checks (feed, direct link, replies, search, voting): pending.
- Seminars message with live app and PR links: pending Teams connection.

No production completion is claimed by local tests alone.

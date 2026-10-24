# Quacker — starter template

Full-stack teaching template: pnpm monorepo with two apps.

- `apps/backend` — NestJS + Prisma + Postgres. Auth: BetterAuth (mounted at `/api/auth/*`, treat as a black box). API docs: Swagger at `/api/docs`.
- `apps/frontend` — React + Vite + TanStack Router/Query, Tailwind + shadcn/ui, `ky` + `zod` API client. Feature folders under `src/features/`.

The worked example is the quack feed: `Quack` model → seed → repository → service → `GET`/`POST /api/quacks` (DTO-validated, author taken from the session) → zod schema → TanStack Query → list page + post form. Copy its pattern for new features.

**Before writing or changing any UI, read [`DESIGN.md`](DESIGN.md).** It is a contract, not a suggestion — it exists to stop generated screens drifting into generic nested cards.

## Commands

- `pnpm dev` — everything: env files, Postgres (Docker), migrate, seed, both dev servers
- `pnpm check-all` — lint + type-check + tests + build (same as CI)
- `pnpm backend test` / `pnpm frontend test:ci` — unit tests
- `pnpm backend prisma:migrations:run` — create/apply migrations after schema changes

## Conventions

### Moderation trusts the session role

Authorize deletion in the service with owner OR admin, using the authenticated session. Pass isAdmin from the route into feature components; hiding a button is only a convenience. Keep a non-owner API check that expects 403, and prove it fails when the server permission check is removed.

Clear account-specific query data when signing in, signing up or signing out, so the next account cannot inherit cached profile data, Mine lists or poll results.

### Ownership comes from the session

Check ownership in the service before deleting. The route passes session identity to the UI for convenience, but the server never trusts a userId supplied by the caller. Include feed filters in query keys and refresh every affected list after a mutation.

### Counts and permissions are server responsibilities

Enforce one vote per poll and account with a database constraint, and change it atomically. Hide pre-vote results in the API response as well as the UI. Optimistic feedback must roll back visibly when saving fails.

### Saving a profile refreshes its readers

After changing profile data, refresh the session and feed caches as well as the form. Keep rejected drafts intact, show a username conflict next to its field, and let the database enforce uniqueness.

Deliberately sparse — this file grows as the team learns what it expects from generated code. Add rules here when you find yourself repeating the same review feedback.

### Search input is literal, and optional stays optional

Escape `\`, `%`, and `_` before passing user text to Prisma `contains` so punctuation stays literal. Blank searches mean no filter. Adding an optional query parameter must preserve existing requests.

### UI controls come from the kit

Need a control that isn't in `src/components/ui/`? Add it with `pnpm dlx shadcn@latest add <name>` — don't hand-roll one in a feature folder, even where a native input would do the job. One accessibility implementation to reason about beats a per-control judgement call.

The CLI puts `shadow-xs`/`shadow-sm` on inputs, textareas and cards. [`DESIGN.md`](DESIGN.md) keeps shadows for things that genuinely float — dialogs, dropdowns, toasts. Strip them.

### The app is already running

Assume the dev servers are up. If something is listening on the app's ports, that is this application: use it. Don't start a second instance, don't restart it, don't run `pnpm dev`.

Don't reach for the browser to check your own work. Tests and type-checks are the evidence; open the running app when asked to, not on your own initiative.

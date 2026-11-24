# ADR 0002: Store individual likes and calculate counts

## Status

Accepted on 2026-11-24. Option 1 selected by the product owner. Implementation,
schema changes, migrations, and executable tests are pending.

## Context

The [acceptance cases](../../cases.md) require signed-in users to like and unlike
quacks, including their own. Each user can have at most one active like per quack.
Repeated like and unlike requests must succeed without adding duplicates or
making counts negative. Users cannot remove another person's like. Concurrent
likes from different users must both count.

The feed must expose the total count, including zero, and whether the current
user likes each quack. This state must survive refreshes and new sessions. A like
request targeting a deleted quack must return 404 without saving a like.

The [current schema](../../apps/backend/prisma/schema.prisma) uses PostgreSQL and
Prisma, with existing User and Quack identities. PollVote already models one
user's participation with a composite primary key. There is no likes model or
like counter, and no measured need for a stored counter has been established.

[ADR 0001](0001-quack-deletion.md) specifies retained anonymous placeholders for
deleted quacks; that design is accepted but not yet reflected in the schema.
An existing Quack row will therefore not necessarily be a valid target for likes.

## Decision

Store active likes in a dedicated Like table. Each row references one Quack and
one User through foreign keys. Use `(quackId, userId)` as the composite primary
key, enforcing uniqueness in the database. Add an index on userId for access and
cleanup by user; the primary key starts with quackId to support counting by quack.

Calculate the count from active Like rows. Determine the current user's liked
state by the existence of their row. Do not store a likeCount column on Quack.
Read counts and user-specific state in a consistent database snapshot, using
aggregate/existence queries for the returned feed rather than loading all liker
identities or issuing one query per quack.

Derive userId from the authenticated session. A like operation inserts a row if
absent; a conflict on the same user/quack pair is a successful no-op. An unlike
operation deletes only that user's matching row; no matching row is also a
successful no-op. These are explicit like and unlike operations, not a toggle.
Do not rely on an application-level check followed by an unprotected insert to
prevent duplicates. Other failures, such as a missing target, must not be treated
as duplicate-like success.

Coordinate target validation and insertion with quack deletion. Once the
placeholder design is implemented, reject logically deleted targets as well as
missing rows. A foreign key alone cannot enforce this because a placeholder
retains its ID. The lifecycle operations must use a consistent transaction and
locking strategy so deletion cannot slip between validation and insertion.

This decision selects storage and counting; it does not introduce an audit log,
real-time updates, new API route names, or a new deletion-retention policy.
Whether existing likes are erased or retained when a quack becomes a placeholder,
and the account-deletion cleanup policy for likes, require explicit lifecycle
decisions before those deletion paths are integrated. They must remain compatible
with ADR 0001 and must not expose deleted content through likes.

## Options considered

| Option                                  | Benefits                                                                                                                         | Costs and outcome                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Like table with calculated counts       | One authoritative representation; database uniqueness; ownership and current-user state; counts can always be derived from rows. | **Selected.** Aggregation has a read cost that grows with the number of likes, but avoids maintaining duplicate state.                                                                                                                                                                                                                                     |
| Counter on Quack only                   | Cheap count reads and minimal storage.                                                                                           | **Rejected.** Cannot identify who liked a quack, enforce one like per user, authorize an unlike, or provide the current user's liked state. Atomic increments alone do not satisfy the acceptance cases.                                                                                                                                                   |
| Like table plus stored counter on Quack | Retains ownership and uniqueness while making count reads cheap.                                                                 | **Rejected for now.** Actual row insertions/deletions and counter changes must commit atomically. Retries must not change counters twice, every cleanup path must maintain them, and drift requires detection and repair. Popular quacks also concentrate counter writes on the same row. No measured read bottleneck currently justifies this complexity. |

## Consequences

- **Correctness:** A database key prevents duplicate active likes, including
  concurrent requests from the same user. Different users have independent rows.
  Counts cannot drift from a separate counter or become negative. Authentication
  and ownership checks still belong at the application boundary.
- **Performance:** Feed reads perform aggregation and current-user existence
  checks. Keep queries bounded to the quacks being returned and measure query
  plans and latency before introducing stored counts. An index supports these
  reads but does not make counting arbitrarily many likes free.
- **Testing:** Future tests must cover real database uniqueness, simultaneous
  likes, repeated unlikes, ownership, persistence, and deleted-target races, in
  addition to the unit and browser behaviour in cases.md.
- **Migration:** Existing quacks start with no Like rows and therefore count 0.
  No invented historical likes or counter backfill is needed for the initial
  implementation. This ADR itself changes no schema or application code.
- **Future counter:** A counter can be added later without losing ownership data.
  Backfill it from Like rows, coordinate writes during rollout, and introduce
  transactional maintenance and reconciliation before relying on it. Keep the
  Like table authoritative.
- **Irreversible information loss:** Removing a Like row on unlike discards that
  past action; this model stores current state, not historical like/unlike events.
  Later analytics cannot reconstruct discarded history. Conversely, choosing a
  counter alone would have lost individual ownership from the outset, making a
  later migration to per-user likes impossible to reconstruct accurately.

Changing the storage or lifecycle policy later should be recorded in a superseding
ADR with a migration and compatibility plan.

# Poll implementation plan

## Data model (reviewed before implementation)

- Existing `quack` stores the question and author.
- `poll`: `quackId` is its primary key and references `quack`, cascading on deletion.
- `poll_option`: id, pollId, label and position; unique (pollId, position) preserves answer order. Unique (id, pollId) supports the composite vote foreign key.
- `poll_vote`: primary key (pollId, userId) enforces one vote per person in the database. Its (optionId, pollId) foreign key ensures an option belongs to that poll; userId references user.
- Deleting a quack removes its poll, options and votes. Changing a vote is an atomic upsert, never separate decrement/increment counters. Counts are derived from votes.

## API

- Extend POST /quacks with optional pollOptions (2-4 distinct strings, each 1-80 characters), creating everything atomically.
- GET /quacks includes ordered choices and the session user's choice. Counts, total and percentages are returned only after that user has voted. No voter identities are exposed.
- PUT /quacks/:id/vote accepts only optionId. The voter comes from the authenticated session; reject unknown polls/options and never accept a caller-supplied userId.

## Build order

1. Agree and save story; review foreign keys, uniqueness and result privacy (done).
2. Add migration and server validation/creation; review and commit.
3. Add atomic voting and response filtering; review and commit.
4. Add accessible poll creation and voting with pending/rollback feedback; review and commit.
5. Run the form checklist and two-account production check; resolve findings, merge and verify deployment.

Review decisions: database uniqueness handles repeated/concurrent votes, composite foreign keys prevent voting for another poll's option, and server-side response filtering prevents hidden results leaking through the API. No open product decisions remain.

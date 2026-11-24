# Likes acceptance test coverage

The feature is intentionally unimplemented. Test titles start with their
[cases.md](../cases.md) ID. Nothing is skipped or marked as an expected failure.
The only production additions are service methods and HTTP route stubs that throw
`Error('not implemented')`, their type contracts, and controller registration.
No Like table, migration, repository implementation, count logic, or UI is added.

## Contracts selected for the tests

- `PUT /api/quacks/:quackId/like` and `DELETE /api/quacks/:quackId/like`:
  authenticated, explicit like/unlike operations, successful status 200.
- Feed items expose `likeCount` and `likedByMe`.
- ADR 0002's future Like table maps to `public.like` with `quackId` and `userId`.
  Integration tests inspect stored rows independently of feed responses. A
  missing table is reported with an assertion before attempting a row query.
- Like controls have accessible names `Like quack` / `Unlike quack`, expose
  `aria-pressed`, and show a count labelled `Like count`. Errors use an alert.
  These are test contracts for future implementation, not newly implemented UI.

## Rules: 9 unit tests

File: [likes.service.spec.ts](../apps/backend/src/modules/quack/services/likes.service.spec.ts).
Only persistence is simulated; the actual LikesService stub is under test.

| Case | Test coverage                                                      |
| ---- | ------------------------------------------------------------------ |
| U1   | Liking changes 0 to 1 and stores the actor's like.                 |
| U2   | The author can like their own quack.                               |
| U3   | A duplicate like succeeds, keeps count 1, and does not toggle off. |
| U4   | Unlike removes the active like and changes 1 to 0.                 |
| U5   | Two tests: never liked; repeated unlike after removal.             |
| U6   | Only the actor's like is removed from two likers.                  |
| U7   | A non-liker cannot remove another person's like.                   |
| U8   | Like, unlike, and like again leaves exactly one active like.       |

## API: 17 integration tests

File: [likes.int-spec.ts](../apps/backend/src/testing/likes.int-spec.ts).
Tests use the actual Nest application, Supertest, BetterAuth sessions, and migrated
`quacker_test`. Application tables are cleaned before and after each test. Hooks
create only existing users and quacks; all assertions about missing likes behaviour
run in test bodies, including any initial likes needed by a scenario.

| Case | Test coverage                                                                                                                         |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------- |
| I1   | Three tests: signed-out feed, like, unlike; assert 401, no exposed content, unchanged count/state and stored likes.                   |
| I2   | Two authenticated users see identical totals and their own differing like states; includes a zero-like quack.                         |
| I3   | Two tests: like/unlike round trip on another user's quack and on the actor's own quack.                                               |
| I4   | Two tests: sequential and concurrent duplicate likes; one stored row.                                                                 |
| I5   | Four tests: sequential/concurrent requests crossed with initially liked/unliked; checks zero and preservation of another user's like. |
| I6   | Two tests: ordinary unlike and forged body userId cannot remove Bob's like.                                                           |
| I7   | Simultaneous likes from two users both persist; each sees count 2 and liked state.                                                    |
| I8   | Physically delete an existing fixture quack, then expect 404 and no stored like.                                                      |
| I9   | Read, sign out, verify persisted state, and sign in with a new session; like remains.                                                 |

I8 uses the current schema's physical deletion. The placeholder lifecycle from
ADR 0001 is still unimplemented and is not introduced by these tests. A future
placeholder integration needs an additional deletion scenario when that lifecycle
is available.

## Browser: 8 Playwright tests

File: [likes.spec.ts](../apps/frontend/e2e/likes.spec.ts).

| Case | Test coverage                                                                                                         |
| ---- | --------------------------------------------------------------------------------------------------------------------- |
| E1   | Full real-API flow: visible zero, like, refresh, sign out/in, unlike, refresh.                                        |
| E2   | Real API: own and other users' quacks, liked/unliked states, controls on every feed item, and liking an own quack.    |
| E3   | Two tests: pending like and pending unlike; disabled button, no additional request, confirmed state after completion. |
| E4   | Two tests: failed like and failed unlike; previous state restored, error, enabled button, successful user retry.      |
| E5   | A 404 explains that the quack is unavailable without showing a successful like or increased count.                    |
| E6   | Signed-out direct navigation requires login and exposes no quacks, counts, or controls.                               |

E1 and E2 do not mock HTTP responses. E3–E5 use real login and quack fixtures but
intercept like state/responses to deterministically exercise pending, failure,
retry, and deletion UI behaviour. E6 uses the real authentication redirect.

## Running the red phase

With Docker Postgres running:

- `pnpm backend test --runInBand`
- `pnpm backend test:int`
- `pnpm frontend test:e2e`

Run integration and browser suites sequentially because both use `quacker_test`.
Expected missing-feature failures are assertions about resolved service results,
HTTP status/count/state, or visible like controls. An existing security case such
as E6 can already pass; it should not be made artificially red.

## Observed local results

| Command                         | New likes tests                                                                                                                | Existing tests |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| `pnpm backend test --runInBand` | 9 assertion failures: expected resolved results, received `not implemented`.                                                   | 2 passed.      |
| `pnpm backend test:int`         | 17 assertion failures: missing feed fields or HTTP 500 instead of expected 200/404.                                            | 2 passed.      |
| `pnpm frontend test:e2e`        | 7 assertion failures: absent like controls or the stub's HTTP 500. E6 passed because authentication already protects the feed. | 1 passed.      |

All 34 new tests ran; none were skipped. The failures were assertions, not
compilation, migration, server-startup, authentication-fixture, or hook errors.
Targeted backend lint and strict type checking of the Playwright file passed.
Backend test files were type-checked by Jest/ts-jest and ts-node during execution.
Local logs are retained under `test-results/likes/` (ignored by Git).

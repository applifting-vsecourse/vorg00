# Polls

As a signed-in user, I want to ask a question with a few answers so we can decide together without counting replies.

## Agreed scope

- A poll is an optional attachment to a new quack; the quack text is the question (1-280 characters).
- It has 2-4 distinct, nonblank answers, each at most 80 characters. Spaces are trimmed; duplicate answers ignore case.
- All signed-in users, including the author, can vote once per poll and change their choice. There is no withdrawal, closing time, editing, anonymous voting or multiple selection.
- Counts and percentages are visible only after the viewer votes. The API hides counts before then too.
- A click immediately indicates the choice. While saving, further clicks are disabled; a failed vote restores the last saved state and shows a retryable error.
- Results include counts, percentages and the total. Reloading or returning to the tab gets current results, including other users' votes.
- New-poll validation preserves drafts and focuses the first invalid field. Posting errors preserve all input.
- Two production accounts must verify creation, voting, changing a vote and counts after reload.

Out of scope: live push updates, voter identities, a separate poll directory and analytics.

---

# Nested replies and permanent content removal

Status: product interview completed on 2026-11-10; implementation prepared on 2026-11-15 against current main. Product decisions are closed. Deployment verification is recorded separately in docs/replies-verification.md.

This section is a separate, subsequent story. The poll story above describes the deployed poll model: 2–4 answers, viewer-specific results, and no closure feature. Replies preserve those existing behaviors. The earlier plan.md is not an implementation plan for this reply story.

## Story

As a signed-in user, I want to reply to a specific quack or reply and expand its replies underneath it, so that I can follow a conversation without guessing what an @mention answers.

As an author, I want deletion to erase my contribution while preserving other people's replies. As an administrator, I can delete individual contributions using the same removal behavior.

## Acceptance criteria

1. Reading and posting require the existing authenticated session. Every live root or reply offers Reply. A deleted placeholder never offers Reply and the server rejects attempts to reply to it.
2. Reply opens an inline composer beneath the target, labelled “Replying to @name,” with Post and Cancel. The label is derived from the target's author; it is not inserted into the submitted text. Use the existing name fallback where a username is unavailable.
3. Replies contain plain text of 1–280 Unicode characters after trimming, following existing quack validation. Blank or overlong text and any poll on a reply are rejected. There is no editing. The server takes authorship from the session, not the request body.
4. Posting creates one new Quack linked to the exact target. Root creation leaves the parent empty. Parent links are immutable after creation. The target must already exist and be live; clients cannot supply IDs that create self-links or cycles. There is no product depth limit.
5. After successful posting, clear the draft, expand the target's children, and show the new reply first. Disable Post while saving. Validation and definite request failures preserve the draft and display an error. Do not automatically retry an uncertain creation response: reload the branch so the user can check whether it posted before resubmitting.
6. The feed contains roots only, in the existing newest-root-first order. Replies do not bump roots. Show each root's count of all live descendants and a control to expand direct replies. Apply the same count and expansion behavior to replies.
7. Each expanded level loads 20 visible direct children at a time, newest first, with Load more. Use creation time descending and ID descending as a deterministic tie-breaker. Apply visibility filtering before the page limit. A branch may be collapsed without deleting its data. Root-feed pagination remains outside this story.
8. Live quacks always appear in their appropriate list. A deleted quack appears in a feed or reply list only if it has at least one live descendant at any depth. Deleted intermediate nodes remain visible when needed to connect live descendants. Descendant counts exclude all deleted nodes and exclude the counted quack itself.
9. A visible deleted node displays only “This quack was deleted,” its navigation/expansion controls, and its live-descendant count. It exposes no original text, poll, author, avatar, author identifier, or original/deletion timestamp. Retained internal timestamps keep its position stable. Pagination uses an opaque cursor so it does not expose placeholder timestamps.
10. Every quack/reply has a direct link. Its page shows that node, expandable direct children, and a link to its immediate parent if present. It does not load a complete ancestor path. A deleted node remains accessible by direct link even with no live descendants; an unknown ID returns not found. Parent navigation is ID-based and does not copy parent content into replies.
11. An author or administrator may delete a live quack or reply. Owning a root grants no permission over others' replies. The server checks authorization independently of whether a button is shown. Existing poll voting permissions remain unchanged.
12. Deletion requires a confirmation explaining that content is permanently removed, replies survive, and there is no Undo. Cancel does nothing. Confirm shows a pending state, then updates the UI only after success; failure is visible and retryable. A repeated deletion of an already anonymous placeholder is a harmless no-op for signed-in callers and returns no former content or authorship.
13. Successful deletion atomically sets text, mood, and author link to null, records deletedAt, deletes its poll if present, and retains the Quack row and its parent link forever. No archive, revision, quoted parent snapshot, or recoverable application copy is created. Poll options and all votes on that poll are deleted too. Replies, their authors, and their content are unchanged.
14. The deleting client's loaded quack/detail/parent data and poll caches are purged or replaced, and affected ancestor counts and visibility are refreshed. Subsequent server reads never return deleted content. Other users' already-loaded screens update on their next fetch, refresh, or navigation; live push is excluded. Do not add response caches or logs containing quack text as part of this feature. This is application content removal, not secure erasure of database backups or copies someone already downloaded.
15. Reply creation and target deletion serialize on the target row. If deletion wins, creation returns a conflict explaining that the target was deleted, preserves the draft, and never silently retargets it. If creation commits first, deletion preserves that reply. Merely opening a composer confers no permission to reply after deletion.
16. Poll voting and quack deletion must serialize consistently. A poll operation completed first can succeed; once deletion wins, later poll reads and writes find no usable poll. Lock ordering must be consistent across these paths and avoid recreating a deleted poll.
17. Account removal must first erase all that account's quack text and polls and clear their author links, preserving every quack row and parent link, then delete the User in the same transaction. Prevent concurrent new contributions by the account during this operation. If cleanup is skipped or fails, the author foreign key blocks account deletion. Existing cascades remove that user's sessions, accounts, and votes on other polls. No account-deletion screen is added; any account-removal path must obey this contract before it is enabled.
18. Existing posts, including those beginning with @name, remain live root quacks with their existing IDs, text, authors, timestamps, and polls. No relationship is inferred from mentions.
19. Nested layouts remain readable on narrow screens by capping visual indentation while retaining parent/child controls; this does not cap stored depth. Loading and failure states are scoped to the relevant branch and preserve already displayed replies.

## Data model and invariants

Use the existing Quack table for both roots and replies. A nullable parentId references another Quack; parentId null means root. A nullable deletedAt distinguishes live contributions from retained anonymous placeholders. Make text and userId nullable for actual erasure, not merely filtering content out of responses.

- Live row: deletedAt is null; text and userId are non-null.
- Deleted row: deletedAt is non-null; text, mood, and userId are null; no Poll exists.
- Polls attach only to live roots. The existing primary key Poll.quackId continues to permit at most one poll per quack.
- A parent never changes. Only new rows may point to an existing live parent, preventing cycles through application writes.
- Retain createdAt and updatedAt internally. updatedAt may advance during deletion; createdAt controls ordering. Do not expose either timestamp for placeholders.
- Keep the existing User.quacks inverse relation and all existing poll models. No separate Reply, thread, count, rootId, visibility flag, or copied author/parent text is stored.

The proposed Prisma fields alone do not enforce every invariant. The future migration should add a row CHECK enforcing the live/deleted text-author combinations, plus a self-parent CHECK. Cross-row rules (acyclic immutable parents, no polls on deleted nodes or replies, atomic account cleanup) belong to controlled transactional write paths; simple foreign keys cannot enforce them. Existing text validation remains in the service so historical data is not unexpectedly rejected by a new length constraint.

## Schema change

The Quack model below is implemented in apps/backend/prisma/schema.prisma. Other models remain as on current main, including the existing poll, mood and profile features.

```prisma
model Quack {
  id        String    @id @default(cuid())
  text      String?   @db.Text
  mood      QuackMood?
  user      User?     @relation(fields: [userId], references: [id], onDelete: Restrict)
  userId    String?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @default(now()) @updatedAt
  deletedAt DateTime?

  parentId String?
  parent   Quack?  @relation("QuackReplies", fields: [parentId], references: [id], onDelete: Restrict, onUpdate: Cascade)
  replies  Quack[] @relation("QuackReplies")

  poll Poll?

  @@index([userId])
  @@index([parentId, createdAt, id])
  @@map("quack")
}
```

The parent foreign key uses Restrict to prevent accidental physical removal of a referenced node. It does not implement application deletion: that operation is an UPDATE plus poll deletion. Even leaf placeholders must not be physically deleted by application code. A nullable restricted user relation lets the cleanup transaction clear authorship explicitly, while blocking unsafe direct account deletion. Prisma's [referential-action documentation](https://www.prisma.io/docs/orm/v7/prisma-schema/data-model/relations/referential-actions) describes this Restrict behavior.

## Query review

### 1. Can everything visible be read with simple queries?

Everything is derivable, but **not everything is a simple Prisma query**. Arbitrarily deep descendant counts and deleted-branch visibility require recursive traversal. Use a parameterized PostgreSQL recursive CTE in QuackRepository; do not issue one query per node or fetch the whole tree into the browser. PostgreSQL supports these hierarchical traversals through [WITH RECURSIVE](https://www.postgresql.org/docs/17/queries-with.html).

Required logical queries:

| Read                             | Query and result                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root feed                        | Select parentId null, ordered by createdAt DESC and id DESC. Include live roots and deleted roots with live descendants. Join live authors and optional poll IDs; serialize deleted rows as anonymous placeholders. Visibility requires the recursive result below.                                                                                                                                            |
| Descendant counts and visibility | Starting from each candidate/displayed node's children, recursively follow parentId through both live and deleted nodes. Group by starting node and count only rows with deletedAt null. Count greater than zero makes a deleted candidate visible. Traverse deleted intermediates; never count the start node itself. Batch roots/candidates in one query or use one statement joining the traversal results. |
| Direct reply page                | Select parentId equal to target ID, apply live-or-live-descendant visibility, order by createdAt DESC and id DESC, then take 21 visible rows to return 20 plus hasMore. Subsequent pages use the last visible row's immutable ordering tuple. Fetch counts and author/poll projections in the same consistent snapshot. The basic children lookup is simple; the visibility condition is recursive.            |
| Direct-link node                 | Unique-ID lookup, with live author and poll ID if applicable. Return a placeholder even if it has no descendants. Read its descendant count and first reply page through the queries above.                                                                                                                                                                                                                    |
| Immediate parent                 | Unique-ID lookup of parentId, serialized with the same deletion rules. No ancestor traversal is necessary.                                                                                                                                                                                                                                                                                                     |
| Controls                         | Current session identity/role plus the live row's author ID determine canDelete; deletedAt determines canReply. These flags are derived, never stored.                                                                                                                                                                                                                                                         |
| Poll                             | Existing quack lookup includes poll options, current user's vote, and counts; retain current result-visibility rules. Deleted quacks have no poll row and cannot expose results.                                                                                                                                                                                                                               |

Count and visibility queries must use the same snapshot for each response so deletion cannot produce a visible empty placeholder with contradictory counts. Do not store counters merely to make the query look simpler. Recursive traversal cost grows with conversation size; the parent index helps traversal but does not make arbitrary-depth counting constant-time. Production-like performance validation is required before implementation rollout.

### 2. Is anything stored twice?

No reply content, ancestor content, author profile, descendant count, or thread membership is copied. Quack.parent and Quack.replies are Prisma relation views over the single stored parentId, not two independently maintained relationships. User.quacks is likewise an inverse relation.

deletedAt and null text/userId jointly describe deletion state; this intentional invariant is maintained by a transactional deletion operation and the proposed row CHECK. deletedAt additionally records when deletion happened. Poll removal must be in that same transaction.

The existing PollVote.pollId repeats poll membership already reachable through optionId. This pre-existing poll design uses a composite option foreign key to enforce vote/poll consistency. The reply feature adds no duplicate content.

Frontend query caches are temporary copies, not authoritative records. Successful deletion must clear loaded content and poll entries, then refresh affected ancestor counts; other clients reconcile on the next fetch. No deleted content is retained for Undo.

### 3. What happens to related rows on deletion?

| Operation                                        | Result                                                                                                                                                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Delete a quack/reply through the app             | Retain its Quack row and all parent/child relationships; clear text and userId; set deletedAt. Keep all descendant Quack rows and their content untouched.                                             |
| Remove that quack's poll                         | Explicitly delete Poll in the transaction. Existing cascades delete PollOption and PollVote rows belonging to that poll. Simply updating Quack would not trigger these cascades.                       |
| Delete an account through the supported workflow | Erase its quacks and polls and null their author links before deleting User. Preserve other authors' replies. Existing user cascades remove Session, Account, and the user's remaining PollVote rows.  |
| Attempt direct User deletion without cleanup     | Restrict rejects it while authored Quack rows reference the user. Nothing is silently anonymized while retaining content.                                                                              |
| Attempt physical Quack deletion                  | Restrict rejects deletion when children reference it. A leaf is not protected by this foreign key, so the application must never expose physical Quack deletion; this story retains every placeholder. |

### 4. Will migration work with existing production data?

**Yes.** The migration was rehearsed against a disposable database containing existing quacks, polls, options and votes; IDs, text, authors, moods, timestamps and poll data survived unchanged. Nullable parentId and deletedAt default to null, so existing rows become live roots. The migration relaxes text/userId nullability, replaces the author cascade with Restrict, and adds the self-reference foreign key, index and row checks.

Implementation starts from main commit 7e0613a, after its 20261024120000_add_polls migration. The older unfinished poll work in the original checkout is preserved separately and is not included. The reply migration is 20261115000000_quack_replies.

Deployment must coordinate schema and application changes: old serializers assume non-null text and author, so do not enable deletion or reply writes while incompatible application instances still serve traffic. The old unfiltered feed would also incorrectly show replies as roots. Deploy compatible reads and account-deletion safeguards before enabling the feature, or use a controlled maintenance cutover. Index creation and foreign-key replacement can take locks; choose and rehearse the operational migration strategy for the actual table size. Do not use a database reset.

Before rollout, validate the proposed schema, generate and inspect the SQL, and rehearse on a production-like copy. Verify all pre-existing rows remain unchanged; exercise roots, deep replies, equal timestamps, hidden deleted branches, poll deletion, author/admin authorization, account cleanup, and concurrent reply/delete and poll/delete outcomes. Test rollback before writes are enabled: after content removal, rollback cannot reconstruct erased content and older non-null constraints cannot simply be restored.

## Where this lands in the code

No new business module is needed. Extend `apps/backend/src/modules/quack/quack.module.ts` and its existing controllers, services, repositories, domain model, and DTOs. QuacksService owns reply validation and deletion policy; QuackRepository owns the self-relation, recursive reads, and transactional writes. Keep authorization based on `shared/auth/domain/identity.ts`, which already contains role. The existing vote method in QuackRepository shares the quack lock with deletion and retains viewer-specific result privacy.

Proposed API surface: extend POST /quacks with optional parentId; filter GET /quacks to visible roots; add GET /quacks/:id, GET /quacks/:id/replies with cursor pagination, and DELETE /quacks/:id for the content-removal transaction. DTOs must distinguish live content from anonymous placeholders and carry derived counts, parent IDs, and permissions. Reject polls combined with parentId. Database details such as deletedAt and retained timestamps are not automatically exposed in placeholder DTOs.

Extend `apps/frontend/src/features/quack`: QuackItem and QuackList for nested branches/placeholders, QuackForm or a shared composer for inline replies, API schemas and query keys for node/branch reads, and mutation hooks for creation/deletion and cache cleanup. The existing feed route is `apps/frontend/src/routes/_ProtectedPages/quacks.tsx`; add a protected direct-link route alongside it. Existing root posting, moods, profiles, Mine filtering and poll behavior remain available. The root-only feed rule also applies to search and Mine: search matches live roots and never deleted content; Mine includes the viewer’s live roots. Replies remain accessible within threads and by direct links. Deleted moods are erased along with text.

Account removal integration belongs at the boundary with `apps/backend/src/shared/auth`, specifically the Better Auth provider/configuration and any future administrative removal path. The inspected configuration does not enable an account-deletion UI or workflow; do not invent a new one in this story. Require cleanup before enabling any such path, and retain the Restrict foreign key as a fail-safe. Avoid a circular AuthModule/QuackModule dependency when implementing that orchestration.

Existing service tests and QuackList tests will need updates when implementation starts. Add behavior tests for authorization, visibility through deleted intermediates, pagination, recursive counts, permanent poll removal, and competing writes; schema validation alone cannot verify these requirements.

## Decisions

Each entry records the user's selection and the rejected alternative(s).

| Decision                     | Selected                                                                         | Rejected and why                                                                                                                                                           |
| ---------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Conversation shape           | Nested replies to exact targets                                                  | One level loses reply-to-reply context; a flat thread does not present replies beneath their exact targets.                                                                |
| Deleted contribution display | Anonymous placeholder; erase text, poll, and author link                         | Attributed placeholders retain unwanted attribution; removing/reparenting nodes changes what replies appear to answer.                                                     |
| Replying to deleted nodes    | Reject; surviving replies remain replyable                                       | Allowing replies would keep a deleted contribution open to new direct responses.                                                                                           |
| Feed placement               | Roots with expandable replies                                                    | Showing replies separately duplicates their presentation and clutters the feed.                                                                                            |
| Reply polls                  | Text-only replies                                                                | Polls within nested branches expand this version's interaction and deletion scope.                                                                                         |
| Empty deleted rows           | Always retain placeholders in storage                                            | Physical removal and ancestor pruning lose stable IDs and original structure.                                                                                              |
| Empty placeholder visibility | Hide unless live descendants exist; direct links still work                      | Showing all empty placeholders clutters lists; recursive visibility cost is accepted.                                                                                      |
| Account deletion             | Erase all authored contributions; preserve their structural rows                 | Keeping anonymous text would retain contributions after account deletion and make later author-based cleanup difficult.                                                    |
| Deletion authority           | Author or administrator                                                          | Author-only deletion omits administrative removal; root ownership still grants no control over others' replies.                                                            |
| Reply ordering/loading       | Newest first, 20 visible direct children per page                                | Oldest first delays recent responses; loading the entire tree is unbounded.                                                                                                |
| Reply count                  | All live descendants, computed                                                   | Direct-only counts can show zero for an active deeper thread; branch counts are less intuitive. Stored counters were not chosen because they require synchronized updates. |
| Composer                     | Inline, with derived target label                                                | A dialog separates composing from the target; inserted @name text would not reliably represent the parent relationship.                                                    |
| Access/text/editing          | Existing sign-in requirement, 1–280 trimmed characters, no editing               | Guest access, different reply limits, and editing add separate behavior beyond this story.                                                                                 |
| Confirmation                 | Confirm irreversible deletion; no Undo                                           | Immediate deletion increases accidental loss; Undo would require retaining erased content.                                                                                 |
| Posting during deletion      | Reject if deletion wins; preserve draft                                          | Grandfathering an open composer requires extra state and contradicts the rule against replying to placeholders.                                                            |
| Existing @name quacks        | Leave as roots                                                                   | Manual relinking requires a reviewed mapping; automatic inference cannot reliably identify a target.                                                                       |
| Storage                      | One Quack model with optional self-parent                                        | Separate Reply duplicates fields and complicates relationships and deletion rules.                                                                                         |
| Other clients after deletion | Update on their next fetch                                                       | Live push adds infrastructure and still cannot revoke content from disconnected clients.                                                                                   |
| Direct-link context          | Node, immediate-parent link, expandable children                                 | Full ancestor paths add recursive navigation work unnecessary for this version.                                                                                            |
| Original timestamps          | Keep internally; omit from placeholder responses                                 | Erasing them disrupts stable ordering and irreversibly loses chronology.                                                                                                   |
| Deletion marker              | Explicit deletedAt                                                               | Inferring deletion from null text is implicit and loses deletion time.                                                                                                     |
| Additional features          | Exclude notifications, mention interpretation, and a new account-deletion screen | These are separate features and not needed to deliver reply relationships.                                                                                                 |
| Account foreign key          | Restrict until cleanup clears author links                                       | SetNull alone can silently retain anonymous content if cleanup is missed; Cascade destroys conversation structure.                                                         |

Implementation details derived from these decisions: parent Restrict preserves structure; the parent/creation/ID index supports traversal and stable ordering; nullable text/user fields permit erasure; existing poll cascades remove related content. These do not introduce separate product behavior. Product decisions are closed. Tests, deployment, and production evidence are tracked in docs/replies-verification.md.

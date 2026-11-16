# ADR 0001: Erase quack content and retain anonymous placeholders

## Status

Accepted on 2026-11-10. Agreed design; implementation and migration prepared on 2026-11-15.

## Context

The [reply story](../../story.md#nested-replies-and-permanent-content-removal) requires contributions to belong to their authors: deleting a quack must remove its content without destroying other people's replies. The Decisions section selects anonymous placeholders, permanent content removal, retention of empty placeholder rows, and the same removal policy for account deletion.

The current model requires quack text and an author, and deleting a User cascades to their Quack rows. Polls belong to quacks and have dependent options and votes. Introducing deletion therefore affects existing account and poll lifecycles, not just the new reply interface.

This is the hardest decision to undo because erased text, author links, poll answers, and votes cannot be reconstructed from a retained placeholder. Unlike ordering or presentation choices, reversing the policy later cannot restore historical contributions.

## Decision

Deleting a quack permanently erases its content while retaining its identity and position in the conversation as an anonymous placeholder. Apply this policy to both root quacks and replies, including rows with no replies.

In one transaction, clear text, mood and userId, set deletedAt, and explicitly delete the attached poll. Existing poll cascades remove its options and votes. Retain the quack ID, immutable parent link, and internal creation/update timestamps. Preserve other authors' replies unchanged. Do not create a recoverable content archive or offer Undo.

Deleting an account must apply this cleanup to all its contributions before deleting User, in the same transaction. Replace the author relationship's deletion cascade with Restrict so skipped cleanup blocks account deletion. Restrict physical deletion of referenced parents as well; application deletion must retain even leaf rows, which that foreign key alone cannot protect.

Represent live and deleted states explicitly: a live quack has text and an author; a deleted quack has neither and has a deletion timestamp. Enforce the row-state invariant with a database check and remove polls through the transactional workflow.

## Options considered

| Option                                                        | Outcome and reason                                                                                                                                                                    |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Erase content and retain anonymous placeholders               | **Selected.** Preserves exact reply targets and stable links while removing the deleted contribution and attribution.                                                                 |
| Retain an attributed placeholder                              | Rejected because it continues associating the author with a contribution they deleted.                                                                                                |
| Physically remove the node and reparent its replies           | Rejected because it changes what surviving replies appear to answer and loses the original structure. Pruning only empty deleted nodes was also rejected because it loses stable IDs. |
| Cascade deletion through replies                              | Rejected because one author or account would destroy contributions owned by other people.                                                                                             |
| Keep content anonymously after account deletion using SetNull | Rejected because the content survives account removal; losing the author link also makes later author-based cleanup difficult. SetNull alone cannot guarantee erasure.                |
| Keep hidden content for recovery or Undo                      | Incompatible with the agreed permanent-removal requirement; hiding content is insufficient.                                                                                           |

## Consequences

- **Data model:** Quack.text and Quack.userId become nullable, deletedAt records deletion, and author/parent foreign keys protect cleanup and structure. Retained rows accumulate indefinitely. IDs and relationships remain usable after deletion, but erased content and attribution are unrecoverable.
- **Authentication and account administration:** Any account-removal path must orchestrate contribution cleanup and prevent concurrent contributions from escaping it. Direct User deletion fails until author links are cleared. Existing session/account cascades and removal of the user's votes on other polls remain in effect. This does not introduce an account-deletion screen.
- **Polls:** Deleting a quack must explicitly delete its poll; updating the quack does not trigger a delete cascade. Voting and deletion need consistent transaction/lock ordering so a deleted poll cannot be used or recreated. Existing poll privacy and voting permissions remain unchanged.
- **APIs and frontend:** Domain mappings, DTOs, validators, and components can no longer assume every quack has text and an author. Placeholders reveal no former content, authorship, or timestamps. Direct links still resolve; feed and reply lists hide placeholders without live descendants. Arbitrary-depth visibility and counts require recursive reads with the selected parent-link model.
- **Caches and future features:** Successful deletion clears the deleting client's loaded content and poll caches. Subsequent reads omit erased content; other clients reconcile on their next fetch. Any future search index, export, content cache, or logging design must account for this removal contract rather than retaining an undeclared content copy. This decision does not promise erasure of backups or copies already downloaded by users.
- **Concurrency:** Reply creation and deletion must serialize on the target. Deletion winning rejects the new reply; creation winning preserves it through deletion. Account cleanup must also coordinate with writes by that account.
- **Deployment and rollback:** Existing quacks migrate as live roots without content changes. Deploy readers that support nullable fields before enabling deletion, and rehearse foreign-key changes against the actual migration history. After deletion is enabled, reverting application code cannot restore erased values or safely restore the old non-null assumptions.

Changing this policy later requires a superseding ADR and a migration/compatibility plan. It can alter future behavior, but cannot recover information already erased under this decision.

# Moderation

As an admin, I want to delete any quack so I can remove unwanted posts when their author will not.

## Acceptance criteria

- Admins see Delete on every quack. Regular users see it only on their own.
- Delete opens the existing confirmation dialog. Cancel keeps the post; confirm permanently removes the post and its poll and votes.
- An admin can delete another author's post. A regular user cannot, including through a direct API request (403). Signed-out requests return 401.
- Mine continues to show only the signed-in account's own posts, including for admins.
- Failed deletion leaves the post visible and shows an error so the user can retry.

## Agreed scope

The user approved the existing admin role, existing confirmation, permanent deletion including poll data, and unchanged Mine behavior. No reporting, bans, extra roles, moderation reasons, editing, or undo. No open decisions remain.

## Implementation and review

Add the owner-or-admin check in the service first, using session identity. Pass isAdmin from the route through the quack components. Review locally as author, another regular account, and admin@example.com. Use disposable posts for the required Playwright tests; temporarily remove the server check and confirm the forbidden-deletion test fails, then restore it and rerun. Production uses ordinary review accounts; seeded admin credentials are local only.

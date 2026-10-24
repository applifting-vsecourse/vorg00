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

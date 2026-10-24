# Search the quack feed

As a signed-in reader, I want to search by a phrase or author so I can find an earlier quack.

## Acceptance criteria

- A labelled search field filters all posts by text, author name, or username, ignoring case and matching partial phrases.
- Results remain newest first. Punctuation is literal; surrounding spaces are ignored.
- Search accepts 1-100 characters and updates shortly after typing stops. Clearing it immediately restores the full feed.
- Loading, no matches, an empty feed, and errors have distinct messages. Errors offer a retry; no matches offers Clear search.
- Posting keeps the current filter and refreshes results. Reloading the page clears the search.
- Controls are keyboard accessible and UI text remains English.

Technical notes: use optional `GET /quacks?q=...`, database filtering, a 300 ms debounce, and a separate query cache key for each term.

Out of scope: highlighting, saved searches, pagination, analytics, and advanced filters.

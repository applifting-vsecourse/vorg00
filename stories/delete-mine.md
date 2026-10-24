# Delete my quacks and filter the feed

As an author, I want to remove my own posts and see only mine so I can manage what I posted.

- Only the author sees Delete. A confirmation explains that deletion includes the poll and votes; Cancel keeps everything.
- The service checks the session user's ownership. Other users get 403, signed-out users get 401, and missing posts get 404.
- All and Mine tabs preserve search. Mine is filtered on the server using the session, never a caller-supplied userId.
- An empty Mine feed offers to focus the new-post form. Loading, no matches and errors remain distinct.
- Successful deletion removes the post from all cached lists. Failures stay visible in the dialog and can be retried.

Out of scope: undo, restoring deleted posts and moderation (the next PR).

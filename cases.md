# Quack likes: agreed acceptance cases

These cases record the product decisions agreed before implementation. They are
specifications for future tests; no implementation or executable tests are added.
API routes, payload field names, and exact success status codes are not prescribed.

## Rules (unit tests)

### U1 — Like a quack

- **Given** an existing quack with 0 likes and a signed-in user who has not liked it.
- **When** the user likes the quack.
- **Then** the count becomes 1 and the user has liked it.

### U2 — Like your own quack

- **Given** a signed-in user owns a quack with 0 likes.
- **When** the user likes their own quack.
- **Then** the action is allowed, the count becomes 1, and the user has liked it.

### U3 — A user can like a quack only once

- **Given** a user already likes a quack whose count is 1.
- **When** the same user requests another like.
- **Then** the action succeeds without an error, the count remains 1, and the
  existing like remains. A repeated like does not toggle the like off.

### U4 — Take a like back

- **Given** a user is the only person who likes a quack.
- **When** the user unlikes it.
- **Then** their like is removed, the count changes from 1 to 0, and the user no
  longer likes it.

### U5 — Unlike without an existing like

- **Given** a user does not like a quack with 0 likes, either because they never
  liked it or because they already took their like back.
- **When** the user requests an unlike.
- **Then** the action succeeds without an error and the count stays at 0; it never
  becomes negative.

### U6 — Remove only your own like

- **Given** Alice and Bob both like a quack with a count of 2.
- **When** Alice unlikes it.
- **Then** only Alice's like is removed, the count becomes 1, and Bob still likes it.

### U7 — Another person's like cannot be removed

- **Given** Bob is the only person who likes a quack and Alice has not liked it.
- **When** Alice requests an unlike.
- **Then** Bob's like remains and the count stays at 1.

### U8 — Like again after unliking

- **Given** a user liked and then unliked a quack that now has 0 likes.
- **When** the user likes it again.
- **Then** the count becomes 1 and the user has exactly one active like.

## API behaviour (integration tests)

Use real HTTP requests, real authentication, and a real test database. Isolate data
between tests. Each case verifies persisted state as well as the HTTP outcome.

### I1 — Signed-out visitors cannot read or change likes

- **Given** a visitor has no valid signed-in session and an existing quack has a
  known like count.
- **When** the visitor requests the feed, requests a like, or requests an unlike
  (each operation is a separate example).
- **Then** the API returns 401, does not expose quacks or like counts, and leaves
  existing likes unchanged.

### I2 — Signed-in users receive counts and their own like state

- **Given** Alice and Bob are signed in, one quack has 0 likes, and another has
  exactly one like from Alice.
- **When** each user requests the feed.
- **Then** both see counts of 0 and 1; Alice sees the second quack as liked by her,
  Bob sees it as not liked by him, and neither sees the first quack as liked by them.

### I3 — Like and unlike through authenticated HTTP requests

- **Given** a signed-in user and an existing quack with 0 likes.
- **When** the user sends a like request and reads the feed, then sends an unlike
  request and reads the feed again.
- **Then** both mutations succeed; the first read shows count 1 and liked by this
  user, and the second shows count 0 and not liked by this user.
- **Then** the same behaviour holds when the user is the quack's author.

### I4 — Repeated likes remain idempotent

- **Given** a signed-in user and a quack with 0 likes.
- **When** two like requests from that user arrive, either as sequential retries
  or concurrently (separate examples).
- **Then** both requests succeed without an error, exactly one like is stored for
  that user and quack, and a subsequent read shows count 1.

### I5 — Repeated unlikes remain idempotent

- **Given** a signed-in user and a quack with either no like from them or exactly
  one like from them (separate examples).
- **When** that user sends two unlike requests, sequentially or concurrently
  (separate examples).
- **Then** both requests succeed without an error, no like from that user remains,
  other users' likes are unchanged, and the count is never negative.

### I6 — Authentication determines whose like can change

- **Given** Bob likes a quack and Alice is signed in.
- **When** Alice attempts to remove Bob's like using Alice's session, including
  an attempt to supply Bob's identity in a request.
- **Then** Bob's like remains and the API does not grant Alice authority to remove
  it. Any valid unlike operation applies only to Alice's own like.

### I7 — Concurrent likes from different users both count

- **Given** Alice and Bob are signed in and a quack has 0 likes.
- **When** they each send a like request at the same time.
- **Then** both requests succeed, both likes are stored, the count is 2, and each
  user's subsequent feed read shows that they have liked the quack.

### I8 — Liking a deleted quack

- **Given** a quack was deleted after a user last saw it.
- **When** the signed-in user sends a like request for that quack.
- **Then** the API returns 404 and no like is saved.

### I9 — Likes persist across sessions

- **Given** a signed-in user has liked a quack whose total count is 1.
- **When** they read the feed again, sign out, sign back in as the same user, and
  read the feed once more.
- **Then** authenticated reads still show count 1 and the user's own liked state;
  signing out has not removed the stored like.

## End-to-end flows

### E1 — Like, refresh, sign back in, and unlike

- **Given** a signed-in user opens the feed containing a quack with 0 likes.
- **When** they inspect the quack.
- **Then** it shows a like button in its normal state and a visible count of 0.
- **When** they click like and the request succeeds.
- **Then** the count becomes 1 and the button is highlighted.
- **When** they refresh, then sign out and sign back in as the same user.
- **Then** the count remains 1 and the button remains highlighted when they return
  to the feed.
- **When** they click the highlighted button to unlike and the request succeeds.
- **Then** the count becomes 0 and the button returns to its normal state.
- **When** they refresh again.
- **Then** the count is still 0 and the button is still in its normal state.

### E2 — Every quack has the correct controls

- **Given** a signed-in user opens a feed containing their own quack, another
  user's quack, and a mixture of liked and unliked quacks.
- **When** the feed loads.
- **Then** every quack shows a like button and count, including 0; buttons are
  highlighted exactly for quacks liked by the current user, and the user's own
  quack can be liked too.

### E3 — Prevent repeated clicks while a request is pending

- **Given** a signed-in user can like or unlike a quack (separate examples).
- **When** they click its button and the request remains pending.
- **Then** that button is temporarily disabled and further clicks do not send
  additional requests.
- **When** the request succeeds.
- **Then** the button is enabled again and shows the confirmed count and state.

### E4 — Recover from a failed like or unlike

- **Given** a signed-in user sees count 0 and a normal button before liking, or
  count 1 and a highlighted button before unliking (separate examples).
- **When** they click the button and the operation fails without being saved.
- **Then** the previous count and button state are retained or restored, an error
  is shown, and the button is enabled so they can retry.
- **When** they retry and the request succeeds.
- **Then** the confirmed state is shown: count 1 and highlighted after liking, or
  count 0 and normal after unliking.

### E5 — Explain that a quack was deleted

- **Given** a signed-in user still sees a quack that has since been deleted.
- **When** they click like and the API returns 404.
- **Then** the UI explains that the quack is no longer available and does not show
  a successful like or an increased count.

### E6 — Signed-out access

- **Given** a visitor is signed out.
- **When** they try to open the feed directly.
- **Then** quacks, like counts, and like controls are not visible; signing in is
  required to access them.

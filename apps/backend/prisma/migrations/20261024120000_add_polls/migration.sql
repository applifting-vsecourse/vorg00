CREATE TABLE "poll" (
  "quackId" TEXT PRIMARY KEY REFERENCES "quack"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "poll_option" (
  "id" TEXT PRIMARY KEY,
  "pollId" TEXT NOT NULL REFERENCES "poll"("quackId") ON DELETE CASCADE ON UPDATE CASCADE,
  "label" VARCHAR(80) NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "poll_option_pollId_position_key" UNIQUE ("pollId", "position"),
  CONSTRAINT "poll_option_id_pollId_key" UNIQUE ("id", "pollId")
);
CREATE TABLE "poll_vote" (
  "pollId" TEXT NOT NULL REFERENCES "poll"("quackId") ON DELETE CASCADE ON UPDATE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "optionId" TEXT NOT NULL,
  CONSTRAINT "poll_vote_pkey" PRIMARY KEY ("pollId", "userId"),
  CONSTRAINT "poll_vote_optionId_pollId_fkey" FOREIGN KEY ("optionId", "pollId") REFERENCES "poll_option"("id", "pollId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "poll_vote_optionId_pollId_idx" ON "poll_vote"("optionId", "pollId");
CREATE INDEX "poll_vote_userId_idx" ON "poll_vote"("userId");

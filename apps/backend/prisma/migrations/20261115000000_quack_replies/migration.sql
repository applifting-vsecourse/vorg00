-- Existing contributions remain live roots; no data is rewritten or inferred.
ALTER TABLE "quack"
  ADD COLUMN "parentId" TEXT,
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ALTER COLUMN "text" DROP NOT NULL,
  ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "quack" DROP CONSTRAINT "quack_userId_fkey";
ALTER TABLE "quack" ADD CONSTRAINT "quack_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quack" ADD CONSTRAINT "quack_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "quack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quack" ADD CONSTRAINT "quack_deletion_state_check" CHECK (
  ("deletedAt" IS NULL AND "text" IS NOT NULL AND "userId" IS NOT NULL) OR
  ("deletedAt" IS NOT NULL AND "text" IS NULL AND "userId" IS NULL)
);
ALTER TABLE "quack" ADD CONSTRAINT "quack_not_own_parent_check" CHECK ("parentId" <> "id");
CREATE INDEX "quack_parentId_createdAt_id_idx" ON "quack"("parentId", "createdAt", "id");

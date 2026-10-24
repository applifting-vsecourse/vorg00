CREATE UNIQUE INDEX "user_username_case_insensitive_key" ON "user" (lower("username"));

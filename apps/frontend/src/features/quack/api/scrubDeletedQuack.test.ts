import { expect, it } from "vitest"

import { scrubDeletedQuack } from "./scrubDeletedQuack"

it("erases every loaded detail, search and infinite-page copy, preserving other replies", () => {
  const deleted = {
    id: "a",
    text: "secret",
    user: { name: "Author" },
    userId: "u",
    mood: "happy",
    poll: { options: ["secret answer"] },
    createdAt: new Date(),
    canReply: true,
    canDelete: true,
  }
  const survivor = { id: "b", text: "survives" }
  const data = {
    detail: deleted,
    search: [deleted, survivor],
    pages: [{ items: [deleted, survivor] }],
  }
  const cleaned = scrubDeletedQuack(data, "a")
  expect(JSON.stringify(cleaned)).not.toContain("secret")
  expect(JSON.stringify(cleaned)).not.toContain("Author")
  expect(cleaned).toMatchObject({
    detail: { deleted: true, text: null, user: null, canReply: false },
    search: [{ id: "a" }, survivor],
  })
})

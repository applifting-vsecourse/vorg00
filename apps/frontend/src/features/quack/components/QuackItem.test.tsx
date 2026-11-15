import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, expect, it, vi } from "vitest"

import type { Quack } from "@/features/quack/api/quackSchemas"

import { QuackItem } from "./QuackItem"

const mocks = vi.hoisted(() => ({ add: vi.fn(), get: vi.fn(), remove: vi.fn() }))
vi.mock("@/features/quack/api/addQuack", () => ({ addQuack: mocks.add }))
vi.mock("@/lib/api-client", () => ({ api: { get: mocks.get, delete: mocks.remove } }))
const root: Quack = {
  id: "root",
  text: "Original",
  parentId: null,
  deleted: false,
  replyCount: 0,
  canReply: true,
  canDelete: true,
  userId: "alice",
  user: { id: "alice", name: "Alice", username: "alice" },
  createdAt: new Date(),
  poll: null,
}
function setup(quack = root) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <QuackItem quack={quack} />
      </QueryClientProvider>,
    ),
  }
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.get.mockReturnValue({ json: () => Promise.resolve({ items: [], nextCursor: null }) })
})
it("posts to the exact target and expands the newly loaded reply", async () => {
  const reply = { ...root, id: "reply", text: "Answer", parentId: "root" }
  mocks.add.mockResolvedValue(reply)
  mocks.get.mockReturnValue({ json: () => Promise.resolve({ items: [reply], nextCursor: null }) })
  setup()
  await userEvent.click(screen.getByRole("button", { name: "Reply" }))
  await userEvent.type(screen.getByLabelText("Replying to @alice"), "Answer")
  await userEvent.click(screen.getByRole("button", { name: "Post reply" }))
  await waitFor(() => expect(mocks.add).toHaveBeenCalledWith({ text: "Answer", parentId: "root" }))
  expect(await screen.findByText("Answer")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "View parent" })).toHaveAttribute("href", "/quack/root")
})
it("keeps the draft when the target was deleted before posting", async () => {
  mocks.add.mockRejectedValue(new Error("This quack was deleted"))
  setup()
  await userEvent.click(screen.getByRole("button", { name: "Reply" }))
  await userEvent.type(screen.getByLabelText("Replying to @alice"), "Keep my draft")
  await userEvent.click(screen.getByRole("button", { name: "Post reply" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("This quack was deleted")
  expect(screen.getByLabelText("Replying to @alice")).toHaveValue("Keep my draft")
})
it("shows anonymous placeholders without reply or delete controls", () => {
  setup({
    ...root,
    deleted: true,
    text: null,
    user: null,
    userId: null,
    createdAt: null,
    canReply: false,
    canDelete: false,
    replyCount: 2,
  })
  expect(screen.getByText("This quack was deleted")).toBeInTheDocument()
  expect(screen.queryByText("Alice")).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Reply" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Delete quack" })).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Show replies (2)" })).toBeInTheDocument()
})
it("requires confirmation and scrubs inactive search caches after deletion", async () => {
  mocks.remove.mockResolvedValue(undefined)
  const { client } = setup()
  client.setQueryData(["quacks", "search", "Original"], [root])
  await userEvent.click(screen.getByRole("button", { name: "Delete quack" }))
  expect(screen.getByRole("dialog")).toHaveTextContent("Replies survive")
  expect(mocks.remove).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole("button", { name: "Delete" }))
  await waitFor(() =>
    expect(client.getQueryData(["quacks", "search", "Original"])).toMatchObject([
      { text: null, user: null, poll: null, deleted: true },
    ]),
  )
})

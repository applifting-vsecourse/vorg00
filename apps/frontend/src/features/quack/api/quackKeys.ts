export const quackKeys = {
  detail: (id: string) => ["quacks", "detail", id] as const,
  replies: (id: string) => ["quacks", "replies", id] as const,
  all: () => ["quacks"] as const,
  lists: () => [...quackKeys.all(), "list"] as const,
  list: (search: string, scope: "all" | "mine" = "all") =>
    [...quackKeys.lists(), { search, scope }] as const,
}

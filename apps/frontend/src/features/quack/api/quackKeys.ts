export const quackKeys = {
  all: () => ["quacks"] as const,
  lists: () => [...quackKeys.all(), "list"] as const,
  list: (search: string, scope: "all" | "mine" = "all") =>
    [...quackKeys.lists(), { search, scope }] as const,
}

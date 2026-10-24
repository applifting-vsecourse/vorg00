import { queryOptions } from "@tanstack/react-query"

import { api } from "@/lib/api-client"

import { quackKeys } from "@/features/quack/api/quackKeys"
import { quacksSchema } from "@/features/quack/api/quackSchemas"

export const quacksQueryOptions = (input = "", scope: "all" | "mine" = "all") => {
  const search = input.trim()
  return queryOptions({
    queryKey: quackKeys.list(search, scope),
    queryFn: async ({ signal }) =>
      quacksSchema.parse(
        await api
          .get("quacks", { signal, searchParams: { scope, ...(search ? { q: search } : {}) } })
          .json(),
      ),
  })
}

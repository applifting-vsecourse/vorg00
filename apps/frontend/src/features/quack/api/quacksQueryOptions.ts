import { queryOptions } from "@tanstack/react-query"

import { api } from "@/lib/api-client"

import { quackKeys } from "@/features/quack/api/quackKeys"
import { quacksSchema } from "@/features/quack/api/quackSchemas"

export const quacksQueryOptions = (input = "") => {
  const search = input.trim()
  return queryOptions({
    queryKey: quackKeys.list(search),
    queryFn: async ({ signal }) =>
      quacksSchema.parse(
        await api.get("quacks", { signal, searchParams: search ? { q: search } : {} }).json(),
      ),
  })
}

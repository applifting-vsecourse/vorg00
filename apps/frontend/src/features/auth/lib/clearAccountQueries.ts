import type { QueryClient } from "@tanstack/react-query"

import { authKeys } from "@/lib/auth-keys"

export async function clearAccountQueries(queryClient: QueryClient) {
  // Profiles, Mine and poll results belong to the account that fetched them.
  const filters = {
    predicate: (query: { queryKey: readonly unknown[] }) => query.queryKey[0] !== authKeys.all()[0],
  }
  await queryClient.cancelQueries(filters)
  queryClient.removeQueries(filters)
}

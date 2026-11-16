import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query"
import { z } from "zod"

import { api } from "@/lib/api-client"

import { quackKeys } from "@/features/quack/api/quackKeys"
import { quackSchema } from "@/features/quack/api/quackSchemas"

const pageSchema = z.object({ items: z.array(quackSchema), nextCursor: z.string().nullable() })
export const quackQueryOptions = (id: string) =>
  queryOptions({
    queryKey: quackKeys.detail(id),
    queryFn: async ({ signal }) =>
      quackSchema.parse(await api.get(`quacks/${id}`, { signal }).json()),
  })
export const repliesQueryOptions = (id: string) =>
  infiniteQueryOptions({
    queryKey: quackKeys.replies(id),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) =>
      pageSchema.parse(
        await api
          .get(`quacks/${id}/replies`, {
            signal,
            searchParams: pageParam ? { cursor: pageParam } : {},
          })
          .json(),
      ),
    getNextPageParam: (page) => page.nextCursor,
  })

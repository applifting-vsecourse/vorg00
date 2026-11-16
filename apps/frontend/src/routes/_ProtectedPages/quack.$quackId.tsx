import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { Seo } from "@/components/Seo"
import { Button } from "@/components/ui/button"

import { quackQueryOptions } from "@/features/quack/api/repliesQueryOptions"
import { QuackItem } from "@/features/quack/components/QuackItem"

export const Route = createFileRoute("/_ProtectedPages/quack/$quackId")({ component: QuackPage })
function QuackPage() {
  const { quackId } = Route.useParams()
  const query = useQuery(quackQueryOptions(quackId))
  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-8">
      <Seo title="Conversation" />
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Conversation</h1>
      <a
        href="/quacks"
        className="text-sm underline"
      >
        Back to feed
      </a>
      {query.isPending ? <p role="status">Loading quack…</p> : null}
      {query.error ? (
        <div role="alert">
          <p>{query.error.message}</p>
          <Button
            variant="outline"
            onClick={() => void query.refetch()}
          >
            Retry
          </Button>
        </div>
      ) : null}
      {query.data ? <QuackItem quack={query.data} /> : null}
    </section>
  )
}

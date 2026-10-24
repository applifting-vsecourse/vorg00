import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { Seo } from "@/components/Seo"

import { QuackFeed } from "@/features/quack/components/QuackFeed"
import { QuackForm } from "@/features/quack/components/QuackForm"
import { profileQueryOptions } from "@/features/settings/api/profile"

export const Route = createFileRoute("/_ProtectedPages/quacks")({
  component: QuacksPage,
})

function QuacksPage() {
  const profile = useQuery(profileQueryOptions())
  return (
    <>
      <Seo title="Quacks" />
      <section className="mx-auto w-full max-w-2xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">Quacks</h1>

        {profile.isPending ? (
          <p role="status">Loading post preferences…</p>
        ) : (
          <QuackForm
            className="mb-4"
            defaultMood={profile.data?.defaultMood}
          />
        )}

        <QuackFeed />
      </section>
    </>
  )
}

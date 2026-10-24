import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { Seo } from "@/components/Seo"
import { Button } from "@/components/ui/button"

import { profileQueryOptions } from "@/features/settings/api/profile"
import { SettingsForm } from "@/features/settings/components/SettingsForm"

export const Route = createFileRoute("/_ProtectedPages/settings")({ component: SettingsPage })
function SettingsPage() {
  const profile = useQuery(profileQueryOptions())
  return (
    <section className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <Seo title="Settings" />
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      {profile.isPending ? (
        <p role="status">Loading settings…</p>
      ) : profile.error ? (
        <div role="alert">
          <p>{profile.error.message}</p>
          <Button
            variant="outline"
            onClick={() => void profile.refetch()}
          >
            Retry
          </Button>
        </div>
      ) : (
        <SettingsForm profile={profile.data} />
      )}
    </section>
  )
}

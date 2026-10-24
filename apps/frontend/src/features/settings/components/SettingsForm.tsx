import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { HTTPError } from "@/lib/api-client"

import {
  moodSchema,
  profileQueryOptions,
  updateProfile,
  type Profile,
} from "@/features/settings/api/profile"

const schema = z.object({
  username: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9._]{3,30}$/, "Use 3–30 letters, numbers, dots or underscores"),
  name: z.string().trim().min(1, "Display name is required").max(100, "Use at most 100 characters"),
  bio: z.string().trim().max(160, "Use at most 160 characters"),
  defaultMood: moodSchema.nullable(),
})

export function SettingsForm({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient()
  const form = useForm<Profile>({ resolver: zodResolver(schema), defaultValues: profile })
  const save = useMutation({
    mutationFn: updateProfile,
    onSuccess: async (saved) => {
      form.reset(saved)
      queryClient.setQueryData(profileQueryOptions().queryKey, saved)
      await queryClient.invalidateQueries({ refetchType: "all" })
      toast.success("Settings saved")
    },
    onError: (error) => {
      if (error instanceof HTTPError && error.response.status === 409) {
        form.setError(
          "username",
          { message: "That username is already taken" },
          { shouldFocus: true },
        )
      }
    },
  })

  useEffect(() => {
    if (save.isError && save.error instanceof HTTPError && save.error.response.status === 409) {
      form.setFocus("username")
    }
  }, [save.isError, save.error, form])

  return (
    <Form {...form}>
      <form
        noValidate
        className="space-y-6"
        onSubmit={form.handleSubmit((values) => save.mutate(values))}
      >
        {save.error && !(save.error instanceof HTTPError && save.error.response.status === 409) ? (
          <Alert variant="destructive">
            <AlertDescription>{save.error.message}</AlertDescription>
          </Alert>
        ) : null}
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  autoComplete="username"
                  disabled={save.isPending}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Display name</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  autoComplete="name"
                  disabled={save.isPending}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bio (optional)</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  rows={3}
                  disabled={save.isPending}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="defaultMood"
          render={({ field }) => (
            <FormItem>
              <fieldset
                disabled={save.isPending}
                className="space-y-2"
              >
                <legend className="text-sm font-medium">Default mood for new posts</legend>
                <div className="flex flex-wrap gap-2">
                  {[null, ...moodSchema.options].map((value) => (
                    <Button
                      key={value ?? "none"}
                      type="button"
                      variant={field.value === value ? "secondary" : "outline"}
                      aria-pressed={field.value === value}
                      onClick={() => field.onChange(value)}
                    >
                      {value ? value.charAt(0).toUpperCase() + value.slice(1) : "None"}
                    </Button>
                  ))}
                </div>
              </fieldset>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex gap-3">
          <Button
            type="submit"
            disabled={save.isPending}
          >
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={save.isPending}
            onClick={() => {
              form.reset(profile)
              save.reset()
            }}
          >
            Discard changes
          </Button>
        </div>
      </form>
    </Form>
  )
}

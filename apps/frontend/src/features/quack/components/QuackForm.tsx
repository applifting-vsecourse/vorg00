import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
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
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import { quackMoodSchema, type QuackMood } from "@/features/quack/api/quackSchemas"
import { useAddQuack } from "@/features/quack/hooks/useAddQuack"
import { MOOD_OPTIONS } from "@/features/quack/moods"

// Mirrors the server-side DTO (MaxLength(280)) so the user is told before
// the request is made — the server still validates independently.
const MAX_LENGTH = 280

const schema = z.object({
  mood: quackMoodSchema.nullable(),
  text: z
    .string()
    .trim()
    .min(1, "Write something first")
    .max(MAX_LENGTH, `Keep it under ${MAX_LENGTH} characters`),
})

type FormValues = z.infer<typeof schema>

type QuackFormProps = { className?: string; defaultMood?: QuackMood | null }

export function QuackForm({ className, defaultMood = null }: QuackFormProps) {
  const addQuack = useAddQuack()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { text: "", mood: defaultMood },
  })

  const text = useWatch({ control: form.control, name: "text" })
  const mood = useWatch({ control: form.control, name: "mood" })
  const length = text?.length ?? 0

  const handleSubmit = (values: FormValues) => {
    addQuack.mutate(values, { onSuccess: () => form.reset() })
  }

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(handleSubmit)}
        className={cn("space-y-3", className)}
      >
        {addQuack.error ? (
          <Alert variant="destructive">
            <AlertDescription>{addQuack.error.message}</AlertDescription>
          </Alert>
        ) : null}

        <FormField
          control={form.control}
          name="text"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New quack</FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  placeholder="Quack something..."
                  disabled={addQuack.isPending}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <fieldset
          disabled={addQuack.isPending}
          className="space-y-2"
        >
          <legend className="text-sm font-medium">Mood (optional)</legend>
          <div className="flex flex-wrap gap-2">
            {quackMoodSchema.options.map((value) => {
              const { label, Icon } = MOOD_OPTIONS[value]
              return (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={mood === value ? "secondary" : "outline"}
                  aria-pressed={mood === value}
                  onClick={() => form.setValue("mood", mood === value ? null : value)}
                >
                  <Icon aria-hidden="true" />
                  {label}
                </Button>
              )
            })}
          </div>
          <p className="text-sm text-muted-foreground">Select again to clear.</p>
        </fieldset>

        <div className="flex items-center justify-end gap-3">
          <span
            className={cn(
              "text-sm",
              length > MAX_LENGTH ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {length}/{MAX_LENGTH}
          </span>
          <Button
            type="submit"
            size="sm"
            disabled={addQuack.isPending}
          >
            {addQuack.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Quack
          </Button>
        </div>
      </form>
    </Form>
  )
}

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { api } from "@/lib/api-client"

import { quackKeys } from "@/features/quack/api/quackKeys"
import { quackSchema, type Poll, type Quack } from "@/features/quack/api/quackSchemas"

export function PollCard({ quackId, poll }: { quackId: string; poll: Poll }) {
  const queryClient = useQueryClient()
  const vote = useMutation({
    mutationFn: async (optionId: string) =>
      quackSchema.parse(await api.put(`quacks/${quackId}/vote`, { json: { optionId } }).json()),
    onSuccess: async (updated) => {
      queryClient.setQueriesData<Quack[]>({ queryKey: quackKeys.all() }, (data) =>
        data?.map((quack) => (quack.id === updated.id ? updated : quack)),
      )
      await queryClient.invalidateQueries({ queryKey: quackKeys.all() })
    },
  })
  const selected = vote.isPending ? vote.variables : poll.selectedOptionId
  const total = poll.totalVotes
  return (
    <section
      aria-label="Poll"
      className="mt-3 space-y-2"
    >
      {poll.options.map((option) => {
        let count = option.count
        if (vote.isPending && count !== null && poll.selectedOptionId !== vote.variables) {
          if (option.id === poll.selectedOptionId) count -= 1
          if (option.id === vote.variables) count += 1
        }
        const percent = count !== null && total ? Math.round((count / total) * 100) : 0
        return (
          <Button
            key={option.id}
            type="button"
            variant={selected === option.id ? "secondary" : "outline"}
            className="h-auto w-full justify-between gap-3 text-left whitespace-normal"
            aria-pressed={selected === option.id}
            disabled={vote.isPending}
            onClick={() => vote.mutate(option.id)}
          >
            <span>{option.label}</span>
            {count !== null ? (
              <span className="shrink-0 text-muted-foreground">
                {count} ({percent}%)
              </span>
            ) : null}
          </Button>
        )
      })}
      <p
        role="status"
        className="text-sm text-muted-foreground"
      >
        {vote.isPending
          ? "Saving vote…"
          : total === null
            ? "Vote to see results."
            : `${total} ${total === 1 ? "vote" : "votes"} · You can change your vote.`}
      </p>
      {vote.error ? (
        <div
          role="alert"
          className="text-sm text-destructive"
        >
          <p>Your vote was not saved. {vote.error.message}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => vote.variables && vote.mutate(vote.variables)}
          >
            Retry vote
          </Button>
        </div>
      ) : null}
    </section>
  )
}

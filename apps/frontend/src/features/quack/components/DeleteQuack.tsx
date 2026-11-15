import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { api } from "@/lib/api-client"

import { quackKeys } from "@/features/quack/api/quackKeys"
import { scrubDeletedQuack } from "@/features/quack/api/scrubDeletedQuack"

export function DeleteQuack({ quackId }: { quackId: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: async () => {
      await api.delete(`quacks/${quackId}`)
    },
    onSuccess: async () => {
      setIsOpen(false)
      await queryClient.cancelQueries({ queryKey: quackKeys.all() })
      queryClient.setQueriesData({ queryKey: quackKeys.all() }, (data: unknown) =>
        scrubDeletedQuack(data, quackId),
      )
      await queryClient.invalidateQueries({ queryKey: quackKeys.all() })
    },
  })
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(isNextOpen) => {
        if (!remove.isPending) {
          setIsOpen(isNextOpen)
          remove.reset()
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Delete quack"
        >
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this quack?</DialogTitle>
          <DialogDescription>
            This permanently erases the text and any poll and votes. Replies survive under an
            anonymous placeholder. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {remove.error ? (
          <p
            role="alert"
            className="text-sm text-destructive"
          >
            {remove.error.message}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={remove.isPending}
            onClick={() => setIsOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
          >
            {remove.isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

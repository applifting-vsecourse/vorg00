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
import type { Quack } from "@/features/quack/api/quackSchemas"

export function DeleteQuack({ quackId }: { quackId: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: async () => {
      await api.delete(`quacks/${quackId}`)
    },
    onSuccess: async () => {
      setIsOpen(false)
      queryClient.setQueriesData<Quack[]>({ queryKey: quackKeys.all() }, (data) =>
        data?.filter((quack) => quack.id !== quackId),
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
            This permanently removes the quack and any poll and votes attached to it.
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

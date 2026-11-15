import { useId, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

import { addQuack } from "@/features/quack/api/addQuack"
import { quackKeys } from "@/features/quack/api/quackKeys"

export function ReplyForm({
  parentId,
  author,
  onPosted,
  onCancel,
}: {
  parentId: string
  author: string
  onPosted: () => void
  onCancel: () => void
}) {
  const id = useId()
  const [text, setText] = useState("")
  const [validation, setValidation] = useState("")
  const client = useQueryClient()
  const post = useMutation({
    mutationFn: () => addQuack({ text: text.trim(), parentId }),
    onSuccess: async () => {
      setText("")
      await client.resetQueries({ queryKey: quackKeys.replies(parentId) })
      await client.invalidateQueries({ queryKey: quackKeys.all() })
      onPosted()
    },
  })
  return (
    <form
      className="my-3 space-y-2"
      onSubmit={(event) => {
        event.preventDefault()
        if (!text.trim() || Array.from(text.trim()).length > 280) {
          setValidation("Write 1–280 characters.")
          return
        }
        setValidation("")
        post.mutate()
      }}
    >
      <Label htmlFor={id}>Replying to {author}</Label>
      <Textarea
        id={id}
        value={text}
        disabled={post.isPending}
        onChange={(event) => setText(event.target.value)}
        aria-describedby={`${id}-status`}
      />
      <p
        id={`${id}-status`}
        className="text-sm text-muted-foreground"
        role="status"
      >
        {Array.from(text).length}/280{post.isPending ? " · Posting…" : ""}
      </p>
      {validation || post.error ? (
        <p
          role="alert"
          className="text-sm text-destructive"
        >
          {validation ||
            `${post.error?.message} Your draft is kept. If the response was lost, check the replies before trying again.`}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={post.isPending}
        >
          Post reply
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={post.isPending}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}

import { useState } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/date"

import type { Quack } from "@/features/quack/api/quackSchemas"
import { repliesQueryOptions } from "@/features/quack/api/repliesQueryOptions"
import { DeleteQuack } from "@/features/quack/components/DeleteQuack"
import { PollCard } from "@/features/quack/components/PollCard"
import { ReplyForm } from "@/features/quack/components/ReplyForm"
import { UsersName } from "@/features/quack/components/UsersName"
import { UsersUserName } from "@/features/quack/components/UsersUserName"
import { MOOD_OPTIONS } from "@/features/quack/moods"

type QuackItemProps = {
  quack: Quack
  currentUserId?: string
  isAdmin?: boolean
  depth?: number
  isPreview?: boolean
}
export function QuackItem({
  quack,
  currentUserId,
  isAdmin = false,
  depth = 0,
  isPreview = false,
}: QuackItemProps) {
  const [isExpanded, setExpanded] = useState(false)
  const [isComposing, setComposing] = useState(false)
  const replies = useInfiniteQuery({ ...repliesQueryOptions(quack.id), enabled: isExpanded })
  const author = quack.user
  const mood = quack.mood ? MOOD_OPTIONS[quack.mood] : null
  return (
    <article
      data-quack-id={quack.id}
      className="w-full border-b border-border pt-2 pb-4 last:border-b-0"
    >
      <div className="flex gap-3">
        {!quack.deleted && author ? (
          <Avatar className="size-8">
            <AvatarFallback>
              {author.name
                .split(" ")
                .map((word) => word[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ) : null}
        <div className="min-w-0 flex-1 space-y-2">
          {quack.deleted ? (
            <p className="text-sm text-muted-foreground">This quack was deleted</p>
          ) : (
            <>
              <div className="flex flex-wrap items-baseline gap-2">
                {author ? (
                  <span>
                    <UsersName name={author.name} /> <UsersUserName username={author.username} />
                  </span>
                ) : null}
                {quack.createdAt ? (
                  <time className="text-xs text-muted-foreground">
                    {formatDate(quack.createdAt)}
                  </time>
                ) : null}
                {mood ? <span className="text-xs text-muted-foreground">{mood.label}</span> : null}
                {quack.canDelete ? <DeleteQuack quackId={quack.id} /> : null}
              </div>
              <p className="text-sm break-words whitespace-pre-line">{quack.text}</p>
              {quack.poll ? (
                <PollCard
                  quackId={quack.id}
                  poll={quack.poll}
                />
              ) : null}
            </>
          )}
          {!isPreview ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <a
                className="text-muted-foreground underline"
                href={`/quack/${quack.id}`}
              >
                Open quack
              </a>
              {quack.parentId ? (
                <a
                  className="text-muted-foreground underline"
                  href={`/quack/${quack.parentId}`}
                >
                  View parent
                </a>
              ) : null}
              {quack.canReply ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setComposing(true)}
                >
                  Reply
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                aria-expanded={isExpanded}
                onClick={() => setExpanded((isOpen) => !isOpen)}
              >
                {isExpanded ? "Hide replies" : "Show replies"} ({quack.replyCount})
              </Button>
            </div>
          ) : null}
          {isComposing ? (
            <ReplyForm
              parentId={quack.id}
              author={author?.username ? `@${author.username}` : (author?.name ?? "deleted quack")}
              onCancel={() => setComposing(false)}
              onPosted={() => {
                setComposing(false)
                setExpanded(true)
              }}
            />
          ) : null}
        </div>
      </div>
      {isExpanded ? (
        <div className={depth < 3 ? "mt-3 ml-4 border-l border-border pl-3" : "mt-3"}>
          {replies.isPending ? (
            <p
              role="status"
              className="text-sm text-muted-foreground"
            >
              Loading replies…
            </p>
          ) : null}
          {replies.error ? (
            <div role="alert">
              <p>{replies.error.message}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void replies.refetch()}
              >
                Retry replies
              </Button>
            </div>
          ) : null}
          {!replies.isPending &&
          !replies.error &&
          !replies.data?.pages.some((page) => page.items.length) ? (
            <p className="text-sm text-muted-foreground">No replies yet.</p>
          ) : null}
          {replies.data?.pages
            .flatMap((page) => page.items)
            .map((reply) => (
              <QuackItem
                key={reply.id}
                quack={reply}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                depth={depth + 1}
              />
            ))}
          {replies.hasNextPage ? (
            <Button
              variant="outline"
              size="sm"
              disabled={replies.isFetchingNextPage}
              onClick={() => void replies.fetchNextPage()}
            >
              {replies.isFetchingNextPage ? "Loading…" : "Load more replies"}
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

import { Loader2, RefreshCw } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

import type { Quack } from "@/features/quack/api/quackSchemas"
import { QuackItem } from "@/features/quack/components/QuackItem"

type QuackListProps = {
  currentUserId?: string
  isAdmin?: boolean
  isMine?: boolean
  onCompose?: () => void
  quacks: Quack[]
  isLoading?: boolean
  error?: Error
  onReload?: () => void
  search?: string
  onClear?: () => void
}

export function QuackList({
  currentUserId,
  isAdmin = false,
  isMine = false,
  onCompose,
  quacks,
  isLoading,
  error,
  onReload,
  search = "",
  onClear,
}: QuackListProps) {
  return (
    <div className="flex flex-col">
      {isLoading && quacks.length === 0 ? (
        <div
          role="status"
          className="flex items-center justify-center gap-2 py-8 text-muted-foreground"
        >
          <Loader2
            className="size-5 animate-spin"
            aria-hidden="true"
          />
          {search ? "Searching…" : "Loading quacks…"}
        </div>
      ) : null}

      {error ? (
        <Alert
          variant="destructive"
          className="mb-4"
        >
          <AlertTitle>Couldn&apos;t load quacks</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>{error.message}</span>
            {onReload ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onReload}
              >
                <RefreshCw className="size-4" />
                Reload
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {!isLoading && !error && quacks.length === 0 ? (
        <div
          role="status"
          className="space-y-3 py-8 text-center text-sm text-muted-foreground"
        >
          <p>
            {search
              ? `No quacks match "${search}".`
              : isMine
                ? "You have not posted any quacks yet."
                : "No quacks yet. Post the first one."}
          </p>
          {isMine && !search && onCompose ? (
            <Button
              variant="outline"
              onClick={onCompose}
            >
              Write your first quack
            </Button>
          ) : null}
          {search && onClear ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onClear}
            >
              Clear search
            </Button>
          ) : null}
        </div>
      ) : null}

      {!error && !isLoading
        ? quacks.map((quack) => (
            <QuackItem
              key={quack.id}
              quack={quack}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
            />
          ))
        : null}
    </div>
  )
}

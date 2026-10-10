import { useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { quacksQueryOptions } from "@/features/quack/api/quacksQueryOptions"
import { QuackList } from "@/features/quack/components/QuackList"

export function QuackFeed() {
  const [input, setInput] = useState("")
  const [search, setSearch] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const trimmed = input.trim()
  // Clearing is immediate; typing waits briefly before reaching the server.
  const activeSearch = trimmed === "" ? "" : search
  const isWaiting = trimmed !== activeSearch

  useEffect(() => {
    const timer = setTimeout(() => setSearch(trimmed), 300)
    return () => clearTimeout(timer)
  }, [trimmed])

  const query = useQuery({ ...quacksQueryOptions(activeSearch), enabled: !isWaiting })

  const clearSearch = () => {
    setInput("")
    setSearch("")
    inputRef.current?.focus()
  }

  return (
    <>
      <div
        role="search"
        aria-label="Search the feed"
        className="mb-6 space-y-2"
      >
        <Label htmlFor="quack-search">Search quacks</Label>
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            id="quack-search"
            type="search"
            maxLength={100}
            placeholder="A word, name, or username"
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
          {input ? (
            <Button
              type="button"
              variant="outline"
              onClick={clearSearch}
            >
              Clear
            </Button>
          ) : null}
        </div>
      </div>
      <QuackList
        search={trimmed}
        quacks={isWaiting ? [] : (query.data ?? [])}
        isLoading={isWaiting || query.isPending}
        error={isWaiting ? undefined : (query.error ?? undefined)}
        onClear={clearSearch}
        onReload={() => void query.refetch()}
      />
    </>
  )
}

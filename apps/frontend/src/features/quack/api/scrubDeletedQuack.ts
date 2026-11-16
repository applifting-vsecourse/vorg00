// Lists, details and infinite pages all contain the same quack shape. Scrub every
// loaded copy immediately, including inactive searches, before any refetch.
export function scrubDeletedQuack(data: unknown, id: string): unknown {
  if (Array.isArray(data)) return data.map((item) => scrubDeletedQuack(item, id))
  if (!data || typeof data !== "object" || data instanceof Date) return data
  const record = data as Record<string, unknown>
  if (record.id === id && "text" in record) {
    return {
      ...record,
      deleted: true,
      text: null,
      userId: null,
      user: null,
      mood: null,
      poll: null,
      createdAt: null,
      canReply: false,
      canDelete: false,
    }
  }
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, scrubDeletedQuack(value, id)]),
  )
}

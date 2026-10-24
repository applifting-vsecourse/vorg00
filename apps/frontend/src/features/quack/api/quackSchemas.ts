import { z } from "zod"

export const quackMoodSchema = z.enum(["happy", "sad", "angry", "silly"])
export type QuackMood = z.infer<typeof quackMoodSchema>

export const pollSchema = z.object({
  options: z.array(z.object({ id: z.string(), label: z.string(), count: z.number().nullable() })),
  selectedOptionId: z.string().nullable(),
  totalVotes: z.number().nullable(),
})
export type Poll = z.infer<typeof pollSchema>

// Per the Applifting frontend playbook: validate every server payload with zod
// and infer types from the schema rather than auto-generating them.
export const quackUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string(),
})

export const quackSchema = z.object({
  id: z.string(),
  text: z.string(),
  mood: quackMoodSchema.nullish(),
  poll: pollSchema.nullish(),
  userId: z.string(),
  createdAt: z.coerce.date(),
  user: quackUserSchema,
})

export const quacksSchema = z.array(quackSchema)

export type Quack = z.infer<typeof quackSchema>

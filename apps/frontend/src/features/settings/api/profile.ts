import { queryOptions } from "@tanstack/react-query"
import { z } from "zod"

import { api } from "@/lib/api-client"

export const moodSchema = z.enum(["happy", "sad", "angry", "silly"])
const profileSchema = z.object({
  username: z
    .string()
    .nullable()
    .transform((value) => value ?? ""),
  name: z.string(),
  bio: z
    .string()
    .nullable()
    .transform((value) => value ?? ""),
  defaultMood: moodSchema.nullable(),
})
export type Profile = z.infer<typeof profileSchema>
export const profileQueryOptions = () =>
  queryOptions({
    queryKey: ["profile"],
    queryFn: async () => profileSchema.parse(await api.get("profile").json()),
  })
export const updateProfile = async (input: Profile) =>
  profileSchema.parse(await api.put("profile", { json: input }).json())

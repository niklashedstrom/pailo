import { z } from 'zod'

/**
 * Placeholder for the app description schema.
 * The real schema (collections, views, input, people, reminders, theme) is defined in M1.
 */
export const CURRENT_SCHEMA_VERSION = 0

export const appDescriptionSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  name: z.string().min(1),
})

export type AppDescription = z.infer<typeof appDescriptionSchema>

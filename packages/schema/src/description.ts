import { z } from 'zod'
import { collectionSchema } from './collection.ts'
import { inputSchema } from './inputs.ts'
import { LIMITS, descriptionSchema, idSchema, nameSchema } from './primitives.ts'
import { checkReferences } from './references.ts'
import { reminderSchema } from './reminders.ts'
import { iconSchema, themeSchema } from './theme.ts'
import { viewSchema } from './views.ts'

export const CURRENT_SCHEMA_VERSION = 1

export const personSchema = z.strictObject({ id: idSchema, name: nameSchema })

/** The shape of an app description, without cross-reference checks. */
export const appDescriptionShape = z.strictObject({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  name: nameSchema,
  description: descriptionSchema.optional(),
  icon: iconSchema.optional(),
  collections: z.array(collectionSchema).min(1).max(LIMITS.collections),
  views: z.array(viewSchema).min(1).max(LIMITS.views),
  inputs: z.array(inputSchema).max(LIMITS.inputs),
  people: z.strictObject({
    /** People without an account, e.g. children. */
    others: z.array(personSchema).max(LIMITS.people),
  }),
  reminders: z.array(reminderSchema).max(LIMITS.reminders),
  theme: themeSchema,
})

/** The full app description: shape plus cross-reference rules. */
export const appDescriptionSchema = appDescriptionShape.superRefine(checkReferences)

export type AppDescription = z.infer<typeof appDescriptionSchema>
export type Person = z.infer<typeof personSchema>

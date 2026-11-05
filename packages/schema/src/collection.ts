import { z } from 'zod'
import { fieldSchema } from './fields'
import { LIMITS, idSchema, nameSchema } from './primitives'

/**
 * What household members may do with the collection's records. Admins can
 * always do everything.
 * - edit: create, change and delete all records
 * - add: create records and change their own
 * - read: only read
 */
export const ACCESS_LEVELS = ['edit', 'add', 'read'] as const

export const collectionSchema = z.strictObject({
  id: idSchema,
  name: nameSchema,
  access: z.enum(ACCESS_LEVELS),
  fields: z.array(fieldSchema).min(1).max(LIMITS.fieldsPerCollection),
})

export type Collection = z.infer<typeof collectionSchema>
export type AccessLevel = Collection['access']

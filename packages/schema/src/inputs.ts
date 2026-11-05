import { z } from 'zod'
import { idSchema, nameSchema } from './primitives'

const base = { id: idSchema, name: nameSchema, collection: idSchema }

export const formInputSchema = z.strictObject({ ...base, type: z.literal('form') })

/** Which fields receive the incoming address, title and text. */
export const incomingMapSchema = z
  .strictObject({
    url: idSchema.optional(),
    title: idSchema.optional(),
    text: idSchema.optional(),
  })
  .refine((map) => map.url !== undefined || map.title !== undefined || map.text !== undefined, {
    message: 'Map at least one of url, title or text to a field',
  })

/** The phone's share menu. */
export const shareInputSchema = z.strictObject({
  ...base,
  type: z.literal('share'),
  map: incomingMapSchema,
})

/** A bookmark button for the computer's browser. */
export const bookmarkletInputSchema = z.strictObject({
  ...base,
  type: z.literal('bookmarklet'),
  map: incomingMapSchema,
})

export const inputSchema = z.discriminatedUnion('type', [
  formInputSchema,
  shareInputSchema,
  bookmarkletInputSchema,
])

export type Input = z.infer<typeof inputSchema>

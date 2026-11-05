import { z } from 'zod'
import { LIMITS, idSchema, nameSchema } from './primitives'

export const sortSchema = z.strictObject({
  field: idSchema,
  direction: z.enum(['asc', 'desc']),
})

const shownFields = z.array(idSchema).min(1).max(LIMITS.fieldsPerView)

const base = { id: idSchema, name: nameSchema }

export const listViewSchema = z.strictObject({
  ...base,
  type: z.literal('list'),
  collection: idSchema,
  fields: shownFields.optional(),
  sort: sortSchema.optional(),
})

export const cardsViewSchema = z.strictObject({
  ...base,
  type: z.literal('cards'),
  collection: idSchema,
  fields: shownFields.optional(),
  sort: sortSchema.optional(),
})

export const calendarViewSchema = z.strictObject({
  ...base,
  type: z.literal('calendar'),
  collection: idSchema,
  dateField: idSchema,
  range: z.enum(['week', 'month']),
  fields: shownFields.optional(),
})

export const overviewSectionSchema = z.strictObject({
  collection: idSchema,
  title: nameSchema.optional(),
  limit: z.int().min(1).max(LIMITS.itemsPerSection).optional(),
  sort: sortSchema.optional(),
})

export const overviewViewSchema = z.strictObject({
  ...base,
  type: z.literal('overview'),
  sections: z.array(overviewSectionSchema).min(1).max(LIMITS.sectionsPerOverview),
})

export const viewSchema = z.discriminatedUnion('type', [
  listViewSchema,
  cardsViewSchema,
  calendarViewSchema,
  overviewViewSchema,
])

export type View = z.infer<typeof viewSchema>

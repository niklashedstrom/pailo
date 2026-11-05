import { z } from 'zod'
import { LIMITS, idSchema, nameSchema } from './primitives'

const base = {
  id: idSchema,
  label: nameSchema,
  required: z.boolean().optional(),
}

export const textFieldSchema = z.strictObject({
  ...base,
  type: z.literal('text'),
  multiline: z.boolean().optional(),
})

export const dateFieldSchema = z.strictObject({
  ...base,
  type: z.literal('date'),
  withTime: z.boolean().optional(),
})

export const imageFieldSchema = z.strictObject({ ...base, type: z.literal('image') })

export const linkFieldSchema = z.strictObject({ ...base, type: z.literal('link') })

/** Points to a household member or to one of the description's people without an account. */
export const personFieldSchema = z.strictObject({
  ...base,
  type: z.literal('person'),
  multiple: z.boolean().optional(),
})

export const choiceOptionSchema = z.strictObject({
  value: idSchema,
  label: nameSchema,
})

export const choiceFieldSchema = z.strictObject({
  ...base,
  type: z.literal('choice'),
  options: z.array(choiceOptionSchema).min(1).max(LIMITS.optionsPerChoice),
  multiple: z.boolean().optional(),
})

/** Points to a record in another collection of the same description. */
export const referenceFieldSchema = z.strictObject({
  ...base,
  type: z.literal('reference'),
  collection: idSchema,
})

export const fieldSchema = z.discriminatedUnion('type', [
  textFieldSchema,
  dateFieldSchema,
  imageFieldSchema,
  linkFieldSchema,
  personFieldSchema,
  choiceFieldSchema,
  referenceFieldSchema,
])

export type Field = z.infer<typeof fieldSchema>
export type FieldType = Field['type']

import { z } from 'zod'
import type { Collection } from './collection'
import type { Field } from './fields'
import { idSchema } from './primitives'

// The stored format of a record's field values (records.data), keyed on
// field id. A field without a value is absent, never an empty string or
// null. The database only checks shape and size; these schemas are the rules
// the runtime enforces before saving and uses to read values defensively.

export const RECORD_LIMITS = {
  textLength: 10_000,
  linkLength: 2_000,
} as const

const nonBlank = (max: number) =>
  z
    .string()
    .max(max)
    .refine((value) => value.trim().length > 0, 'Must not be blank')

function isCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return day <= daysInMonth
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

/** `2026-11-11`: a day in Swedish local time, without a time zone. */
export const dateValueSchema = z.string().refine((value) => {
  const match = DATE.exec(value)
  return match !== null && isCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]))
}, 'Expected a real date as YYYY-MM-DD')

/** `2026-11-11T18:30`: a day and time in Swedish local time, without a time zone. */
export const dateTimeValueSchema = z.string().refine((value) => {
  const match = DATE_TIME.exec(value)
  return (
    match !== null &&
    isCalendarDate(Number(match[1]), Number(match[2]), Number(match[3])) &&
    Number(match[4]) <= 23 &&
    Number(match[5]) <= 59
  )
}, 'Expected a real date and time as YYYY-MM-DDTHH:MM')

/** Only http and https addresses with a host; anything else could run code when clicked. */
export const linkValueSchema = z
  .string()
  .max(RECORD_LIMITS.linkLength)
  .regex(/^https?:\/\/[^\s/?#]+[^\s]*$/i, 'Expected an http or https address')

/** A household member (by user id) or one of the description's people without an account. */
export const personRefSchema = z.union([
  z.strictObject({ member: z.guid() }),
  z.strictObject({ other: idSchema }),
])

export const referenceValueSchema = z.guid()

export type PersonRef = z.infer<typeof personRefSchema>

function uniqueList<T extends z.ZodType>(item: T) {
  return z
    .array(item)
    .min(1)
    .refine(
      (values) => new Set(values.map((value) => JSON.stringify(value))).size === values.length,
      'Values must be unique',
    )
}

/** The schema for one field's value, ignoring whether the field is required. */
export function fieldValueSchema(field: Field): z.ZodType {
  switch (field.type) {
    case 'text':
      return nonBlank(RECORD_LIMITS.textLength)
    case 'date':
      return field.withTime ? dateTimeValueSchema : dateValueSchema
    case 'link':
      return linkValueSchema
    case 'choice': {
      const values = field.options.map((option) => option.value) as [string, ...string[]]
      const one = z.enum(values)
      return field.multiple ? uniqueList(one) : one
    }
    case 'person':
      return field.multiple ? uniqueList(personRefSchema) : personRefSchema
    case 'reference':
      return referenceValueSchema
    case 'image':
      // Images arrive with file storage (M3b); until then no value is accepted.
      return z.never()
    default: {
      const unknownField: never = field
      throw new Error(`Unknown field type: ${JSON.stringify(unknownField)}`)
    }
  }
}

/**
 * The strict schema for a record's data in one collection: unknown fields,
 * wrong formats, choices outside the options and missing required fields are
 * rejected. Image fields are never required until images are supported, so a
 * form can always be saved.
 */
export function recordDataSchema(collection: Collection) {
  const shape: Record<string, z.ZodType> = {}
  for (const field of collection.fields) {
    const value = fieldValueSchema(field)
    shape[field.id] = field.required && field.type !== 'image' ? value : value.optional()
  }
  return z.strictObject(shape)
}

export type RecordData = Record<string, unknown>

/** Reads one stored value; undefined when it is missing or does not match the field. */
export function parseFieldValue(field: Field, value: unknown): unknown {
  if (value === undefined) return undefined
  const result = fieldValueSchema(field).safeParse(value)
  return result.success ? result.data : undefined
}

import { z } from 'zod'
import { LIMITS, idSchema, nameSchema } from './primitives'

export const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

/** Time of day as HH:MM, 24-hour clock. */
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:MM (24-hour)')

const base = { id: idSchema, message: nameSchema, time: timeSchema }

export const dailyReminderSchema = z.strictObject({ ...base, type: z.literal('daily') })

export const weeklyReminderSchema = z.strictObject({
  ...base,
  type: z.literal('weekly'),
  weekday: z.enum(WEEKDAYS),
})

/** A number of days before the date in a date field of each record. */
export const beforeDateReminderSchema = z.strictObject({
  ...base,
  type: z.literal('beforeDate'),
  collection: idSchema,
  dateField: idSchema,
  daysBefore: z.int().min(0).max(LIMITS.daysBefore),
})

export const reminderSchema = z.discriminatedUnion('type', [
  dailyReminderSchema,
  weeklyReminderSchema,
  beforeDateReminderSchema,
])

export type Reminder = z.infer<typeof reminderSchema>

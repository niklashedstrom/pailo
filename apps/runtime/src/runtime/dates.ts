// Dates in records are Swedish local days ("2026-11-11") or days with a time
// ("2026-11-11T18:30"), without a time zone. They are never handed to
// `new Date(string)`, which would read them as UTC. Day arithmetic happens on
// UTC midnights so daylight saving can never shift a day.

/** A day as `YYYY-MM-DD`. */
export type DayKey = string

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/
const DAY_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/
const MS_PER_DAY = 86_400_000

function toUtc(day: DayKey): number {
  const match = DAY.exec(day)
  if (!match) throw new Error(`Not a day: ${day}`)
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

function fromUtc(ms: number): DayKey {
  return new Date(ms).toISOString().slice(0, 10)
}

/** The day part of a stored date value, or null if it is not a date. */
export function dayOf(value: unknown): DayKey | null {
  if (typeof value !== 'string') return null
  const timed = DAY_TIME.exec(value)
  const day = timed ? timed[1] : value
  if (!DAY.test(day)) return null
  return fromUtc(toUtc(day)) === day ? day : null
}

/** The time part (`18:30`) of a stored value with time, else null. */
export function timeOf(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return DAY_TIME.exec(value)?.[2] ?? null
}

/** Today in Sweden, whatever the device's time zone. */
export function today(now: Date = new Date()): DayKey {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm' }).format(now)
}

export function addDays(day: DayKey, days: number): DayKey {
  return fromUtc(toUtc(day) + days * MS_PER_DAY)
}

/** Monday of the day's week. */
export function startOfWeek(day: DayKey): DayKey {
  const weekday = (new Date(toUtc(day)).getUTCDay() + 6) % 7 // Monday = 0
  return addDays(day, -weekday)
}

export function weekDays(day: DayKey): DayKey[] {
  const monday = startOfWeek(day)
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

export function startOfMonth(day: DayKey): DayKey {
  return `${day.slice(0, 7)}-01`
}

export function addMonths(day: DayKey, months: number): DayKey {
  const date = new Date(toUtc(startOfMonth(day)))
  date.setUTCMonth(date.getUTCMonth() + months)
  return fromUtc(date.getTime())
}

export function monthDays(day: DayKey): DayKey[] {
  const first = startOfMonth(day)
  const next = addMonths(first, 1)
  const count = (toUtc(next) - toUtc(first)) / MS_PER_DAY
  return Array.from({ length: count }, (_, i) => addDays(first, i))
}

/** ISO 8601 week number (weeks start on Monday; week 1 holds the first Thursday). */
export function isoWeek(day: DayKey): number {
  const thursday = addDays(startOfWeek(day), 3)
  const yearStart = Date.UTC(Number(thursday.slice(0, 4)), 0, 1)
  return Math.floor((toUtc(thursday) - yearStart) / MS_PER_DAY / 7) + 1
}

function format(day: DayKey, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'UTC', ...options }).format(new Date(toUtc(day)))
}

/** "onsdag 11 november" */
export const formatWeekday = (day: DayKey) => format(day, { weekday: 'long', day: 'numeric', month: 'long' })

/** "mån" */
export const formatShortWeekday = (day: DayKey) => format(day, { weekday: 'short' })

/** "november 2026" */
export const formatMonth = (day: DayKey) => format(day, { month: 'long', year: 'numeric' })

/** "11 nov. 2026" or "11 nov. 2026 18:30"; empty for anything that is not a date. */
export function formatDateValue(value: unknown): string {
  const day = dayOf(value)
  if (day === null) return ''
  const date = format(day, { day: 'numeric', month: 'short', year: 'numeric' })
  const time = timeOf(value)
  return time ? `${date} ${time}` : date
}

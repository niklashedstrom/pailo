import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  dayOf,
  formatDateValue,
  formatMonth,
  formatWeekday,
  isoWeek,
  monthDays,
  startOfWeek,
  timeOf,
  today,
  weekDays,
} from './dates'

describe('dates', () => {
  it('reads the day and time of stored values', () => {
    expect(dayOf('2026-11-11')).toBe('2026-11-11')
    expect(dayOf('2026-11-11T18:30')).toBe('2026-11-11')
    expect(timeOf('2026-11-11T18:30')).toBe('18:30')
    expect(timeOf('2026-11-11')).toBeNull()
  })

  it.each(['2026-02-30', '11/11/2026', '', 42, null, undefined])('treats %j as no date', (value) => {
    expect(dayOf(value)).toBeNull()
    expect(formatDateValue(value)).toBe('')
  })

  it("gives today's date in Sweden, not in the device's time zone", () => {
    // 23:30 UTC on 31 Dec is already 1 Jan in Stockholm.
    expect(today(new Date(Date.UTC(2026, 11, 31, 23, 30)))).toBe('2027-01-01')
  })

  it('starts weeks on Monday', () => {
    expect(startOfWeek('2026-11-11')).toBe('2026-11-09') // Wednesday → Monday
    expect(startOfWeek('2026-11-15')).toBe('2026-11-09') // Sunday → Monday before
    expect(weekDays('2026-11-11')).toEqual([
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
      '2026-11-15',
    ])
  })

  it('handles a week across the turn of the year', () => {
    expect(weekDays('2027-01-01')[0]).toBe('2026-12-28')
    expect(weekDays('2027-01-01')[6]).toBe('2027-01-03')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('numbers weeks the ISO way, including week 53', () => {
    expect(isoWeek('2026-11-11')).toBe(46)
    expect(isoWeek('2026-12-31')).toBe(53)
    expect(isoWeek('2027-01-03')).toBe(53)
    expect(isoWeek('2027-01-04')).toBe(1)
  })

  it('steps months and lists their days', () => {
    expect(addMonths('2026-11-30', 1)).toBe('2026-12-01')
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-01')
    expect(addMonths('2026-01-31', -1)).toBe('2025-12-01')
    expect(monthDays('2028-02-10')).toHaveLength(29)
    expect(monthDays('2026-11-10').at(-1)).toBe('2026-11-30')
  })

  it('formats in Swedish', () => {
    expect(formatWeekday('2026-11-11')).toBe('onsdag 11 november')
    expect(formatMonth('2026-11-11')).toBe('november 2026')
    expect(formatDateValue('2026-11-11')).toBe('11 nov. 2026')
    expect(formatDateValue('2026-11-11T18:30')).toBe('11 nov. 2026 18:30')
  })

  it('does not move across daylight saving changes', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29')
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26')
  })
})

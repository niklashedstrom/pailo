import { describe, expect, it } from 'vitest'
import drop from '../examples/drop.json'
import calendarWithoutDate from '../examples/invalid/kalender-utan-datumfalt.json'
import unknownProperty from '../examples/invalid/okand-egenskap.json'
import matschema from '../examples/matschema.json'
import { parseAppDescription } from './parse'

describe('reference apps', () => {
  it.each([
    ['Drop', drop],
    ['Matschema', matschema],
  ])('%s validates', (_, example) => {
    const result = parseAppDescription(example)
    expect(result.success ? [] : result.issues).toEqual([])
  })

  it('Matschema links meals to dishes and plans the week on Sunday evening', () => {
    const result = parseAppDescription(matschema)
    if (!result.success) throw new Error('Matschema must validate')
    const meals = result.data.collections.find((c) => c.id === 'maltider')
    expect(meals?.fields).toContainEqual(expect.objectContaining({ type: 'reference', collection: 'ratter' }))
    expect(result.data.views).toContainEqual(expect.objectContaining({ type: 'calendar', range: 'week' }))
    expect(result.data.reminders).toContainEqual(
      expect.objectContaining({ type: 'weekly', weekday: 'sunday', time: '18:00' }),
    )
    expect(result.data.people.others.length).toBeGreaterThan(0)
  })
})

describe('broken examples', () => {
  it.each([
    ['a calendar on a non-date field', calendarWithoutDate, ['views', 0, 'dateField']],
    ['an unknown property', unknownProperty, ['views', 0, 'script']],
  ])('rejects %s and points at it', (_, example, path) => {
    const result = parseAppDescription(example)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.issues.map((issue) => issue.path)).toEqual([path])
  })
})

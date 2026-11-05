import { describe, expect, it } from 'vitest'
import { appDescriptionSchema } from './description'
import { validDescription } from './test-helpers'

describe('appDescriptionSchema shape', () => {
  it('accepts a minimal valid description', () => {
    expect(appDescriptionSchema.safeParse(validDescription()).success).toBe(true)
  })

  it('rejects an unknown access level', () => {
    const d = validDescription()
    d.collections[0].access = 'admin-only'
    const result = appDescriptionSchema.safeParse(d)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['collections', 0, 'access'])
  })

  it('rejects a free colour code in the theme', () => {
    const d = validDescription()
    d.theme.palette = '#ff0000'
    const result = appDescriptionSchema.safeParse(d)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['theme', 'palette'])
  })

  it('accepts theme adjustments from the fixed lists', () => {
    const d = validDescription()
    d.theme = { preset: 'playful', palette: 'sage', font: 'rounded', spacing: 'airy', radius: 'large', density: 'comfortable' }
    expect(appDescriptionSchema.safeParse(d).success).toBe(true)
  })

  it('accepts people without an account', () => {
    const d = validDescription()
    d.people.others = [{ id: 'ella', name: 'Ella' }]
    expect(appDescriptionSchema.safeParse(d).success).toBe(true)
  })

  it('rejects a collection without fields', () => {
    const d = validDescription()
    d.collections[0].fields = []
    expect(appDescriptionSchema.safeParse(d).success).toBe(false)
  })

  it('rejects a description without collections', () => {
    const d = validDescription()
    d.collections = []
    expect(appDescriptionSchema.safeParse(d).success).toBe(false)
  })

  it('rejects another schema version', () => {
    const d = validDescription()
    d.schemaVersion = 0
    expect(appDescriptionSchema.safeParse(d).success).toBe(false)
  })
})

describe('views', () => {
  it.each([
    { id: 'list', name: 'Lista', type: 'list', collection: 'items', fields: ['title'], sort: { field: 'title', direction: 'asc' } },
    { id: 'cards', name: 'Kort', type: 'cards', collection: 'items' },
    { id: 'week', name: 'Veckan', type: 'calendar', collection: 'items', dateField: 'when', range: 'week' },
    { id: 'home', name: 'Hem', type: 'overview', sections: [{ collection: 'items', title: 'Senaste', limit: 5 }] },
  ])('accepts a valid $type view', (view) => {
    const d = validDescription()
    d.views = [view]
    expect(appDescriptionSchema.safeParse(d).success).toBe(true)
  })

  it('rejects an unknown property on a view', () => {
    const d = validDescription()
    d.views[0].script = 'alert(1)'
    expect(appDescriptionSchema.safeParse(d).success).toBe(false)
  })

  it('rejects an overview without sections', () => {
    const d = validDescription()
    d.views = [{ id: 'home', name: 'Hem', type: 'overview', sections: [] }]
    expect(appDescriptionSchema.safeParse(d).success).toBe(false)
  })
})

describe('inputs', () => {
  it.each([
    { id: 'add', name: 'Lägg till', type: 'form', collection: 'items' },
    { id: 'share', name: 'Dela hit', type: 'share', collection: 'items', map: { url: 'url', title: 'title' } },
    { id: 'button', name: 'Spara', type: 'bookmarklet', collection: 'items', map: { url: 'url' } },
  ])('accepts a valid $type input', (input) => {
    const d = validDescription()
    d.inputs = [input]
    expect(appDescriptionSchema.safeParse(d).success).toBe(true)
  })

  it('rejects a share input that maps nothing', () => {
    const d = validDescription()
    d.inputs = [{ id: 'share', name: 'Dela hit', type: 'share', collection: 'items', map: {} }]
    expect(appDescriptionSchema.safeParse(d).success).toBe(false)
  })
})

describe('reminders', () => {
  it('accepts a reminder every Sunday at 18:00', () => {
    const d = validDescription()
    d.reminders = [{ id: 'plan', type: 'weekly', weekday: 'sunday', time: '18:00', message: 'Planera veckan' }]
    expect(appDescriptionSchema.safeParse(d).success).toBe(true)
  })

  it.each([
    { id: 'daily', type: 'daily', time: '07:30', message: 'God morgon' },
    { id: 'before', type: 'beforeDate', collection: 'items', dateField: 'when', daysBefore: 1, time: '17:00', message: 'Imorgon' },
  ])('accepts a valid $type reminder', (reminder) => {
    const d = validDescription()
    d.reminders = [reminder]
    expect(appDescriptionSchema.safeParse(d).success).toBe(true)
  })

  it.each(['25:00', '18:60', '6:00', '18.00'])('rejects the time %j', (time) => {
    const d = validDescription()
    d.reminders = [{ id: 'plan', type: 'weekly', weekday: 'sunday', time, message: 'Planera veckan' }]
    const result = appDescriptionSchema.safeParse(d)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['reminders', 0, 'time'])
  })
})

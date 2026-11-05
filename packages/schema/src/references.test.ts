import { describe, expect, it } from 'vitest'
import { parseAppDescription } from './parse'
import { type Draft, validDescription } from './test-helpers'

function issuePaths(d: Draft) {
  const result = parseAppDescription(d)
  expect(result.success).toBe(false)
  return result.success ? [] : result.issues.map((issue) => issue.path)
}

describe('unique ids', () => {
  it('rejects a duplicated field id within a collection', () => {
    const d = validDescription()
    d.collections[0].fields.push({ id: 'when', label: 'Datum', type: 'date' })
    expect(issuePaths(d)).toEqual([['collections', 0, 'fields', 3, 'id']])
  })

  it('allows the same field id in different collections', () => {
    const d = validDescription()
    d.collections.push({ id: 'other', name: 'Annat', access: 'read', fields: [{ id: 'title', label: 'Titel', type: 'text' }] })
    expect(parseAppDescription(d).success).toBe(true)
  })

  it.each([
    ['collections', (d: Draft) => d.collections.push({ ...d.collections[0] }), ['collections', 1, 'id']],
    ['views', (d: Draft) => d.views.push({ ...d.views[0] }), ['views', 1, 'id']],
    [
      'inputs',
      (d: Draft) => d.inputs.push(
        { id: 'add', name: 'Ny', type: 'form', collection: 'items' },
        { id: 'add', name: 'Ny igen', type: 'form', collection: 'items' },
      ),
      ['inputs', 1, 'id'],
    ],
    [
      'reminders',
      (d: Draft) => d.reminders.push(
        { id: 'r', type: 'daily', time: '08:00', message: 'A' },
        { id: 'r', type: 'daily', time: '09:00', message: 'B' },
      ),
      ['reminders', 1, 'id'],
    ],
    [
      'people',
      (d: Draft) => d.people.others.push({ id: 'ella', name: 'Ella' }, { id: 'ella', name: 'Ella B' }),
      ['people', 'others', 1, 'id'],
    ],
    [
      'choice options',
      (d: Draft) => d.collections[0].fields.push({
        id: 'kind', label: 'Sort', type: 'choice',
        options: [{ value: 'a', label: 'A' }, { value: 'a', label: 'A igen' }],
      }),
      ['collections', 0, 'fields', 3, 'options', 1, 'value'],
    ],
  ])('rejects duplicated %s', (_, change, path) => {
    const d = validDescription()
    change(d)
    expect(issuePaths(d)).toEqual([path])
  })
})

describe('references', () => {
  it('rejects a reference field to a missing collection', () => {
    const d = validDescription()
    d.collections[0].fields.push({ id: 'dish', label: 'Rätt', type: 'reference', collection: 'ratter' })
    expect(issuePaths(d)).toEqual([['collections', 0, 'fields', 3, 'collection']])
  })

  it('rejects a view on a missing collection', () => {
    const d = validDescription()
    d.views[0].collection = 'lankar'
    expect(issuePaths(d)).toEqual([['views', 0, 'collection']])
  })

  it('rejects a view showing a missing field', () => {
    const d = validDescription()
    d.views[0].fields = ['title', 'nope']
    expect(issuePaths(d)).toEqual([['views', 0, 'fields', 1]])
  })

  it('rejects sorting on a missing field', () => {
    const d = validDescription()
    d.views[0].sort = { field: 'nope', direction: 'asc' }
    expect(issuePaths(d)).toEqual([['views', 0, 'sort', 'field']])
  })

  it('rejects a calendar whose date field is a text field', () => {
    const d = validDescription()
    d.views.push({ id: 'week', name: 'Veckan', type: 'calendar', collection: 'items', dateField: 'title', range: 'week' })
    expect(issuePaths(d)).toEqual([['views', 1, 'dateField']])
  })

  it('rejects an overview section on a missing collection', () => {
    const d = validDescription()
    d.views.push({ id: 'home', name: 'Hem', type: 'overview', sections: [{ collection: 'items' }, { collection: 'nope' }] })
    expect(issuePaths(d)).toEqual([['views', 1, 'sections', 1, 'collection']])
  })

  it('rejects an input on a missing collection', () => {
    const d = validDescription()
    d.inputs.push({ id: 'add', name: 'Ny', type: 'form', collection: 'nope' })
    expect(issuePaths(d)).toEqual([['inputs', 0, 'collection']])
  })

  it('rejects a share input sending the address to a date field', () => {
    const d = validDescription()
    d.inputs.push({ id: 'share', name: 'Dela', type: 'share', collection: 'items', map: { url: 'when' } })
    expect(issuePaths(d)).toEqual([['inputs', 0, 'map', 'url']])
  })

  it('rejects a bookmarklet sending the title to a link field', () => {
    const d = validDescription()
    d.inputs.push({ id: 'button', name: 'Spara', type: 'bookmarklet', collection: 'items', map: { title: 'url' } })
    expect(issuePaths(d)).toEqual([['inputs', 0, 'map', 'title']])
  })

  it('rejects a date reminder pointing at a text field', () => {
    const d = validDescription()
    d.reminders.push({ id: 'r', type: 'beforeDate', collection: 'items', dateField: 'title', daysBefore: 1, time: '17:00', message: 'Imorgon' })
    expect(issuePaths(d)).toEqual([['reminders', 0, 'dateField']])
  })

  it('rejects a date reminder on a missing collection', () => {
    const d = validDescription()
    d.reminders.push({ id: 'r', type: 'beforeDate', collection: 'nope', dateField: 'when', daysBefore: 1, time: '17:00', message: 'Imorgon' })
    expect(issuePaths(d)).toEqual([['reminders', 0, 'collection']])
  })
})

describe('parseAppDescription', () => {
  it('returns the description when valid', () => {
    const result = parseAppDescription(validDescription())
    expect(result).toEqual({ success: true, data: validDescription() })
  })

  it('returns issues with paths when invalid', () => {
    const d = validDescription()
    d.collections[0].fields[0].label = ''
    const result = parseAppDescription(d)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.issues[0]?.path).toEqual(['collections', 0, 'fields', 0, 'label'])
  })

  it('points an unknown property issue at the property itself', () => {
    const d = validDescription()
    d.views[0].script = 'alert(1)'
    expect(issuePaths(d)).toEqual([['views', 0, 'script']])
  })

  it('does not crash on non-objects', () => {
    for (const input of [null, undefined, 42, 'app', [], {}]) {
      expect(parseAppDescription(input).success).toBe(false)
    }
  })

  it('does not run reference checks on a broken shape', () => {
    const d = validDescription()
    d.collections = 'nope'
    d.views[0].collection = 'missing'
    expect(issuePaths(d)).toEqual([['collections']])
  })
})

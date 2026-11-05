import { describe, expect, it } from 'vitest'
import { fieldSchema } from './fields'
import { LIMITS } from './primitives'

describe('fieldSchema', () => {
  it.each([
    { id: 'title', label: 'Titel', type: 'text', multiline: true, required: true },
    { id: 'day', label: 'Dag', type: 'date', withTime: false },
    { id: 'photo', label: 'Bild', type: 'image' },
    { id: 'url', label: 'Länk', type: 'link' },
    { id: 'cook', label: 'Vem lagar', type: 'person', multiple: false },
    { id: 'kind', label: 'Sort', type: 'choice', options: [{ value: 'vego', label: 'Vego' }] },
    { id: 'dish', label: 'Rätt', type: 'reference', collection: 'dishes' },
  ])('accepts a valid $type field', (field) => {
    expect(fieldSchema.safeParse(field).success).toBe(true)
  })

  it('rejects a choice field without options', () => {
    const result = fieldSchema.safeParse({ id: 'kind', label: 'Sort', type: 'choice', options: [] })
    expect(result.success).toBe(false)
  })

  it('rejects a label longer than the limit', () => {
    const label = 'x'.repeat(LIMITS.nameLength + 1)
    const result = fieldSchema.safeParse({ id: 'title', label, type: 'text' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['label'])
  })

  it.each(['Måltider', 'Title', '1st', 'with space', '-x', ''])('rejects the invalid id %j', (id) => {
    expect(fieldSchema.safeParse({ id, label: 'Titel', type: 'text' }).success).toBe(false)
  })

  it('rejects an unknown property', () => {
    const result = fieldSchema.safeParse({ id: 'title', label: 'Titel', type: 'text', script: 'alert(1)' })
    expect(result.success).toBe(false)
  })

  it('rejects an unknown field type', () => {
    expect(fieldSchema.safeParse({ id: 'x', label: 'X', type: 'html' }).success).toBe(false)
  })
})

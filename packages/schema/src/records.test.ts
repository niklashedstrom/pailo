import { describe, expect, it } from 'vitest'
import type { Collection } from './collection'
import type { Field } from './fields'
import { RECORD_LIMITS, parseFieldValue, recordDataSchema } from './records'

const MEMBER = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const RECORD = '0b5c3f0e-6d1a-4c55-9f6a-2d1f5e9a8b77'

function collection(...fields: Field[]): Collection {
  return { id: 'things', name: 'Saker', access: 'edit', fields }
}

function accepts(fields: Field[], data: unknown) {
  return recordDataSchema(collection(...fields)).safeParse(data).success
}

const choice = (multiple?: boolean): Field => ({
  id: 'tags',
  label: 'Etiketter',
  type: 'choice',
  multiple,
  options: [
    { value: 'las-senare', label: 'Läs senare' },
    { value: 'recept', label: 'Recept' },
  ],
})

describe('recordDataSchema', () => {
  describe('text', () => {
    const text: Field = { id: 'note', label: 'Anteckning', type: 'text', multiline: true }
    it('accepts text', () => expect(accepts([text], { note: 'Hej\nhopp' })).toBe(true))
    it('rejects blank text', () => expect(accepts([text], { note: '   ' })).toBe(false))
    it('rejects a number', () => expect(accepts([text], { note: 3 })).toBe(false))
    it('rejects text over the limit', () =>
      expect(accepts([text], { note: 'x'.repeat(RECORD_LIMITS.textLength + 1) })).toBe(false))
  })

  describe('date', () => {
    const day: Field = { id: 'day', label: 'Dag', type: 'date' }
    const at: Field = { id: 'at', label: 'När', type: 'date', withTime: true }
    it('accepts a day', () => expect(accepts([day], { day: '2026-11-11' })).toBe(true))
    it('accepts a leap day', () => expect(accepts([day], { day: '2028-02-29' })).toBe(true))
    it.each(['2026-02-30', '2026-13-01', '11/11/2026', '2026-11-11T18:30'])('rejects %j for a day', (value) =>
      expect(accepts([day], { day: value })).toBe(false),
    )
    it('accepts a day with time', () => expect(accepts([at], { at: '2026-11-11T18:30' })).toBe(true))
    it.each(['2026-11-11', '2026-11-11T24:00', '2026-11-11T18:30:00', '2026-11-11T18:30Z'])(
      'rejects %j for a day with time',
      (value) => expect(accepts([at], { at: value })).toBe(false),
    )
  })

  describe('link', () => {
    const link: Field = { id: 'url', label: 'Länk', type: 'link' }
    it.each(['https://pailo.se/a?b=c', 'http://example.com'])('accepts %j', (value) =>
      expect(accepts([link], { url: value })).toBe(true),
    )
    it.each(['javascript:alert(1)', 'data:text/html,hi', 'pailo.se', 'https://', 'mailto:a@b.se'])(
      'rejects %j',
      (value) => expect(accepts([link], { url: value })).toBe(false),
    )
  })

  describe('choice', () => {
    it('accepts one option', () => expect(accepts([choice()], { tags: 'recept' })).toBe(true))
    it('rejects an unknown option', () => expect(accepts([choice()], { tags: 'hemlig' })).toBe(false))
    it('rejects a list when only one is allowed', () =>
      expect(accepts([choice()], { tags: ['recept'] })).toBe(false))
    it('accepts several options when multiple', () =>
      expect(accepts([choice(true)], { tags: ['las-senare', 'recept'] })).toBe(true))
    it('rejects an empty list', () => expect(accepts([choice(true)], { tags: [] })).toBe(false))
    it('rejects duplicates', () => expect(accepts([choice(true)], { tags: ['recept', 'recept'] })).toBe(false))
    it('rejects an unknown option in a list', () =>
      expect(accepts([choice(true)], { tags: ['recept', 'hemlig'] })).toBe(false))
  })

  describe('person', () => {
    const one: Field = { id: 'cook', label: 'Vem lagar', type: 'person' }
    const many: Field = { id: 'who', label: 'Vilka', type: 'person', multiple: true }
    it('accepts a member', () => expect(accepts([one], { cook: { member: MEMBER } })).toBe(true))
    it('accepts a person without an account', () => expect(accepts([one], { cook: { other: 'barn-1' } })).toBe(true))
    it('rejects a bare id', () => expect(accepts([one], { cook: MEMBER })).toBe(false))
    it('rejects both kinds at once', () =>
      expect(accepts([one], { cook: { member: MEMBER, other: 'barn-1' } })).toBe(false))
    it('rejects a member that is not a user id', () => expect(accepts([one], { cook: { member: 'anna' } })).toBe(false))
    it('accepts several when multiple', () =>
      expect(accepts([many], { who: [{ member: MEMBER }, { other: 'barn-1' }] })).toBe(true))
    it('rejects the same person twice', () =>
      expect(accepts([many], { who: [{ other: 'barn-1' }, { other: 'barn-1' }] })).toBe(false))
  })

  describe('reference', () => {
    const ref: Field = { id: 'dish', label: 'Rätt', type: 'reference', collection: 'dishes' }
    it('accepts a record id', () => expect(accepts([ref], { dish: RECORD })).toBe(true))
    it('rejects something else', () => expect(accepts([ref], { dish: 'lasagne' })).toBe(false))
  })

  describe('image', () => {
    const image: Field = { id: 'photo', label: 'Bild', type: 'image', required: true }
    it('is never required, so a form can be saved', () => expect(accepts([image], {})).toBe(true))
    it('accepts no value yet', () => expect(accepts([image], { photo: 'https://x.se/a.png' })).toBe(false))
  })

  describe('the record as a whole', () => {
    const title: Field = { id: 'title', label: 'Titel', type: 'text', required: true }
    const note: Field = { id: 'note', label: 'Anteckning', type: 'text' }
    it('accepts a missing optional field', () => expect(accepts([title, note], { title: 'A' })).toBe(true))
    it('rejects a missing required field', () => expect(accepts([title, note], { note: 'B' })).toBe(false))
    it('rejects an unknown field', () => expect(accepts([title], { title: 'A', pris: '10' })).toBe(false))
    it('rejects null instead of a missing value', () => expect(accepts([title, note], { title: 'A', note: null })).toBe(false))
  })
})

describe('parseFieldValue', () => {
  const day: Field = { id: 'day', label: 'Dag', type: 'date' }
  const person: Field = { id: 'cook', label: 'Vem lagar', type: 'person' }

  it('returns a valid value', () => expect(parseFieldValue(day, '2026-11-11')).toBe('2026-11-11'))
  it('returns undefined for a missing value', () => expect(parseFieldValue(day, undefined)).toBeUndefined())
  it('returns undefined for a broken date', () => expect(parseFieldValue(day, '2026-02-31')).toBeUndefined())
  it('returns undefined for an unknown choice', () => expect(parseFieldValue(choice(), 'hemlig')).toBeUndefined())
  it('returns undefined for the wrong kind of person', () =>
    expect(parseFieldValue(person, [{ member: MEMBER }])).toBeUndefined())
})

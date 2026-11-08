import { describe, expect, it } from 'vitest'
import allBlocks from '../examples/alla-byggstenar.json'
import drop from '../examples/drop.json'
import matschema from '../examples/matschema.json'
import { ACCESS_LEVELS } from './collection'
import type { AppDescription } from './description'
import { fieldSchema } from './fields'
import { parseAppDescription } from './parse'
import { THEME_PRESETS } from './theme'
import { viewSchema } from './views'

// The runtime is tested against this description so that it is proven on the
// building blocks, not tailored to Drop and the meal plan. These tests make
// sure it keeps covering every block as the schema grows.

const typesOf = (union: { options: readonly { shape: { type: { value: string } } }[] }) =>
  union.options.map((option) => option.shape.type.value)

export function coverage(description: AppDescription) {
  const fields = description.collections.flatMap((collection) => collection.fields)
  return {
    fieldTypes: new Set(fields.map((field) => field.type)),
    viewTypes: new Set(description.views.map((view) => view.type)),
    accessLevels: new Set(description.collections.map((collection) => collection.access)),
    variants: new Set(
      fields.flatMap((field) => [
        ...(field.required ? ['required'] : []),
        ...(field.type === 'text' && field.multiline ? ['text.multiline'] : []),
        ...(field.type === 'date' ? [field.withTime ? 'date.withTime' : 'date.dayOnly'] : []),
        ...(field.type === 'choice' ? [field.multiple ? 'choice.multiple' : 'choice.single'] : []),
        ...(field.type === 'person' ? [field.multiple ? 'person.multiple' : 'person.single'] : []),
      ]),
    ),
    calendarRanges: new Set(description.views.flatMap((view) => (view.type === 'calendar' ? [view.range] : []))),
  }
}

function parsed(input: unknown): AppDescription {
  const result = parseAppDescription(input)
  if (!result.success) throw new Error(JSON.stringify(result.issues))
  return result.data
}

describe('alla-byggstenar.json', () => {
  const description = parsed(allBlocks)
  const covered = coverage(description)

  it('validates', () => expect(description.name).toBe('Alla byggstenar'))

  it('uses every field type in the schema', () => {
    expect([...covered.fieldTypes].sort()).toEqual(typesOf(fieldSchema).sort())
  })

  it('uses every view type in the schema', () => {
    expect([...covered.viewTypes].sort()).toEqual(typesOf(viewSchema).sort())
  })

  it('uses every access level', () => {
    expect([...covered.accessLevels].sort()).toEqual([...ACCESS_LEVELS].sort())
  })

  it('uses every field variant and both calendar ranges', () => {
    expect([...covered.variants].sort()).toEqual(
      [
        'required',
        'text.multiline',
        'date.dayOnly',
        'date.withTime',
        'choice.single',
        'choice.multiple',
        'person.single',
        'person.multiple',
      ].sort(),
    )
    expect([...covered.calendarRanges].sort()).toEqual(['month', 'week'])
  })

  it('has a form for every collection, people without an account and every theme option set', () => {
    const formCollections = description.inputs.filter((input) => input.type === 'form').map((input) => input.collection)
    expect(formCollections.sort()).toEqual(description.collections.map((collection) => collection.id).sort())
    expect(description.people.others.length).toBeGreaterThan(0)
    expect(Object.keys(description.theme).sort()).toEqual(
      ['preset', 'palette', 'font', 'spacing', 'radius', 'density'].sort(),
    )
    expect(THEME_PRESETS).toContain(description.theme.preset)
  })

  it('shares no ids with the reference apps, so nothing can be tailored to them', () => {
    const ids = (d: AppDescription) =>
      new Set([
        ...d.collections.flatMap((c) => [c.id, ...c.fields.map((f) => f.id)]),
        ...d.views.map((v) => v.id),
        ...d.inputs.map((i) => i.id),
      ])
    const own = ids(description)
    for (const reference of [parsed(drop), parsed(matschema)]) {
      expect([...ids(reference)].filter((id) => own.has(id))).toEqual([])
    }
  })
})

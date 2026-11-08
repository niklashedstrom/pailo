import type { Field } from '@pailo/schema'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ANNA, allBlocks, appData, mealPlan, record } from '../test-fixtures'
import { FieldValue } from './FieldValue'
import { UNTITLED, displayText, recordTitle, sortRecords } from './values'

const description = allBlocks()
const things = description.collections.find((c) => c.id === 'qx-saker')!
const groups = description.collections.find((c) => c.id === 'qx-grupper')!
const field = (id: string) => things.fields.find((f) => f.id === id)!

describe('displayText', () => {
  const group = record('qx-grupper', { 'g-namn': 'Kören', 'g-start': '2026-09-01' })
  const data = appData(description, [group])

  it.each<[string, unknown, string]>([
    ['f-rubrik', 'Hej', 'Hej'],
    ['f-dag', '2026-11-11', '11 nov. 2026'],
    ['f-tid', '2026-11-11T18:30', '11 nov. 2026 18:30'],
    ['f-adress', 'https://pailo.se', 'https://pailo.se'],
    ['f-niva', 'hog', 'Hög'],
    ['f-markningar', ['rod', 'bla'], 'Röd, Blå'],
    ['f-ansvarig', { member: ANNA }, 'Anna'],
    ['f-ansvarig', { other: 'p-tva' }, 'Ölund'],
    ['f-deltagare', [{ member: ANNA }, { other: 'p-ett' }], 'Anna, Kim'],
    ['f-hor-till', group.id, 'Kören'],
  ])('shows %s = %j as %j', (id, value, text) => {
    expect(displayText(field(id), value, data)).toBe(text)
  })

  it.each<[string, unknown]>([
    ['f-dag', '2026-02-31'],
    ['f-niva', 'okand'],
    ['f-ansvarig', 'bara-ett-id'],
    ['f-ansvarig', { member: '00000000-0000-4000-8000-000000000000' }],
    ['f-hor-till', '00000000-0000-4000-8000-000000000000'],
    ['f-foto', 'https://x.se/a.png'],
    ['f-rubrik', undefined],
  ])('shows a broken or missing %s (%j) as empty', (id, value) => {
    expect(displayText(field(id), value, data)).toBe('')
  })

  it('does not follow a reference into another collection', () => {
    const notAGroup = record('qx-saker', { 'f-rubrik': 'Fel samling' })
    expect(displayText(field('f-hor-till'), notAGroup.id, appData(description, [notAGroup]))).toBe('')
  })
})

describe('recordTitle', () => {
  it('uses the first required text field', () => {
    expect(recordTitle(things, record('qx-saker', { 'f-text': 'lång', 'f-rubrik': 'Rubriken' }))).toBe('Rubriken')
  })

  it('says Namnlös when there is nothing to show', () => {
    expect(recordTitle(things, record('qx-saker', {}))).toBe(UNTITLED)
  })
})

describe('sortRecords', () => {
  const names = ['Örjan', 'anna', 'Åsa', 'Ärla', 'Bo']
  const records = names.map((name) => record('qx-grupper', { 'g-namn': name }))
  const data = appData(description, records)

  it('sorts text the Swedish way', () => {
    const sorted = sortRecords(records, groups, { field: 'g-namn', direction: 'asc' }, data)
    expect(sorted.map((r) => r.data['g-namn'])).toEqual(['anna', 'Bo', 'Åsa', 'Ärla', 'Örjan'])
  })

  it('puts missing values last in both directions', () => {
    const withMissing = [...records, record('qx-grupper', {})]
    for (const direction of ['asc', 'desc'] as const) {
      const sorted = sortRecords(withMissing, groups, { field: 'g-namn', direction }, data)
      expect(sorted.at(-1)?.data['g-namn']).toBeUndefined()
    }
  })

  it('sorts dates by time, not by how they are written', () => {
    const dated = ['2026-11-11T18:30', '2026-11-11T09:05', '2026-10-01T23:00'].map((v) => record('qx-saker', { 'f-tid': v }))
    const sorted = sortRecords(dated, things, { field: 'f-tid', direction: 'asc' }, appData(description, dated))
    expect(sorted.map((r) => r.data['f-tid'])).toEqual(['2026-10-01T23:00', '2026-11-11T09:05', '2026-11-11T18:30'])
  })

  it('shows the newest first without a sort', () => {
    const sorted = sortRecords(records, groups, undefined, data)
    expect(sorted[0]).toBe(records.at(-1))
  })
})

describe('FieldValue', () => {
  const data = appData(mealPlan())
  const link: Field = { id: 'recept', label: 'Recept', type: 'link' }

  it('makes an http address a link that opens safely in a new tab', () => {
    render(<FieldValue field={link} value="https://www.ica.se/recept/lasagne" data={data} />)
    const a = screen.getByRole('link', { name: 'ica.se/recept/lasagne' })
    expect(a).toHaveAttribute('href', 'https://www.ica.se/recept/lasagne')
    expect(a).toHaveAttribute('target', '_blank')
    expect(a).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('shows javascript: as plain text that cannot be clicked', () => {
    const { container } = render(<FieldValue field={link} value="javascript:alert(1)" data={data} />)
    expect(container.querySelector('a')).toBeNull()
    expect(container.textContent).toBe('javascript:alert(1)')
  })

  it('shows text as text, never as HTML', () => {
    const text: Field = { id: 'namn', label: 'Namn', type: 'text' }
    const { container } = render(<FieldValue field={text} value={'<img src=x onerror="alert(1)">'} data={data} />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toBe('<img src=x onerror="alert(1)">')
  })
})

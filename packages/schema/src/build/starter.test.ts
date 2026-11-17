import { describe, expect, it } from 'vitest'
import { applyPatch } from './patch.ts'
import { checkUsableApp, starterDescription } from './starter.ts'

describe('starterDescription', () => {
  it('is not usable on its own', () => {
    expect(checkUsableApp(starterDescription()).usable).toBe(false)
  })

  it('becomes usable with a collection, a view and a form', () => {
    const patched = applyPatch(starterDescription(), [
      { op: 'replace', path: '/name', value: 'Läxor' },
      {
        op: 'add',
        path: '/collections/-',
        value: { id: 'laxor', name: 'Läxor', access: 'edit', fields: [{ id: 'amne', label: 'Ämne', type: 'text' }] },
      },
      { op: 'add', path: '/views/-', value: { id: 'alla', name: 'Alla', type: 'list', collection: 'laxor' } },
      { op: 'add', path: '/inputs/-', value: { id: 'ny', name: 'Ny läxa', type: 'form', collection: 'laxor' } },
    ])
    expect(patched.ok).toBe(true)
    const result = patched.ok ? checkUsableApp(patched.document) : undefined
    expect(result?.usable).toBe(true)
  })

  it('is not usable without a form', () => {
    const patched = applyPatch(starterDescription(), [
      { op: 'add', path: '/collections/-', value: { id: 'a', name: 'A', access: 'edit', fields: [{ id: 'b', label: 'B', type: 'text' }] } },
      { op: 'add', path: '/views/-', value: { id: 'v', name: 'V', type: 'list', collection: 'a' } },
    ])
    const result = patched.ok ? checkUsableApp(patched.document) : undefined
    expect(result).toMatchObject({ usable: false, issues: [{ path: ['inputs'] }] })
  })
})

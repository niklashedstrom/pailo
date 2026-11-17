import { describe, expect, it } from 'vitest'
import { applyPatch, parsePointer } from './patch.ts'

const doc = () => ({ name: 'Drop', list: ['a', 'b', 'c'], nested: { 'a/b': 1, 'm~n': 2 } })

describe('parsePointer', () => {
  it('unescapes ~1 and ~0', () => {
    expect(parsePointer('/nested/a~1b')).toEqual(['nested', 'a/b'])
    expect(parsePointer('/nested/m~0n')).toEqual(['nested', 'm~n'])
    expect(parsePointer('')).toEqual([])
  })
})

describe('applyPatch', () => {
  it('never changes the input', () => {
    const input = doc()
    const result = applyPatch(input, [{ op: 'replace', path: '/name', value: 'Ny' }])
    expect(input.name).toBe('Drop')
    expect(result).toEqual({ ok: true, document: { ...doc(), name: 'Ny' } })
  })

  it('adds to objects, in lists and at the end with -', () => {
    const result = applyPatch(doc(), [
      { op: 'add', path: '/icon', value: 'star' },
      { op: 'add', path: '/list/1', value: 'x' },
      { op: 'add', path: '/list/-', value: 'z' },
    ])
    expect(result.ok && result.document).toMatchObject({ icon: 'star', list: ['a', 'x', 'b', 'c', 'z'] })
  })

  it('removes from objects and lists', () => {
    const result = applyPatch(doc(), [
      { op: 'remove', path: '/list/0' },
      { op: 'remove', path: '/nested/a~1b' },
    ])
    expect(result.ok && result.document).toEqual({ name: 'Drop', list: ['b', 'c'], nested: { 'm~n': 2 } })
  })

  it('replaces only existing values', () => {
    expect(applyPatch(doc(), [{ op: 'replace', path: '/list/2', value: 'C' }])).toMatchObject({
      ok: true,
      document: { list: ['a', 'b', 'C'] },
    })
    expect(applyPatch(doc(), [{ op: 'replace', path: '/missing', value: 1 }]).ok).toBe(false)
  })

  it('moves and copies', () => {
    const moved = applyPatch(doc(), [{ op: 'move', from: '/list/0', path: '/list/-' }])
    expect(moved.ok && moved.document).toMatchObject({ list: ['b', 'c', 'a'] })
    const copied = applyPatch(doc(), [{ op: 'copy', from: '/nested', path: '/copy' }])
    expect(copied.ok && copied.document).toMatchObject({ copy: { 'a/b': 1, 'm~n': 2 } })
  })

  it('copies values so later operations do not change the source', () => {
    const result = applyPatch(doc(), [
      { op: 'copy', from: '/nested', path: '/copy' },
      { op: 'replace', path: '/copy/m~0n', value: 9 },
    ])
    expect(result.ok && result.document).toMatchObject({ nested: { 'm~n': 2 }, copy: { 'm~n': 9 } })
  })

  it('tests by deep equality and stops the patch when a test fails', () => {
    expect(applyPatch(doc(), [{ op: 'test', path: '/nested', value: { 'm~n': 2, 'a/b': 1 } }]).ok).toBe(true)
    const failed = applyPatch(doc(), [
      { op: 'replace', path: '/name', value: 'Ny' },
      { op: 'test', path: '/name', value: 'Drop' },
    ])
    expect(failed).toMatchObject({ ok: false, index: 1 })
  })

  it.each([
    ['a path without a leading slash', { op: 'add', path: 'name', value: 1 }],
    ['a missing parent', { op: 'add', path: '/missing/child', value: 1 }],
    ['a position past the end', { op: 'add', path: '/list/9', value: 1 }],
    ['a position that is not a number', { op: 'remove', path: '/list/first' }],
    ['a leading zero', { op: 'remove', path: '/list/01' }],
    ['removing something missing', { op: 'remove', path: '/missing' }],
    ['removing the whole description', { op: 'remove', path: '' }],
    ['moving into itself', { op: 'move', from: '/nested', path: '/nested/inner' }],
    ['a path through a text value', { op: 'add', path: '/name/x', value: 1 }],
  ] as const)('rejects %s with the operation index', (_, operation) => {
    const result = applyPatch(doc(), [{ op: 'test', path: '/name', value: 'Drop' }, operation])
    expect(result).toMatchObject({ ok: false, index: 1 })
    expect(!result.ok && result.message).toMatch(/^Operation 1 /)
  })

  it('replaces the whole document with an empty path', () => {
    expect(applyPatch(doc(), [{ op: 'replace', path: '', value: { x: 1 } }])).toEqual({ ok: true, document: { x: 1 } })
  })
})

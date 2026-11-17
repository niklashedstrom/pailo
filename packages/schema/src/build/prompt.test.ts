import { describe, expect, it } from 'vitest'
import { buildReplyJsonSchema, buildSystemPrompt, buildUserMessage, readReply } from './prompt.ts'

describe('buildSystemPrompt', () => {
  it('is byte-identical between calls, so it can be cached', () => {
    expect(buildSystemPrompt()).toBe(buildSystemPrompt())
  })

  it('contains the schema, both examples and the rules for the summary', () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toContain('"schemaVersion"')
    expect(prompt).toContain('"name":"Drop"')
    expect(prompt).toContain('"name":"Matschema"')
    expect(prompt).toContain('"not_possible"')
    expect(prompt).toMatchSnapshot()
  })
})

describe('buildUserMessage', () => {
  it('marks the description and the wish as data', () => {
    const message = buildUserMessage({ name: 'Drop' }, 'lägg till ett datum', false)
    expect(message).toContain('<description>\n{"name":"Drop"}\n</description>')
    expect(message).toContain('<wish>\nlägg till ett datum\n</wish>')
  })
})

describe('buildReplyJsonSchema', () => {
  it('closes every object and requires every property', () => {
    const objects: Record<string, unknown>[] = []
    const visit = (node: unknown) => {
      if (typeof node !== 'object' || node === null) return
      const record = node as Record<string, unknown>
      if (record.type === 'object') objects.push(record)
      Object.values(record).forEach(visit)
    }
    visit(buildReplyJsonSchema)
    expect(objects).toHaveLength(3)
    for (const object of objects) {
      expect(object.additionalProperties).toBe(false)
      expect(object.required).toEqual(Object.keys(object.properties as object))
    }
  })
})

describe('readReply', () => {
  const reply = (operations: unknown[], notPossible: unknown[] = []) =>
    JSON.stringify({ summary: ' Klart. ', operations, not_possible: notPossible })

  it('parses values from JSON strings and keeps from only for move and copy', () => {
    const result = readReply(
      reply([
        { op: 'add', path: '/icon', from: null, value_json: '"star"' },
        { op: 'remove', path: '/description', from: null, value_json: null },
        { op: 'move', path: '/views/0', from: '/views/1', value_json: null },
      ]),
    )
    expect(result).toEqual({
      ok: true,
      reply: {
        summary: 'Klart.',
        operations: [
          { op: 'add', path: '/icon', value: 'star' },
          { op: 'remove', path: '/description' },
          { op: 'move', path: '/views/0', from: '/views/1' },
        ],
        notPossible: [],
      },
    })
  })

  it('keeps what is not possible', () => {
    const result = readReply(reply([], [{ wish: 'skicka sms', nearest: null }]))
    expect(result.ok && result.reply.notPossible).toEqual([{ wish: 'skicka sms', nearest: null }])
  })

  it.each([
    ['text that is not JSON', 'Här är din app!'],
    ['a missing property', JSON.stringify({ summary: 'x', operations: [] })],
    ['a value that is not JSON', reply([{ op: 'add', path: '/x', from: null, value_json: '{nope' }])],
    ['an add without a value', reply([{ op: 'add', path: '/x', from: null, value_json: null }])],
    ['a move without from', reply([{ op: 'move', path: '/x', from: null, value_json: null }])],
  ])('rejects %s', (_, text) => {
    expect(readReply(text).ok).toBe(false)
  })
})

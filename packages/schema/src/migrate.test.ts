import { describe, expect, it } from 'vitest'
import { CURRENT_SCHEMA_VERSION } from './description'
import { appDescriptionJsonSchema } from './json-schema'
import { migrateAppDescription } from './migrate'
import { validDescription } from './test-helpers'

describe('migrateAppDescription', () => {
  it('upgrades a v0 description to a valid current one', () => {
    const result = migrateAppDescription({ schemaVersion: 0, name: 'Matschema' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
      expect(result.data.name).toBe('Matschema')
    }
  })

  it('validates a description that is already current', () => {
    expect(migrateAppDescription(validDescription())).toEqual({ success: true, data: validDescription() })
  })

  it('rejects a v0 description that is invalid after upgrading', () => {
    const result = migrateAppDescription({ schemaVersion: 0, name: '' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.issues[0]?.path).toEqual(['name'])
  })

  it.each([
    ['missing', { name: 'Matschema' }],
    ['a string', { schemaVersion: '1', name: 'Matschema' }],
    ['negative', { schemaVersion: -1, name: 'Matschema' }],
    ['fractional', { schemaVersion: 0.5, name: 'Matschema' }],
  ])('rejects a %s schemaVersion', (_, input) => {
    const result = migrateAppDescription(input)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.issues[0]?.path).toEqual(['schemaVersion'])
  })

  it('rejects a future schemaVersion', () => {
    const result = migrateAppDescription({ ...validDescription(), schemaVersion: CURRENT_SCHEMA_VERSION + 1 })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.issues[0]?.path).toEqual(['schemaVersion'])
  })

  it.each([null, 'app', [], 42])('rejects the non-object %j', (input) => {
    expect(migrateAppDescription(input).success).toBe(false)
  })
})

describe('appDescriptionJsonSchema', () => {
  it('describes the description properties', () => {
    const schema = appDescriptionJsonSchema() as { type?: string; properties?: Record<string, unknown> }
    expect(schema.type).toBe('object')
    expect(schema.properties).toHaveProperty('collections')
    expect(schema.properties).toHaveProperty('views')
    expect(schema.properties).toHaveProperty('theme')
  })
})

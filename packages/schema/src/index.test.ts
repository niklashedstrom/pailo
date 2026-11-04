import { describe, expect, it } from 'vitest'
import { appDescriptionSchema } from './index'

describe('appDescriptionSchema', () => {
  it('accepts a minimal description', () => {
    expect(appDescriptionSchema.safeParse({ schemaVersion: 0, name: 'Matschema' }).success).toBe(true)
  })

  it('rejects a description without a name', () => {
    expect(appDescriptionSchema.safeParse({ schemaVersion: 0, name: '' }).success).toBe(false)
  })
})

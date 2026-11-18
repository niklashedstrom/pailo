import { describe, expect, it } from 'vitest'
import { appManifest, faceIconPath, readFace } from './face.ts'

const row = { id: 'a3000000-0000-4000-8000-000000000001', name: 'Matschema', icon: 'food', theme: { preset: 'playful', palette: 'berry' } }

describe('readFace', () => {
  it('reads a face from a database row', () => {
    expect(readFace(row)).toEqual(row)
  })

  it('falls back on an unknown icon or theme instead of passing it on', () => {
    expect(readFace({ ...row, icon: '<script>', theme: { preset: 'x', css: 'red' } })).toMatchObject({
      icon: 'star',
      theme: { preset: 'calm' },
    })
    expect(readFace({ ...row, icon: null, theme: null })).toMatchObject({ icon: 'star', theme: { preset: 'calm' } })
  })

  it('is null for something that is not a face', () => {
    expect(readFace(null)).toBeNull()
    expect(readFace({ name: 'Utan id' })).toBeNull()
    expect(readFace({ ...row, name: '  ' })).toBeNull()
  })
})

describe('appManifest', () => {
  const face = readFace(row)!

  it('installs the app at its own address with its name, icon and colour', () => {
    expect(appManifest('matschema-k3f9qa', face)).toEqual({
      id: '/a/matschema-k3f9qa/',
      name: 'Matschema',
      short_name: 'Matschema',
      lang: 'sv',
      start_url: '/a/matschema-k3f9qa/',
      scope: '/a/matschema-k3f9qa/',
      display: 'standalone',
      theme_color: '#8a2c66',
      background_color: '#f8f2f6',
      icons: [
        { src: '/icons/food-berry-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/food-berry-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      ],
    })
  })

  it("uses the preset's palette when the theme names none", () => {
    expect(faceIconPath({ icon: 'food', theme: { preset: 'strict' } }, 192)).toBe('/icons/food-slate-192.png')
  })

  it('shortens a long name for the home screen', () => {
    expect(appManifest('x-abc123', { ...face, name: 'Familjens veckoplanering' }).short_name).toBe('Familjens ve')
  })

  it('refuses something that is not a short name', () => {
    expect(() => appManifest('../admin', face)).toThrow()
  })
})

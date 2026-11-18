import { mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ICONS, PALETTES } from '@pailo/schema'
import { describe, expect, it } from 'vitest'
import { LUCIDE, iconSvg, lucideShapes, renderAll } from './render-icons'

describe('render-icons', () => {
  it('has a drawing for every icon name in the schema', () => {
    expect(Object.keys(LUCIDE).sort()).toEqual([...ICONS].sort())
  })

  it('draws every icon in every palette at 192 and 512 pixels, with the licence', () => {
    const out = mkdtempSync(join(tmpdir(), 'pailo-icons-'))
    const written = renderAll(out)
    expect(written).toHaveLength(ICONS.length * PALETTES.length * 2)
    expect(written).toContain('food-berry-192.png')
    expect(readdirSync(out)).toContain('LICENSE-lucide.txt')
    const png = readFileSync(join(out, 'food-berry-512.png'))
    expect(png.subarray(1, 4).toString()).toBe('PNG')
    // Width and height sit in the IHDR chunk, big-endian, at bytes 16 and 20.
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([512, 512])
  }, 60_000)

  it('keeps only the drawing from a Lucide file', () => {
    expect(lucideShapes('<!-- x --><svg a="b">\n  <path d="M1 1" />\n</svg>')).toBe('<path d="M1 1" />')
    expect(() => lucideShapes('<html>')).toThrow()
  })

  it('puts the drawing on the accent colour', () => {
    expect(iconSvg('<path/>', '#8a2c66', '#ffffff')).toContain('<rect width="24" height="24" fill="#8a2c66"/>')
  })
})

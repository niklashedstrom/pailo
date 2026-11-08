import { PALETTES, THEME_PRESETS } from '@pailo/schema'
import { describe, expect, it } from 'vitest'
import { contrast } from './contrast'
import { PALETTE_TOKENS, PRESETS, type PaletteTokens, resolveTheme, themeVariables } from './tokens'

const AA_TEXT = 4.5

/** Every text/background pair the app CSS uses, all as normal-size text. */
function pairs(p: PaletteTokens): [string, string, string][] {
  return [
    ['text on background', p.text, p.bg],
    ['text on surface', p.text, p.surface],
    ['muted text on background', p.muted, p.bg],
    ['muted text on surface', p.muted, p.surface],
    ['accent (links) on background', p.accent, p.bg],
    ['accent (links) on surface', p.accent, p.surface],
    ['text on accent buttons', p.onAccent, p.accent],
  ]
}

export function failingPairs(p: PaletteTokens): string[] {
  return pairs(p)
    .filter(([, fg, bg]) => contrast(fg, bg) < AA_TEXT)
    .map(([name, fg, bg]) => `${name}: ${contrast(fg, bg).toFixed(2)}`)
}

describe('palette contrast (WCAG AA)', () => {
  it('has tokens for every palette in the schema', () => {
    expect(Object.keys(PALETTE_TOKENS).sort()).toEqual([...PALETTES].sort())
  })

  it.each([...PALETTES])('%s reaches AA for every text pair', (name) => {
    expect(failingPairs(PALETTE_TOKENS[name])).toEqual([])
  })

  it('catches a palette that is too light', () => {
    expect(failingPairs({ ...PALETTE_TOKENS.sage, muted: '#a7b0a9' })).toEqual([
      expect.stringContaining('muted text on background'),
      expect.stringContaining('muted text on surface'),
    ])
  })

  it('computes known ratios', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2)
  })
})

describe('resolveTheme', () => {
  it('has defaults for every preset', () => {
    expect(Object.keys(PRESETS).sort()).toEqual([...THEME_PRESETS].sort())
  })

  it("uses the preset's defaults when nothing else is chosen", () => {
    expect(resolveTheme({ preset: 'strict' })).toEqual({ preset: 'strict', ...PRESETS.strict })
  })

  it("lets the description's choices replace the defaults", () => {
    expect(resolveTheme({ preset: 'playful', palette: 'sage', radius: 'none' })).toEqual({
      ...PRESETS.playful,
      preset: 'playful',
      palette: 'sage',
      radius: 'none',
    })
  })

  it('turns a theme into CSS variables from the fixed tables only', () => {
    const vars = themeVariables({ preset: 'playful', palette: 'sage', font: 'rounded', radius: 'large' })
    expect(vars['--app-bg']).toBe(PALETTE_TOKENS.sage.bg)
    expect(vars['--app-radius']).toBe('18px')
    expect(Object.keys(vars).every((key) => key.startsWith('--app-'))).toBe(true)
  })
})

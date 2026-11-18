// The colours behind each palette name and the defaults of each preset.
// They live with the schema so that both the runtime and the server (the
// install manifest per app) map names to colours the same way. Nothing from
// a description is ever copied into CSS; only these constants are.
// Each palette is checked for WCAG AA contrast in the runtime's tokens.test.ts.
import type { PALETTES, THEME_PRESETS, Theme } from './theme.ts'

type Palette = (typeof PALETTES)[number]
type Preset = (typeof THEME_PRESETS)[number]

export interface PaletteTokens {
  bg: string
  surface: string
  text: string
  muted: string
  border: string
  /** Buttons, links and today's marker. */
  accent: string
  /** Text on accent-coloured buttons. */
  onAccent: string
}

export const PALETTE_TOKENS: Record<Palette, PaletteTokens> = {
  sage: { bg: '#f4f6f1', surface: '#ffffff', text: '#1f2a22', muted: '#4d5c51', border: '#cfd8cc', accent: '#2f6b45', onAccent: '#ffffff' },
  ocean: { bg: '#f1f5f9', surface: '#ffffff', text: '#14232f', muted: '#4a5a68', border: '#cdd8e2', accent: '#1d5f8a', onAccent: '#ffffff' },
  sunset: { bg: '#fbf4ef', surface: '#ffffff', text: '#2d1d16', muted: '#6a4f43', border: '#ead3c5', accent: '#a8431a', onAccent: '#ffffff' },
  berry: { bg: '#f8f2f6', surface: '#ffffff', text: '#2a1724', muted: '#644a5b', border: '#e5cfdd', accent: '#8a2c66', onAccent: '#ffffff' },
  sand: { bg: '#f8f4ea', surface: '#fffdf8', text: '#2b261b', muted: '#5f5745', border: '#e2d8c0', accent: '#735410', onAccent: '#ffffff' },
  slate: { bg: '#f2f3f5', surface: '#ffffff', text: '#1b1f24', muted: '#515a65', border: '#d3d8de', accent: '#334155', onAccent: '#ffffff' },
}

export const PRESETS: Record<Preset, Required<Omit<Theme, 'preset'>>> = {
  calm: { palette: 'sage', font: 'modern', spacing: 'airy', radius: 'medium', density: 'comfortable' },
  playful: { palette: 'sunset', font: 'rounded', spacing: 'normal', radius: 'large', density: 'comfortable' },
  strict: { palette: 'slate', font: 'modern', spacing: 'tight', radius: 'small', density: 'compact' },
}


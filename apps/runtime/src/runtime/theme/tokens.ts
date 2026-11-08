import type { DENSITIES, FONTS, PALETTES, RADII, SPACINGS, THEME_PRESETS, Theme } from '@pailo/schema'

// The only place theme names from a description become visual values. Every
// value is a constant here; nothing from the description is ever copied into
// CSS. Each palette is checked for WCAG AA contrast in tokens.test.ts.

type Palette = (typeof PALETTES)[number]
type Font = (typeof FONTS)[number]
type Spacing = (typeof SPACINGS)[number]
type Radius = (typeof RADII)[number]
type Density = (typeof DENSITIES)[number]
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

/** System fonts only: fast, works offline, and sends visitors to no third party. */
export const FONT_TOKENS: Record<Font, string> = {
  rounded: "ui-rounded, 'SF Pro Rounded', 'Arial Rounded MT Bold', system-ui, sans-serif",
  classic: "'Iowan Old Style', Georgia, 'Times New Roman', serif",
  modern: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
}

/** Space between items. */
export const SPACING_TOKENS: Record<Spacing, string> = { tight: '0.5rem', normal: '0.875rem', airy: '1.25rem' }

export const RADIUS_TOKENS: Record<Radius, string> = { none: '0', small: '4px', medium: '10px', large: '18px' }

/** Padding inside items and line height. */
export const DENSITY_TOKENS: Record<Density, { pad: string; line: string }> = {
  compact: { pad: '0.5rem 0.75rem', line: '1.35' },
  comfortable: { pad: '0.875rem 1rem', line: '1.55' },
}

export const PRESETS: Record<Preset, Required<Omit<Theme, 'preset'>>> = {
  calm: { palette: 'sage', font: 'modern', spacing: 'airy', radius: 'medium', density: 'comfortable' },
  playful: { palette: 'sunset', font: 'rounded', spacing: 'normal', radius: 'large', density: 'comfortable' },
  strict: { palette: 'slate', font: 'modern', spacing: 'tight', radius: 'small', density: 'compact' },
}

/** The preset's defaults with the description's own choices on top. */
export function resolveTheme(theme: Theme): Required<Theme> {
  const defaults = PRESETS[theme.preset]
  return {
    preset: theme.preset,
    palette: theme.palette ?? defaults.palette,
    font: theme.font ?? defaults.font,
    spacing: theme.spacing ?? defaults.spacing,
    radius: theme.radius ?? defaults.radius,
    density: theme.density ?? defaults.density,
  }
}

/** CSS custom properties for the app's outermost element; app CSS reads only these. */
export function themeVariables(theme: Theme): Record<`--app-${string}`, string> {
  const resolved = resolveTheme(theme)
  const palette = PALETTE_TOKENS[resolved.palette]
  const density = DENSITY_TOKENS[resolved.density]
  return {
    '--app-bg': palette.bg,
    '--app-surface': palette.surface,
    '--app-text': palette.text,
    '--app-muted': palette.muted,
    '--app-border': palette.border,
    '--app-accent': palette.accent,
    '--app-on-accent': palette.onAccent,
    '--app-font': FONT_TOKENS[resolved.font],
    '--app-gap': SPACING_TOKENS[resolved.spacing],
    '--app-radius': RADIUS_TOKENS[resolved.radius],
    '--app-pad': density.pad,
    '--app-line': density.line,
  }
}

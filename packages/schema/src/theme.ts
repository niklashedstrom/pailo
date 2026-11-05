import { z } from 'zod'

// Every visual value is a name from a fixed list. The runtime maps names to
// design tokens; free colours, font names or CSS are never accepted.

export const ICONS = [
  'bookmark', 'book', 'calendar', 'cart', 'check', 'clock', 'food', 'gift',
  'heart', 'home', 'image', 'link', 'list', 'money', 'note', 'people', 'star', 'tools',
] as const
export const THEME_PRESETS = ['calm', 'playful', 'strict'] as const
export const PALETTES = ['sage', 'ocean', 'sunset', 'berry', 'sand', 'slate'] as const
export const FONTS = ['rounded', 'classic', 'modern'] as const
export const SPACINGS = ['tight', 'normal', 'airy'] as const
export const RADII = ['none', 'small', 'medium', 'large'] as const
export const DENSITIES = ['compact', 'comfortable'] as const

export const iconSchema = z.enum(ICONS)

export const themeSchema = z.strictObject({
  preset: z.enum(THEME_PRESETS),
  palette: z.enum(PALETTES).optional(),
  font: z.enum(FONTS).optional(),
  spacing: z.enum(SPACINGS).optional(),
  radius: z.enum(RADII).optional(),
  density: z.enum(DENSITIES).optional(),
})

export type Theme = z.infer<typeof themeSchema>
export type IconName = z.infer<typeof iconSchema>

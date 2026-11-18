// The app's face: what anyone may see of an app without signing in (name,
// icon and theme), and the install manifest built from it. Values come from
// the database, so they are read defensively: anything unknown falls back to
// a neutral default instead of reaching a page or a manifest.
import { PALETTE_TOKENS, PRESETS } from './theme-tokens.ts'
import { type IconName, iconSchema, type Theme, themeSchema } from './theme.ts'

export interface AppFace {
  id: string
  name: string
  icon: IconName
  theme: Theme
}

const FALLBACK_ICON: IconName = 'star'
const FALLBACK_THEME: Theme = { preset: 'calm' }

/** A face from untrusted input (a database row or a response), or null when it is not one. */
export function readFace(value: unknown): AppFace | null {
  if (typeof value !== 'object' || value === null) return null
  const row = value as Record<string, unknown>
  if (typeof row.id !== 'string' || typeof row.name !== 'string' || row.name.trim() === '') return null
  const icon = iconSchema.safeParse(row.icon)
  const theme = themeSchema.safeParse(row.theme)
  return {
    id: row.id,
    name: row.name.trim().slice(0, 80),
    icon: icon.success ? icon.data : FALLBACK_ICON,
    theme: theme.success ? theme.data : FALLBACK_THEME,
  }
}

/** The palette a theme ends up with, after the preset's default. */
export function facePalette(theme: Theme) {
  return theme.palette ?? PRESETS[theme.preset].palette
}

/** Where the install icons for a face live; drawn at build time (scripts/src/render-icons.ts). */
export function faceIconPath(face: Pick<AppFace, 'icon' | 'theme'>, size: 192 | 512): string {
  return `/icons/${face.icon}-${facePalette(face.theme)}-${size}.png`
}

/** The short name in an address: lowercase letters, digits and single dashes. */
export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** The web app manifest that installs the app at /a/<slug>/ with its own name, icon and colour. */
export function appManifest(slug: string, face: AppFace) {
  if (!SLUG.test(slug)) throw new Error(`Not a short name: ${slug}`)
  const palette = PALETTE_TOKENS[facePalette(face.theme)]
  const scope = `/a/${slug}/`
  return {
    id: scope,
    name: face.name,
    short_name: face.name.length > 12 ? face.name.slice(0, 12).trimEnd() : face.name,
    lang: 'sv',
    start_url: scope,
    scope,
    display: 'standalone',
    theme_color: palette.accent,
    background_color: palette.bg,
    icons: ([192, 512] as const).map((size) => ({
      src: faceIconPath(face, size),
      sizes: `${size}x${size}`,
      type: 'image/png',
      purpose: 'any',
    })),
  }
}

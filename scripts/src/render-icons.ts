// Draws the install icons for every app: each icon name in the schema, white
// on each palette's accent colour, at 192 and 512 pixels, as PNG. Runs before
// the runtime is built (npm run build) into apps/runtime/public/icons/, which
// git ignores. The manifest per app (supabase/functions/app-manifest) points
// at these files by name, see faceIconPath in packages/schema/src/face.ts.
//
// The drawings are Lucide's (lucide-static, ISC licence); the licence text is
// written next to the icons.
//
//   npm run icons -w @pailo/scripts

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { ICONS, type IconName, PALETTE_TOKENS, PALETTES } from '@pailo/schema'
import { Resvg } from '@resvg/resvg-js'

const require = createRequire(import.meta.url)
const LUCIDE_DIR = dirname(require.resolve('lucide-static/package.json'))
const OUT = new URL('../../apps/runtime/public/icons/', import.meta.url).pathname

export const SIZES = [192, 512] as const

/** Which Lucide drawing each icon name in the schema uses. */
export const LUCIDE: Record<IconName, string> = {
  bookmark: 'bookmark',
  book: 'book',
  calendar: 'calendar',
  cart: 'shopping-cart',
  check: 'check',
  clock: 'clock',
  food: 'utensils',
  gift: 'gift',
  heart: 'heart',
  home: 'house',
  image: 'image',
  link: 'link',
  list: 'list',
  money: 'wallet',
  note: 'sticky-note',
  people: 'users',
  star: 'star',
  tools: 'wrench',
}

/** The drawing inside a Lucide SVG file, without its <svg> wrapper. */
export function lucideShapes(svg: string): string {
  const match = /<svg[^>]*>([\s\S]*)<\/svg>/.exec(svg)
  if (!match) throw new Error('Not an SVG file')
  return match[1].trim()
}

/** A square icon: the drawing in white-ish on the accent colour, with room around it. */
export function iconSvg(shapes: string, background: string, foreground: string): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">',
    `<rect width="24" height="24" fill="${background}"/>`,
    `<g transform="translate(5.4 5.4) scale(0.55)" fill="none" stroke="${foreground}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`,
    shapes,
    '</g></svg>',
  ].join('')
}

export function renderPng(svg: string, size: number): Buffer {
  // No text in the icons, so no fonts: loading the system's fonts takes seconds per icon.
  return new Resvg(svg, { fitTo: { mode: 'width', value: size }, font: { loadSystemFonts: false } }).render().asPng()
}

/** Writes every icon in every palette and size to `out`; returns the file names. */
export function renderAll(out = OUT): string[] {
  mkdirSync(out, { recursive: true })
  const written: string[] = []
  for (const icon of ICONS) {
    const shapes = lucideShapes(readFileSync(join(LUCIDE_DIR, 'icons', `${LUCIDE[icon]}.svg`), 'utf8'))
    for (const palette of PALETTES) {
      const colours = PALETTE_TOKENS[palette]
      const svg = iconSvg(shapes, colours.accent, colours.onAccent)
      for (const size of SIZES) {
        const name = `${icon}-${palette}-${size}.png`
        writeFileSync(join(out, name), renderPng(svg, size))
        written.push(name)
      }
    }
  }
  writeFileSync(join(out, 'LICENSE-lucide.txt'), readFileSync(join(LUCIDE_DIR, 'LICENSE'), 'utf8'))
  return written
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const written = renderAll()
  console.log(`Drew ${written.length} icons in ${OUT}`)
}

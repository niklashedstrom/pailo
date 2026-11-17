import type { ExportedApp } from '../api'

/** The empty data block in standalone.html that a download fills in. */
export const DATA_BLOCK = '<script type="application/json" id="pailo-data"></script>'

/**
 * JSON that is safe inside a <script> element: nothing in a record can end
 * the element ("</script>") or start a comment, whatever people typed.
 */
export function scriptSafeJson(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll(' ', '\\u2028')
    .replaceAll(' ', '\\u2029')
}

const escapeHtml = (text: string) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

/** The standalone file: the built template with the app, its records and members inside. */
export function assembleStandalone(template: string, app: ExportedApp): string {
  const first = template.indexOf(DATA_BLOCK)
  if (first === -1 || template.indexOf(DATA_BLOCK, first + 1) !== -1) {
    throw new Error('The standalone template must have exactly one data block')
  }
  const filled = `<script type="application/json" id="pailo-data">${scriptSafeJson(app)}</script>`
  return (template.slice(0, first) + filled + template.slice(first + DATA_BLOCK.length)).replace(
    /<title>[^<]*<\/title>/,
    `<title>${escapeHtml(app.name)}</title>`,
  )
}

/** A file name from the app's name: letters, digits, spaces and dashes only. */
export function fileName(name: string): string {
  const safe = name
    .normalize('NFC')
    .replace(/[^\p{L}\p{N} -]+/gu, '')
    .trim()
    .slice(0, 60)
  return `${safe || 'App'}.html`
}

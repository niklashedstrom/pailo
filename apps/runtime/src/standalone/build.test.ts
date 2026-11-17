// @vitest-environment node
// Builds the standalone page exactly as `npm run build` does, into a
// temporary folder, and checks what a downloaded app is made of.
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'vite'
import { beforeAll, describe, expect, it } from 'vitest'
import { STANDALONE_CSP } from '../../vite.standalone.config'
import { DATA_BLOCK } from './assemble'

const root = new URL('../../', import.meta.url).pathname
let outDir = ''
let html = ''

beforeAll(async () => {
  outDir = mkdtempSync(join(tmpdir(), 'pailo-standalone-'))
  await build({
    root,
    configFile: join(root, 'vite.standalone.config.ts'),
    logLevel: 'silent',
    build: { outDir, emptyOutDir: true },
  })
  html = readFileSync(join(outDir, 'standalone.html'), 'utf8')
}, 120_000)

describe('the standalone page', () => {
  it('is one html file with everything inside', () => {
    expect(readdirSync(outDir).filter((name) => !name.startsWith('.'))).toEqual(['standalone.html'])
    // Look at the page itself, not at the code inlined in its scripts.
    const page = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, (tag) => tag.slice(0, tag.indexOf('>') + 1))
    expect(page).not.toMatch(/<script[^>]+src=/)
    expect(page).not.toMatch(/<link\b/)
    expect(page).toMatch(/<style\b/)
  })

  it('has the empty data block a download fills in, exactly once', () => {
    expect(html.split(DATA_BLOCK)).toHaveLength(2)
  })

  it('may not reach any server', () => {
    expect(html).toContain(`<meta http-equiv="Content-Security-Policy" content="${STANDALONE_CSP}" />`)
    expect(STANDALONE_CSP).toMatch(/default-src 'none'/)
    expect(STANDALONE_CSP).not.toMatch(/connect-src/)
  })

  it('carries no address or key of Pailo\'s servers', () => {
    expect(html).not.toMatch(/supabase/i)
    expect(html).not.toMatch(/pailo\.se/)
    expect(html).not.toMatch(/functions\/v1/)
    expect(html).not.toMatch(/sb_publishable_|service_role|eyJhbGci/)
  })
})

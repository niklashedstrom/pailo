import { describe, expect, it } from 'vitest'
import type { ExportedApp } from '../api'
import { DATA_BLOCK, assembleStandalone, fileName, scriptSafeJson } from './assemble'

const app: ExportedApp = {
  appId: 'a-1',
  name: 'Matschema <3',
  description: { name: 'Matschema <3' },
  records: [{ id: 'r1', data: { namn: '</script><script>alert(1)</script>' } }],
  members: [{ id: 'anna', displayName: 'Anna', owner: true }],
  me: 'anna',
  exportedAt: '2026-11-18T08:00:00Z',
}

const template = `<!doctype html><html><head><title>App</title></head><body>${DATA_BLOCK}<script>run()</script></body></html>`

describe('assembleStandalone', () => {
  it('puts the app inside the data block, where a record cannot end the script element', () => {
    const file = assembleStandalone(template, app)
    expect(file).not.toContain('</script><script>alert(1)')
    expect(file.match(/<\/script>/g)).toHaveLength(2)
    const json = /id="pailo-data">(.*?)<\/script>/.exec(file)![1]
    expect(JSON.parse(json)).toEqual(app)
  })

  it('names the page after the app, escaped', () => {
    expect(assembleStandalone(template, app)).toContain('<title>Matschema &lt;3</title>')
  })

  it('refuses a template without exactly one data block', () => {
    expect(() => assembleStandalone('<html></html>', app)).toThrow()
    expect(() => assembleStandalone(DATA_BLOCK + DATA_BLOCK, app)).toThrow()
  })
})

describe('scriptSafeJson', () => {
  it('writes < as \\u003c', () => {
    expect(scriptSafeJson({ a: '<b>' })).toBe('{"a":"\\u003cb\\u003e"}')
  })
})

describe('fileName', () => {
  it.each([
    ['Matschema', 'Matschema.html'],
    ['Veckans mat: 2026/47', 'Veckans mat 202647.html'],
    ['../../etc', 'etc.html'],
    ['!!!', 'App.html'],
  ])('%s', (name, file) => expect(fileName(name)).toBe(file))
})

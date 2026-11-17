/**
 * JSON Patch (RFC 6902) for app descriptions. The input is never changed:
 * the patch is applied to a deep copy, and the first failing operation stops
 * the whole patch.
 */

export type PatchOperation =
  | { op: 'add' | 'replace' | 'test'; path: string; value: unknown }
  | { op: 'remove'; path: string }
  | { op: 'move' | 'copy'; path: string; from: string }

export type PatchResult = { ok: true; document: unknown } | { ok: false; index: number; message: string }

type Container = Record<string, unknown> | unknown[]

class PatchError extends Error {}

/** Descriptions are plain JSON, so a JSON round trip is a full copy. */
function clone<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T)
}

/** Splits a JSON Pointer into unescaped tokens. "" is the whole document. */
export function parsePointer(pointer: string): string[] {
  if (pointer === '') return []
  if (!pointer.startsWith('/')) throw new PatchError(`Path "${pointer}" must start with "/"`)
  return pointer
    .slice(1)
    .split('/')
    .map((token) => token.replaceAll('~1', '/').replaceAll('~0', '~'))
}

function isContainer(value: unknown): value is Container {
  return typeof value === 'object' && value !== null
}

function arrayIndex(array: unknown[], token: string, allowEnd: boolean): number {
  if (allowEnd && token === '-') return array.length
  if (!/^(0|[1-9][0-9]*)$/.test(token)) throw new PatchError(`"${token}" is not a list position`)
  const index = Number(token)
  const max = allowEnd ? array.length : array.length - 1
  if (index > max) throw new PatchError(`Position ${index} is outside the list (length ${array.length})`)
  return index
}

function has(container: Container, token: string): boolean {
  return Object.hasOwn(container, token)
}

/** The container holding the last token, and that token. */
function locate(document: unknown, tokens: string[]): { parent: Container; key: string } {
  let current = document
  for (const token of tokens.slice(0, -1)) {
    if (!isContainer(current)) throw new PatchError(`Path goes through a value that is not an object or list`)
    if (Array.isArray(current)) current = current[arrayIndex(current, token, false)]
    else if (has(current, token)) current = current[token]
    else throw new PatchError(`"${token}" does not exist`)
  }
  if (!isContainer(current)) throw new PatchError(`Path goes through a value that is not an object or list`)
  return { parent: current, key: tokens[tokens.length - 1] }
}

function get(document: unknown, pointer: string): unknown {
  const tokens = parsePointer(pointer)
  if (tokens.length === 0) return document
  const { parent, key } = locate(document, tokens)
  if (Array.isArray(parent)) return parent[arrayIndex(parent, key, false)]
  if (!has(parent, key)) throw new PatchError(`"${key}" does not exist`)
  return parent[key]
}

function add(document: unknown, pointer: string, value: unknown): unknown {
  const tokens = parsePointer(pointer)
  if (tokens.length === 0) return value
  const { parent, key } = locate(document, tokens)
  if (Array.isArray(parent)) parent.splice(arrayIndex(parent, key, true), 0, value)
  else parent[key] = value
  return document
}

function remove(document: unknown, pointer: string): unknown {
  const tokens = parsePointer(pointer)
  if (tokens.length === 0) throw new PatchError('The whole description cannot be removed')
  const { parent, key } = locate(document, tokens)
  if (Array.isArray(parent)) parent.splice(arrayIndex(parent, key, false), 1)
  else if (has(parent, key)) delete parent[key]
  else throw new PatchError(`"${key}" does not exist`)
  return document
}

function replace(document: unknown, pointer: string, value: unknown): unknown {
  get(document, pointer)
  const tokens = parsePointer(pointer)
  if (tokens.length === 0) return value
  const { parent, key } = locate(document, tokens)
  if (Array.isArray(parent)) parent[arrayIndex(parent, key, false)] = value
  else parent[key] = value
  return document
}

function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((item, i) => equal(item, b[i]))
  if (isContainer(a) && isContainer(b) && !Array.isArray(a) && !Array.isArray(b)) {
    const keys = Object.keys(a)
    return keys.length === Object.keys(b).length && keys.every((key) => has(b, key) && equal(a[key], b[key]))
  }
  return false
}

function apply(document: unknown, operation: PatchOperation): unknown {
  switch (operation.op) {
    case 'add':
      return add(document, operation.path, clone(operation.value))
    case 'remove':
      return remove(document, operation.path)
    case 'replace':
      return replace(document, operation.path, clone(operation.value))
    case 'move': {
      if (operation.path.startsWith(`${operation.from}/`)) throw new PatchError('Cannot move a value into itself')
      const value = get(document, operation.from)
      return add(remove(document, operation.from), operation.path, value)
    }
    case 'copy':
      return add(document, operation.path, clone(get(document, operation.from)))
    case 'test':
      if (!equal(get(document, operation.path), operation.value)) throw new PatchError(`Test failed at "${operation.path}"`)
      return document
    default: {
      const unknown: never = operation
      throw new PatchError(`Unknown operation ${JSON.stringify(unknown)}`)
    }
  }
}

/** Applies every operation in order to a copy of the document. */
export function applyPatch(document: unknown, operations: PatchOperation[]): PatchResult {
  let current = clone(document)
  for (const [index, operation] of operations.entries()) {
    try {
      current = apply(current, operation)
    } catch (error) {
      if (!(error instanceof PatchError)) throw error
      return { ok: false, index, message: `Operation ${index} (${operation.op} ${operation.path}): ${error.message}` }
    }
  }
  return { ok: true, document: current }
}

import type { z } from 'zod'
import type { Collection } from './collection'
import type { FieldType } from './fields'
import type { Input } from './inputs'
import type { Reminder } from './reminders'
import type { View } from './views'

type Path = (string | number)[]
type Ctx = z.RefinementCtx
type Shape = {
  collections: Collection[]
  views: View[]
  inputs: Input[]
  reminders: Reminder[]
  people: { others: { id: string }[] }
}

function checkUnique(ctx: Ctx, values: string[], path: (index: number) => Path, what: string) {
  const seen = new Set<string>()
  values.forEach((value, index) => {
    if (seen.has(value)) {
      ctx.addIssue({ code: 'custom', message: `Duplicate ${what} "${value}"`, path: path(index) })
    }
    seen.add(value)
  })
}

/**
 * Cross-reference rules that the shape alone cannot express: unique ids, and
 * that views, inputs, reminders and reference fields point to collections and
 * fields that exist and have the right type. Every issue gets an exact path.
 */
export function checkReferences(d: Shape, ctx: Ctx) {
  const ids = (items: { id: string }[]) => items.map((item) => item.id)

  // Unique ids
  checkUnique(ctx, ids(d.collections), (i) => ['collections', i, 'id'], 'collection id')
  checkUnique(ctx, ids(d.views), (i) => ['views', i, 'id'], 'view id')
  checkUnique(ctx, ids(d.inputs), (i) => ['inputs', i, 'id'], 'input id')
  checkUnique(ctx, ids(d.reminders), (i) => ['reminders', i, 'id'], 'reminder id')
  checkUnique(ctx, ids(d.people.others), (i) => ['people', 'others', i, 'id'], 'person id')
  d.collections.forEach((collection, c) => {
    checkUnique(ctx, ids(collection.fields), (f) => ['collections', c, 'fields', f, 'id'], 'field id')
    collection.fields.forEach((field, f) => {
      if (field.type === 'choice') {
        checkUnique(
          ctx,
          field.options.map((option) => option.value),
          (o) => ['collections', c, 'fields', f, 'options', o, 'value'],
          'option value',
        )
      }
    })
  })

  const byId = new Map(d.collections.map((collection) => [collection.id, collection]))

  const collectionAt = (id: string, path: Path): Collection | undefined => {
    const collection = byId.get(id)
    if (!collection) ctx.addIssue({ code: 'custom', message: `Unknown collection "${id}"`, path })
    return collection
  }

  const fieldAt = (collection: Collection | undefined, id: string, path: Path, types?: FieldType[]) => {
    if (!collection) return
    const field = collection.fields.find((candidate) => candidate.id === id)
    if (!field) {
      ctx.addIssue({ code: 'custom', message: `Unknown field "${id}" in collection "${collection.id}"`, path })
    } else if (types && !types.includes(field.type)) {
      ctx.addIssue({
        code: 'custom',
        message: `Field "${id}" must be of type ${types.join(' or ')}, not ${field.type}`,
        path,
      })
    }
  }

  // Reference fields
  d.collections.forEach((collection, c) => {
    collection.fields.forEach((field, f) => {
      if (field.type === 'reference') collectionAt(field.collection, ['collections', c, 'fields', f, 'collection'])
    })
  })

  // Views
  d.views.forEach((view, v) => {
    const at = (...rest: Path): Path => ['views', v, ...rest]
    if (view.type === 'overview') {
      view.sections.forEach((section, s) => {
        const collection = collectionAt(section.collection, at('sections', s, 'collection'))
        if (section.sort) fieldAt(collection, section.sort.field, at('sections', s, 'sort', 'field'))
      })
      return
    }
    const collection = collectionAt(view.collection, at('collection'))
    view.fields?.forEach((field, i) => fieldAt(collection, field, at('fields', i)))
    if (view.type === 'calendar') fieldAt(collection, view.dateField, at('dateField'), ['date'])
    else if (view.sort) fieldAt(collection, view.sort.field, at('sort', 'field'))
  })

  // Inputs
  d.inputs.forEach((input, i) => {
    const collection = collectionAt(input.collection, ['inputs', i, 'collection'])
    if (input.type === 'form') return
    const { url, title, text } = input.map
    if (url !== undefined) fieldAt(collection, url, ['inputs', i, 'map', 'url'], ['link'])
    if (title !== undefined) fieldAt(collection, title, ['inputs', i, 'map', 'title'], ['text'])
    if (text !== undefined) fieldAt(collection, text, ['inputs', i, 'map', 'text'], ['text'])
  })

  // Reminders
  d.reminders.forEach((reminder, r) => {
    if (reminder.type !== 'beforeDate') return
    const collection = collectionAt(reminder.collection, ['reminders', r, 'collection'])
    fieldAt(collection, reminder.dateField, ['reminders', r, 'dateField'], ['date'])
  })
}

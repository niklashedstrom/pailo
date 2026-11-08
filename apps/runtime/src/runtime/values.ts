import { type AppDescription, type Collection, type Field, type PersonRef, parseFieldValue } from '@pailo/schema'
import type { AppRecord, Member } from '../api'
import { dayOf, formatDateValue, timeOf } from './dates'

/** Everything needed to turn stored values into what people read. */
export interface AppData {
  description: AppDescription
  records: AppRecord[]
  members: Member[]
}

export const UNTITLED = 'Namnlös'

export function findCollection(description: AppDescription, id: string): Collection | undefined {
  return description.collections.find((collection) => collection.id === id)
}

/**
 * The record's name: its first required text field, else first text field.
 * Without text, the first record it points to (a planned meal is called
 * after its dish). Given `data` only one level deep, so references that
 * point at each other can't loop.
 */
export function recordTitle(collection: Collection, record: AppRecord, data?: AppData): string {
  const texts = collection.fields.filter((field) => field.type === 'text')
  const field = texts.find((f) => f.required) ?? texts[0]
  const value = field ? parseFieldValue(field, record.data[field.id]) : undefined
  if (typeof value === 'string') return value
  if (data) {
    for (const reference of collection.fields) {
      if (reference.type !== 'reference') continue
      const text = displayText(reference, record.data[reference.id], data)
      if (text !== '') return text
    }
  }
  return UNTITLED
}

export function personName(ref: PersonRef, data: AppData): string | undefined {
  if ('member' in ref) return data.members.find((m) => m.userId === ref.member)?.displayName
  return data.description.people.others.find((p) => p.id === ref.other)?.name
}

/** The record a reference points to, only if it is in the referenced collection. */
export function referencedRecord(field: Extract<Field, { type: 'reference' }>, id: string, data: AppData) {
  return data.records.find((record) => record.id === id && record.collection === field.collection)
}

/**
 * The value as plain text: labels instead of option values, names instead of
 * ids, the title of a referenced record. Empty when missing or broken.
 */
export function displayText(field: Field, raw: unknown, data: AppData): string {
  const value = parseFieldValue(field, raw)
  if (value === undefined) return ''
  switch (field.type) {
    case 'text':
    case 'link':
      return value as string
    case 'date':
      return formatDateValue(value)
    case 'choice': {
      const values = (field.multiple ? value : [value]) as string[]
      return values.map((v) => field.options.find((option) => option.value === v)?.label ?? '').filter(Boolean).join(', ')
    }
    case 'person': {
      const refs = (field.multiple ? value : [value]) as PersonRef[]
      return refs.map((ref) => personName(ref, data) ?? '').filter(Boolean).join(', ')
    }
    case 'reference': {
      const target = referencedRecord(field, value as string, data)
      const collection = findCollection(data.description, field.collection)
      return target && collection ? recordTitle(collection, target) : ''
    }
    case 'image':
      return ''
    default: {
      const unknownField: never = field
      return unknownField
    }
  }
}

function sortKey(field: Field, record: AppRecord, data: AppData): string {
  if (field.type === 'date') {
    const raw = record.data[field.id]
    const day = dayOf(parseFieldValue(field, raw))
    return day ? `${day}T${timeOf(raw) ?? '00:00'}` : ''
  }
  return displayText(field, record.data[field.id], data)
}

/**
 * Sorts by the view's sort, comparing text the Swedish way (å, ä, ö last) and
 * dates chronologically, with missing values last in both directions.
 * Without a sort, the newest record comes first.
 */
export function sortRecords(
  records: AppRecord[],
  collection: Collection,
  sort: { field: string; direction: 'asc' | 'desc' } | undefined,
  data: AppData,
): AppRecord[] {
  const field = sort && collection.fields.find((f) => f.id === sort.field)
  if (!sort || !field) return records.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
  const keyed = records.map((record) => ({ record, key: sortKey(field, record, data) }))
  const sign = sort.direction === 'asc' ? 1 : -1
  return keyed
    .toSorted((a, b) => {
      if (a.key === '' || b.key === '') return a.key === b.key ? 0 : a.key === '' ? 1 : -1
      const compare = field.type === 'date' ? a.key.localeCompare(b.key) : a.key.localeCompare(b.key, 'sv')
      return compare * sign
    })
    .map(({ record }) => record)
}

export function recordsIn(data: AppData, collectionId: string): AppRecord[] {
  return data.records.filter((record) => record.collection === collectionId)
}

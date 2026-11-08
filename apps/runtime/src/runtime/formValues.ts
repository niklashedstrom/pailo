import { type Collection, type Field, type PersonRef, type RecordData, parseFieldValue, recordDataSchema } from '@pailo/schema'

// Form values are strings while editing; these turn them into the stored
// format and back, and ask recordDataSchema whether a record may be saved.

export type FormValue = string | string[]
export type FormValues = Record<string, FormValue>

const personKey = (ref: PersonRef) => ('member' in ref ? `member:${ref.member}` : `other:${ref.other}`)

function personRef(key: string): PersonRef | null {
  const [kind, ...rest] = key.split(':')
  const id = rest.join(':')
  if (!id) return null
  if (kind === 'member') return { member: id }
  if (kind === 'other') return { other: id }
  return null
}

/** Stored data → form values; broken values start empty. */
export function toFormValues(collection: Collection, data: RecordData): FormValues {
  const values: FormValues = {}
  for (const field of collection.fields) {
    const value = parseFieldValue(field, data[field.id])
    if (value === undefined) continue
    if (field.type === 'person') {
      values[field.id] = field.multiple ? (value as PersonRef[]).map(personKey) : personKey(value as PersonRef)
    } else if (typeof value === 'string' || Array.isArray(value)) {
      values[field.id] = value as FormValue
    }
  }
  return values
}

/** Form values → stored data: empty fields are left out, people become references. */
export function toRecordData(collection: Collection, values: FormValues): RecordData {
  const data: RecordData = {}
  for (const field of collection.fields) {
    const value = values[field.id]
    if (value === undefined) continue
    if (Array.isArray(value)) {
      if (value.length === 0) continue
      data[field.id] = field.type === 'person' ? value.map(personRef) : value
    } else {
      const text = field.type === 'text' ? value : value.trim()
      if (text.trim() === '') continue
      data[field.id] = field.type === 'person' ? personRef(text) : text
    }
  }
  return data
}

/** Field id → what to tell the person, from the schema's verdict. */
export function validate(collection: Collection, data: RecordData): Record<string, string> {
  const result = recordDataSchema(collection).safeParse(data)
  if (result.success) return {}
  const errors: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const id = String(issue.path[0] ?? '')
    const field = collection.fields.find((f) => f.id === id)
    if (!field || errors[id]) continue
    errors[id] = data[id] === undefined ? `Fyll i ${field.label.toLocaleLowerCase('sv')}.` : messageFor(field)
  }
  return errors
}

function messageFor(field: Field): string {
  switch (field.type) {
    case 'link':
      return 'Skriv en hel adress som börjar med https://'
    case 'date':
      return field.withTime ? 'Välj dag och tid.' : 'Välj en dag.'
    default:
      return `Kontrollera ${field.label.toLocaleLowerCase('sv')}.`
  }
}

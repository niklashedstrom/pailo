import type { Collection, Field, RecordData } from '@pailo/schema'
import { type FormEvent, useId, useState } from 'react'
import { type FormValue, type FormValues, toRecordData, validate } from './formValues'
import { type AppData, findCollection, recordTitle, recordsIn } from './values'

// One form for every collection, with a control per field type.

interface ControlProps {
  field: Field
  value: FormValue | undefined
  onChange: (value: FormValue) => void
  data: AppData
  error?: string
}

function Choices({
  field,
  options,
  value,
  onChange,
  multiple,
  required,
  describedBy,
}: {
  field: Field
  options: { value: string; label: string }[]
  value: FormValue | undefined
  onChange: (value: FormValue) => void
  multiple: boolean
  required: boolean
  describedBy?: string
}) {
  const id = useId()
  if (multiple) {
    const selected = Array.isArray(value) ? value : []
    return (
      <fieldset className="choices" aria-describedby={describedBy}>
        <legend>
          {field.label}
          {required && <span className="required"> (måste fyllas i)</span>}
        </legend>
        {options.map((option) => (
          <label key={option.value} className="choice">
            <input
              type="checkbox"
              checked={selected.includes(option.value)}
              onChange={(event) =>
                onChange(event.target.checked ? [...selected, option.value] : selected.filter((v) => v !== option.value))
              }
            />
            {option.label}
          </label>
        ))}
      </fieldset>
    )
  }
  return (
    <>
      <Label htmlFor={id} field={field} required={required} />
      <select id={id} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} aria-describedby={describedBy}>
        <option value="">{required ? 'Välj …' : 'Inget valt'}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </>
  )
}

function Label({ htmlFor, field, required }: { htmlFor: string; field: Field; required: boolean }) {
  return (
    <label htmlFor={htmlFor}>
      {field.label}
      {required && <span className="required"> (måste fyllas i)</span>}
    </label>
  )
}

/** The control for one field; one case per field type in the schema. */
export function FieldControl({ field, value, onChange, data, error }: ControlProps) {
  const id = useId()
  const errorId = `${id}-error`
  const required = field.required === true && field.type !== 'image'
  const describedBy = error ? errorId : undefined
  const text = typeof value === 'string' ? value : ''

  const control = (() => {
    switch (field.type) {
      case 'text':
        return (
          <>
            <Label htmlFor={id} field={field} required={required} />
            {field.multiline ? (
              <textarea id={id} rows={4} value={text} onChange={(e) => onChange(e.target.value)} aria-describedby={describedBy} />
            ) : (
              <input id={id} value={text} onChange={(e) => onChange(e.target.value)} aria-describedby={describedBy} />
            )}
          </>
        )
      case 'date':
        return (
          <>
            <Label htmlFor={id} field={field} required={required} />
            <input
              id={id}
              type={field.withTime ? 'datetime-local' : 'date'}
              value={text}
              onChange={(e) => onChange(e.target.value)}
              aria-describedby={describedBy}
            />
          </>
        )
      case 'link':
        return (
          <>
            <Label htmlFor={id} field={field} required={required} />
            <input
              id={id}
              type="url"
              inputMode="url"
              placeholder="https://"
              value={text}
              onChange={(e) => onChange(e.target.value)}
              aria-describedby={describedBy}
            />
          </>
        )
      case 'choice':
        return (
          <Choices
            field={field}
            options={field.options}
            value={value}
            onChange={onChange}
            multiple={field.multiple === true}
            required={required}
            describedBy={describedBy}
          />
        )
      case 'person': {
        const options = [
          ...data.members.map((m) => ({ value: `member:${m.userId}`, label: m.displayName })),
          ...data.description.people.others.map((p) => ({ value: `other:${p.id}`, label: p.name })),
        ]
        return (
          <Choices
            field={field}
            options={options}
            value={value}
            onChange={onChange}
            multiple={field.multiple === true}
            required={required}
            describedBy={describedBy}
          />
        )
      }
      case 'reference': {
        const target = findCollection(data.description, field.collection)
        const options = target
          ? recordsIn(data, target.id)
              .map((record) => ({ value: record.id, label: recordTitle(target, record) }))
              .sort((a, b) => a.label.localeCompare(b.label, 'sv'))
          : []
        return (
          <>
            <Choices
              field={field}
              options={options}
              value={value}
              onChange={onChange}
              multiple={false}
              required={required}
              describedBy={describedBy}
            />
            {options.length === 0 && target && (
              <p className="hint">Lägg först till något i {target.name.toLocaleLowerCase('sv')}.</p>
            )}
          </>
        )
      }
      case 'image':
        return (
          <>
            <span className="label">{field.label}</span>
            <p className="hint">Bilder går inte att lägga till än.</p>
          </>
        )
      default: {
        const unknownField: never = field
        return unknownField
      }
    }
  })()

  return (
    <div className={error ? 'field has-error' : 'field'}>
      {control}
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
    </div>
  )
}

export function RecordForm({
  collection,
  data,
  initial,
  submitLabel,
  busy,
  onSubmit,
  onCancel,
}: {
  collection: Collection
  data: AppData
  initial: FormValues
  submitLabel: string
  busy: boolean
  onSubmit: (record: RecordData) => void
  onCancel: () => void
}) {
  const [values, setValues] = useState<FormValues>(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function submit(event: FormEvent) {
    event.preventDefault()
    const record = toRecordData(collection, values)
    const found = validate(collection, record)
    setErrors(found)
    if (Object.keys(found).length === 0) onSubmit(record)
  }

  return (
    <form className="record-form" onSubmit={submit} noValidate>
      {collection.fields.map((field) => (
        <FieldControl
          key={field.id}
          field={field}
          value={values[field.id]}
          data={data}
          error={errors[field.id]}
          onChange={(value) => {
            setValues((current) => ({ ...current, [field.id]: value }))
            setErrors(({ [field.id]: _removed, ...rest }) => rest)
          }}
        />
      ))}
      <div className="actions">
        <button type="submit" disabled={busy}>
          {busy ? 'Sparar …' : submitLabel}
        </button>
        <button type="button" className="secondary" onClick={onCancel} disabled={busy}>
          Avbryt
        </button>
      </div>
    </form>
  )
}

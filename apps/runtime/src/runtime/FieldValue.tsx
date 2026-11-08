import type { Field } from '@pailo/schema'
import { type AppData, displayText } from './values'

const SAFE_LINK = /^https?:\/\//i

/**
 * One field value, always as text. Only http(s) addresses become links, and
 * they open in a new tab without access to Pailo.
 */
export function FieldValue({ field, value, data }: { field: Field; value: unknown; data: AppData }) {
  if (field.type === 'link' && typeof value === 'string' && !SAFE_LINK.test(value)) {
    // Not a valid link (e.g. javascript:): shown as plain text, never clickable.
    return value.trim() === '' ? null : <>{value.slice(0, 2_000)}</>
  }
  const text = displayText(field, value, data)
  if (text === '') return null
  if (field.type === 'link' && SAFE_LINK.test(text)) {
    return (
      <a href={text} target="_blank" rel="noopener noreferrer">
        {text.replace(/^https?:\/\/(www\.)?/i, '')}
      </a>
    )
  }
  if (field.type === 'text' && field.multiline) return <span className="multiline">{text}</span>
  return <>{text}</>
}

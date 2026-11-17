import { type FormEvent, useEffect, useId, useRef, useState } from 'react'

const MAX_NAME_LENGTH = 80

interface EditNameProps {
  /** Text on the button that opens the form. */
  openLabel: string
  fieldLabel: string
  failedText: string
  autoComplete?: string
  currentName: string
  /** Receives the trimmed name; throws when it could not be saved. */
  save: (name: string) => Promise<void>
  onSaved: (name: string) => void
}

/**
 * A button that opens a small form for changing a name, such as the
 * person's own name in an app. Where it is shown is only for convenience;
 * the database is what stops anyone else.
 */
export function EditName({ openLabel, fieldLabel, failedText, autoComplete, currentName, save, onSaved }: EditNameProps) {
  const inputId = useId()
  const [name, setName] = useState<string | undefined>(undefined)
  const [state, setState] = useState<'idle' | 'saving' | 'failed' | 'saved'>('idle')
  const openButton = useRef<HTMLButtonElement>(null)
  // Set when the form closes, so focus goes back to the open button instead of being lost.
  const returnFocus = useRef(false)

  useEffect(() => {
    if (name === undefined && returnFocus.current) {
      returnFocus.current = false
      openButton.current?.focus()
    }
  }, [name])

  function close() {
    returnFocus.current = true
    setName(undefined)
  }

  if (name === undefined) {
    return (
      <>
        <button
          ref={openButton}
          type="button"
          className="link"
          onClick={() => {
            setName(currentName)
            setState('idle')
          }}
        >
          {openLabel}
        </button>
        {state === 'saved' && (
          <p role="status" className="hint">
            Namnet är sparat.
          </p>
        )}
      </>
    )
  }

  const trimmed = name.trim()
  const canSave = trimmed.length > 0 && trimmed.length <= MAX_NAME_LENGTH && state !== 'saving'

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!canSave) return
    setState('saving')
    try {
      await save(trimmed)
      setState('saved')
      close()
      onSaved(trimmed)
    } catch {
      setState('failed')
    }
  }

  return (
    <form className="edit-name" onSubmit={submit}>
      <label htmlFor={inputId}>{fieldLabel}</label>
      <input
        id={inputId}
        value={name}
        maxLength={MAX_NAME_LENGTH}
        autoComplete={autoComplete ?? 'off'}
        enterKeyHint="done"
        autoFocus
        onChange={(event) => {
          setName(event.target.value)
          if (state === 'failed') setState('idle')
        }}
      />
      <div className="actions">
        <button type="submit" disabled={!canSave}>
          {state === 'saving' ? 'Sparar …' : 'Spara'}
        </button>
        <button type="button" className="secondary" onClick={close}>
          Avbryt
        </button>
      </div>
      {state === 'failed' && <p role="alert">{failedText}</p>}
    </form>
  )
}


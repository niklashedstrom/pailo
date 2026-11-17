import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { ExportedApp } from '../api'
import { memoryStorage } from '../test-helpers'
import { ANNA, BERTIL, rawDrop, rawMealPlan } from '../test-fixtures'
import { assembleStandalone, DATA_BLOCK } from './assemble'
import { readPayload } from './payload'
import { StandaloneApp } from './StandaloneApp'

const NOW = new Date(Date.UTC(2026, 10, 11, 10, 0))
const TEMPLATE = `<!doctype html><html><head><title>App</title></head><body><div id="root"></div>${DATA_BLOCK}</body></html>`

/** A downloaded file, opened: the assembled page parsed into a document. */
function openFile(app: ExportedApp): Document {
  return new DOMParser().parseFromString(assembleStandalone(TEMPLATE, app), 'text/html')
}

const download = (description: unknown, records: unknown[] = []): ExportedApp => ({
  appId: 'a-1',
  name: (description as { name: string }).name,
  description,
  records,
  members: [
    { id: ANNA, displayName: 'Anna', owner: true },
    { id: BERTIL, displayName: 'Bertil', owner: false },
  ],
  me: ANNA,
  exportedAt: '2026-11-18T08:00:00Z',
})

const row = (id: string, collection: string, data: Record<string, unknown>, by = ANNA) => ({
  id,
  collection,
  data,
  created_by: by,
  created_at: '2026-11-10T08:00:00Z',
  updated_by: by,
  updated_at: '2026-11-10T08:00:00Z',
})

describe('readPayload', () => {
  it('reads the app, its records and members from the file', () => {
    const payload = readPayload(openFile(download(rawDrop, [row('r1', 'drops', { title: '</script> Pasta' }, BERTIL)])))!
    expect(payload.name).toBe('Drop')
    expect(payload.records).toEqual([
      expect.objectContaining({ id: 'r1', collection: 'drops', data: { title: '</script> Pasta' }, createdBy: BERTIL }),
    ])
    expect(payload.members).toEqual([
      { userId: ANNA, displayName: 'Anna', role: 'owner' },
      { userId: BERTIL, displayName: 'Bertil', role: 'member' },
    ])
  })

  it('is null for an empty or damaged file', () => {
    expect(readPayload(new DOMParser().parseFromString(TEMPLATE, 'text/html'))).toBeNull()
    expect(readPayload(openFile(download({ name: 'Trasig' })))).toBeNull()
  })
})

describe('the downloaded app', () => {
  it('shows Drop with its records, and keeps a new, a changed and a deleted record after it is opened again', async () => {
    const file = openFile(download(rawDrop, [row('r1', 'drops', { title: 'Pasta' }), row('r2', 'drops', { title: 'Gammal' })]))
    const storage = memoryStorage()
    const first = render(<StandaloneApp payload={readPayload(file)!} storage={storage} now={NOW} />)

    expect(await screen.findByRole('heading', { name: 'Drop' })).toBeInTheDocument()
    expect(screen.getByText('Det du ändrar här sparas i den här webbläsaren.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Spara något' }))
    await userEvent.type(screen.getByLabelText(/Titel/), 'Bra recept')
    await userEvent.click(screen.getByRole('button', { name: 'Spara' }))
    expect(await screen.findByText('Bra recept')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Pasta/ }))
    const title = screen.getByLabelText(/Titel/)
    await userEvent.clear(title)
    await userEvent.type(title, 'Pasta med pesto')
    await userEvent.click(screen.getByRole('button', { name: 'Spara' }))
    expect(await screen.findByText('Pasta med pesto')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Gammal/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Ta bort' }))
    await userEvent.click(screen.getByRole('button', { name: 'Ja, ta bort' }))
    await screen.findByRole('button', { name: 'Spara något' })
    expect(screen.queryByText('Gammal')).not.toBeInTheDocument()
    first.unmount()

    // The person closes the browser and opens the same file again.
    render(<StandaloneApp payload={readPayload(file)!} storage={storage} now={NOW} />)
    expect(await screen.findByText('Bra recept')).toBeInTheDocument()
    expect(screen.getByText('Pasta med pesto')).toBeInTheDocument()
    expect(screen.queryByText('Gammal')).not.toBeInTheDocument()
  })

  it('runs the meal plan with every view, switching views without any address', async () => {
    const file = openFile(
      download(rawMealPlan, [
        row('10000000-0000-4000-8000-000000000001', 'ratter', { namn: 'Lasagne' }),
        row('10000000-0000-4000-8000-000000000002', 'maltider', {
          datum: '2026-11-11',
          ratt: '10000000-0000-4000-8000-000000000001',
          lagar: { member: BERTIL },
        }),
      ]),
    )
    render(<StandaloneApp payload={readPayload(file)!} storage={memoryStorage()} now={NOW} />)
    const wednesday = (await screen.findByText('onsdag 11 november')).closest('li')!
    expect(wednesday).toHaveTextContent('Lasagne')
    expect(wednesday).toHaveTextContent('Bertil')
    await userEvent.click(screen.getByRole('button', { name: 'Rätter' }))
    expect(screen.getByRole('button', { name: 'Rätter' })).toHaveAttribute('aria-current', 'page')
    expect(within(screen.getByText('Lasagne').closest('ul')!).getByText('Lasagne')).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('still works when the browser will not save, and says so', async () => {
    const refuses = { getItem: () => null, setItem: () => { throw new Error('private window') } }
    render(<StandaloneApp payload={readPayload(openFile(download(rawDrop)))!} storage={refuses} now={NOW} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Spara något' }))
    await userEvent.type(screen.getByLabelText(/Titel/), 'Tillfällig')
    await userEvent.click(screen.getByRole('button', { name: 'Spara' }))
    expect(await screen.findByText('Tillfällig')).toBeInTheDocument()
    expect(screen.getByText('Webbläsaren sparar inte ändringarna. De försvinner när du stänger sidan.')).toBeInTheDocument()
  })
})

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import App from '../App'
import type { Household, Role } from '../api'
import { type FakeState, fakeApi, fakeApp } from '../test-helpers'
import { ANNA, BERTIL, members, rawAllBlocks, rawDrop, rawMealPlan } from '../test-fixtures'
import { PALETTE_TOKENS } from './theme/tokens'

// Wednesday 11 November 2026, 11:00 in Sweden.
const NOW = new Date(Date.UTC(2026, 10, 11, 10, 0))

function household(role: Role): Household {
  return { id: 'h-1', name: 'Familjen', role }
}

function setup(options: { path?: string; role?: Role; userId?: string; state?: Partial<FakeState> } = {}) {
  window.history.replaceState(null, '', options.path ?? '/app/a-meal')
  const { api, state } = fakeApi({
    userId: options.userId ?? ANNA,
    households: [household(options.role ?? 'admin')],
    members: { 'h-1': members },
    apps: [
      fakeApp('a-meal', 'h-1', rawMealPlan),
      fakeApp('a-drop', 'h-1', rawDrop),
      fakeApp('a-blocks', 'h-1', rawAllBlocks),
      fakeApp('a-other', 'h-other', rawDrop),
      fakeApp('a-broken', 'h-1', { ...rawDrop, views: [] }),
    ],
    ...options.state,
  })
  const utils = render(<App api={api} now={NOW} />)
  return { api, state, ...utils }
}

const create = (state: FakeState, appId: string, collection: string, data: Record<string, unknown>, by = ANNA) => {
  const id = `20000000-0000-4000-8000-${String(state.records.length + 1).padStart(12, '0')}`
  const at = new Date(Date.UTC(2026, 10, 1, 8, 0, state.records.length)).toISOString()
  state.records = [...state.records, { id, appId, collection, data, createdBy: by, createdAt: at, updatedAt: at }]
  return id
}

afterEach(() => window.history.replaceState(null, '', '/'))

describe('opening an app', () => {
  it('shows the first view, and switches view through the address', async () => {
    setup()
    expect(await screen.findByRole('heading', { name: 'Matschema' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Vecka 46' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Rätter' }))
    expect(window.location.pathname).toBe('/app/a-meal/ratter')
    expect(screen.getByRole('link', { name: 'Rätter' })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('heading', { name: 'Vecka 46' })).not.toBeInTheDocument()
  })

  it('opens the view in the address after a reload', async () => {
    setup({ path: '/app/a-meal/ratter' })
    expect(await screen.findByText('Inget i rätter än.')).toBeInTheDocument()
  })

  it.each(['/app/a-other', '/app/finns-inte'])('says %s could not be found and shows nothing of it', async (path) => {
    setup({ path })
    expect(await screen.findByRole('heading', { name: 'Appen kunde inte hittas' })).toBeInTheDocument()
    expect(screen.queryByText('Drop')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Till hushållet' }))
    expect(await screen.findByRole('heading', { name: 'Familjen' })).toBeInTheDocument()
  })

  it('does not show an app whose description does not validate', async () => {
    setup({ path: '/app/a-broken' })
    expect(await screen.findByRole('heading', { name: 'Appen kan inte visas just nu' })).toBeInTheDocument()
  })

  it('fetches records again when the person comes back to the tab', async () => {
    const { state } = setup({ path: '/app/a-drop' })
    expect(await screen.findByText('Inget i sparat än.')).toBeInTheDocument()
    create(state, 'a-drop', 'drops', { title: 'Från Bertil' }, BERTIL)
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(await screen.findByText('Från Bertil')).toBeInTheDocument()
  })
})

describe('views', () => {
  it('lists Drop with the newest first', async () => {
    const { state } = setup({ path: '/app/a-drop' })
    create(state, 'a-drop', 'drops', { title: 'Äldst' })
    create(state, 'a-drop', 'drops', { title: 'Nyast', url: 'https://pailo.se', tags: ['recept'] })
    const items = within(await screen.findByRole('list')).getAllByRole('listitem')
    expect(items.map((item) => item.querySelector('.record-title')?.textContent)).toEqual(['Nyast', 'Äldst'])
    expect(items[0]).toHaveTextContent('Recept')
  })

  it('puts a saved link next to the record button, not inside it', async () => {
    const { state } = setup({ path: '/app/a-drop' })
    create(state, 'a-drop', 'drops', { title: 'Artikel', url: 'https://pailo.se/a' })
    const link = await screen.findByRole('link', { name: 'pailo.se/a' })
    expect(link.closest('button')).toBeNull()
    // Empty fields (no note, no tags) leave nothing behind.
    expect(link.closest('li')!.querySelectorAll('.record-field')).toHaveLength(1)
    expect(link).toHaveAttribute('href', 'https://pailo.se/a')
    expect(screen.getByRole('button', { name: /Artikel/ })).not.toHaveTextContent('pailo.se/a')
  })

  it("shows the meal plan's dishes as cards sorted by name", async () => {
    const { state } = setup({ path: '/app/a-meal/ratter' })
    for (const name of ['Ärtsoppa', 'Lasagne', 'Fiskgratäng']) create(state, 'a-meal', 'ratter', { namn: name, sort: 'kott' })
    await screen.findByText('Lasagne')
    const titles = [...document.querySelectorAll('.card .record-title')].map((el) => el.textContent)
    expect(titles).toEqual(['Fiskgratäng', 'Lasagne', 'Ärtsoppa'])
  })

  it('sorts the building-block list by its sort field, the Swedish way', async () => {
    const { state } = setup({ path: '/app/a-blocks/v-lista' })
    for (const title of ['Örn', 'apa', 'Åsna']) create(state, 'a-blocks', 'qx-saker', { 'f-rubrik': title })
    await screen.findByText('apa')
    expect([...document.querySelectorAll('.record-title')].map((el) => el.textContent)).toEqual(['apa', 'Åsna', 'Örn'])
  })

  it('puts meals on their day in the week and steps between weeks', async () => {
    const { state } = setup()
    const lasagne = create(state, 'a-meal', 'ratter', { namn: 'Lasagne' })
    create(state, 'a-meal', 'maltider', { datum: '2026-11-11', ratt: lasagne, maltid: 'middag' })
    create(state, 'a-meal', 'maltider', { datum: '2026-11-18', ratt: lasagne })
    create(state, 'a-meal', 'maltider', { datum: 'inte-ett-datum', ratt: lasagne })

    const wednesday = (await screen.findByText('onsdag 11 november')).closest('li')!
    expect(wednesday).toHaveAttribute('aria-current', 'date')
    expect(wednesday).toHaveTextContent('Lasagne')
    expect(wednesday).toHaveTextContent('Middag')
    expect(screen.getAllByText('Lasagne')).toHaveLength(1)
    // The meal is named after its dish, never "Namnlös".
    expect(wednesday.querySelector('.record-title')).toHaveTextContent('Lasagne')
    expect(wednesday).not.toHaveTextContent('Namnlös')

    await userEvent.click(screen.getByRole('button', { name: 'Nästa vecka' }))
    expect(screen.getByRole('heading', { name: 'Vecka 47' })).toBeInTheDocument()
    expect(screen.getByText('onsdag 18 november').closest('li')).toHaveTextContent('Lasagne')
    await userEvent.click(screen.getByRole('button', { name: 'Förra veckan' }))
    await userEvent.click(screen.getByRole('button', { name: 'Förra veckan' }))
    expect(screen.getByRole('heading', { name: 'Vecka 45' })).toBeInTheDocument()
  })

  it('shows a month of dated records with their time, skipping undated ones', async () => {
    const { state } = setup({ path: '/app/a-blocks/v-manad' })
    create(state, 'a-blocks', 'qx-saker', { 'f-rubrik': 'Möte', 'f-tid': '2026-11-20T18:30' })
    create(state, 'a-blocks', 'qx-saker', { 'f-rubrik': 'Utan tid' })
    expect(await screen.findByRole('heading', { name: 'november 2026' })).toBeInTheDocument()
    const day = screen.getByText('fredag 20 november').closest('li')!
    expect(day).toHaveTextContent('Möte')
    expect(day).toHaveTextContent('18:30')
    expect(screen.queryByText('Utan tid')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Nästa månad' }))
    expect(screen.getByRole('heading', { name: 'december 2026' })).toBeInTheDocument()
    expect(screen.getByText('Inget den här månaden.')).toBeInTheDocument()
  })

  it('limits overview sections', async () => {
    const { state } = setup({ path: '/app/a-blocks/v-oversikt' })
    for (let i = 1; i <= 12; i++) create(state, 'a-blocks', 'qx-saker', { 'f-rubrik': `Sak ${i}` })
    const section = (await screen.findByRole('heading', { name: 'Senaste sakerna' })).closest('section')!
    expect(within(section).getAllByRole('listitem')).toHaveLength(5)
    expect(within(section).getAllByRole('listitem')[0]).toHaveTextContent('Sak 12')
    expect(screen.getByRole('heading', { name: 'Grupper' })).toBeInTheDocument()
  })
})

describe('forms', () => {
  it('saves a record using every kind of control, in the stored format', async () => {
    const { state } = setup({ path: '/app/a-blocks/v-lista' })
    const group = create(state, 'a-blocks', 'qx-grupper', { 'g-namn': 'Kören', 'g-start': '2026-09-01' })
    await userEvent.click(await screen.findByRole('button', { name: 'Ny sak' }))

    await userEvent.type(screen.getByLabelText(/Rubrik/), 'Allt')
    await userEvent.type(screen.getByLabelText('Längre text'), 'rad ett{enter}rad två')
    fireEvent.change(screen.getByLabelText('Dag'), { target: { value: '2026-11-12' } })
    fireEvent.change(screen.getByLabelText('Dag och tid'), { target: { value: '2026-11-12T18:30' } })
    await userEvent.type(screen.getByLabelText('Adress'), 'https://pailo.se')
    expect(screen.getByText('Bilder går inte att lägga till än.')).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Ansvarig'), 'Kim')
    await userEvent.click(within(screen.getByRole('group', { name: 'Deltagare' })).getByLabelText('Bertil'))
    await userEvent.click(within(screen.getByRole('group', { name: 'Deltagare' })).getByLabelText('Ölund'))
    await userEvent.selectOptions(screen.getByLabelText('Nivå'), 'Hög')
    await userEvent.click(within(screen.getByRole('group', { name: 'Märkningar' })).getByLabelText('Grön'))
    await userEvent.selectOptions(screen.getByLabelText('Hör till'), 'Kören')
    await userEvent.click(screen.getByRole('button', { name: 'Spara' }))

    await screen.findByRole('button', { name: 'Ny sak' })
    expect(state.records.find((r) => r.collection === 'qx-saker')?.data).toEqual({
      'f-rubrik': 'Allt',
      'f-text': 'rad ett\nrad två',
      'f-dag': '2026-11-12',
      'f-tid': '2026-11-12T18:30',
      'f-adress': 'https://pailo.se',
      'f-ansvarig': { other: 'p-ett' },
      'f-deltagare': [{ member: BERTIL }, { other: 'p-tva' }],
      'f-niva': 'hog',
      'f-markningar': ['gron'],
      'f-hor-till': group,
    })
  })

  it('does not save without required fields and says which', async () => {
    const { api } = setup({ path: '/app/a-meal/ratter' })
    await userEvent.click(await screen.findByRole('button', { name: 'Ny rätt' }))
    expect(screen.getByLabelText(/Namn/)).toBeInTheDocument()
    expect(screen.getByText('(måste fyllas i)')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Spara' }))
    expect(screen.getByText('Fyll i namn.')).toBeInTheDocument()
    expect(api.createRecord).not.toHaveBeenCalled()
  })

  it('explains a link that is not a whole address', async () => {
    setup({ path: '/app/a-drop' })
    await userEvent.click(await screen.findByRole('button', { name: 'Spara något' }))
    await userEvent.type(screen.getByLabelText(/Titel/), 'Hej')
    await userEvent.type(screen.getByLabelText('Länk'), 'pailo.se')
    await userEvent.click(screen.getByRole('button', { name: 'Spara' }))
    expect(screen.getByText('Skriv en hel adress som börjar med https://')).toBeInTheDocument()
  })

  it('lets a dish be saved although images cannot be added yet', async () => {
    const { state } = setup({ path: '/app/a-meal/ratter' })
    await userEvent.click(await screen.findByRole('button', { name: 'Ny rätt' }))
    expect(screen.getByText('Bilder går inte att lägga till än.')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText(/Namn/), 'Lasagne')
    await userEvent.click(screen.getByRole('button', { name: 'Spara' }))
    expect(await screen.findByText('Lasagne')).toBeInTheDocument()
    expect(state.records[0].data).toEqual({ namn: 'Lasagne' })
  })

  it('edits a record and shows the change at once', async () => {
    const { state } = setup({ path: '/app/a-drop' })
    create(state, 'a-drop', 'drops', { title: 'Gammal' })
    await userEvent.click(await screen.findByRole('button', { name: /Gammal/ }))
    const title = screen.getByLabelText(/Titel/)
    await userEvent.clear(title)
    await userEvent.type(title, 'Ny')
    await userEvent.click(screen.getByRole('button', { name: 'Spara' }))
    expect(await screen.findByText('Ny')).toBeInTheDocument()
    expect(screen.queryByText('Gammal')).not.toBeInTheDocument()
  })

  it('deletes after confirming, and keeps the record when the person changes their mind', async () => {
    const { state } = setup({ path: '/app/a-drop' })
    create(state, 'a-drop', 'drops', { title: 'Ta bort mig' })
    await userEvent.click(await screen.findByRole('button', { name: /Ta bort mig/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Ta bort' }))
    const confirm = screen.getByText(/Vill du ta bort Ta bort mig\?/).closest('.danger-zone') as HTMLElement
    await userEvent.click(within(confirm).getByRole('button', { name: 'Avbryt' }))
    expect(state.records).toHaveLength(1)

    await userEvent.click(screen.getByRole('button', { name: 'Ta bort' }))
    await userEvent.click(screen.getByRole('button', { name: 'Ja, ta bort' }))
    expect(await screen.findByText('Inget i sparat än.')).toBeInTheDocument()
    expect(state.records).toHaveLength(0)
  })
})

describe('what a member may do', () => {
  it('hides creating, editing and deleting in a read collection', async () => {
    const { state } = setup({ path: '/app/a-blocks/v-oversikt', role: 'member', userId: BERTIL })
    create(state, 'a-blocks', 'qx-arkiv', { 'a-anteckning': 'Arkiverat' })
    await userEvent.click(await screen.findByRole('button', { name: /Arkiverat/ }))
    expect(screen.queryByRole('button', { name: 'Spara' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ta bort' })).not.toBeInTheDocument()
    expect(screen.getByText('Anteckning')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Tillbaka' }))
    expect(screen.queryByRole('button', { name: 'Ny anteckning' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ny sak' })).toBeInTheDocument()
  })

  it("lets a member read but not change someone else's record under add", async () => {
    const { state } = setup({ path: '/app/a-drop', role: 'member', userId: BERTIL })
    create(state, 'a-drop', 'drops', { title: 'Annas länk' }, ANNA)
    create(state, 'a-drop', 'drops', { title: 'Bertils länk' }, BERTIL)
    await userEvent.click(await screen.findByRole('button', { name: /Annas länk/ }))
    expect(screen.queryByRole('button', { name: 'Spara' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Tillbaka' }))
    await userEvent.click(screen.getByRole('button', { name: /Bertils länk/ }))
    expect(screen.getByRole('button', { name: 'Spara' })).toBeInTheDocument()
    // add never allows members to delete, not even their own records
    expect(screen.queryByRole('button', { name: 'Ta bort' })).not.toBeInTheDocument()
  })
})

describe('when saving goes wrong', () => {
  it.each([
    ['failed', 'Det gick inte att spara. Försök igen.'],
    ['denied', 'Du får inte ändra här.'],
  ] as const)('keeps what was written when saving is %s', async (refuse, message) => {
    const { state } = setup({ path: '/app/a-drop' })
    await userEvent.click(await screen.findByRole('button', { name: 'Spara något' }))
    await userEvent.type(screen.getByLabelText(/Titel/), 'Viktigt')
    state.refuseNext = refuse
    await userEvent.click(screen.getByRole('button', { name: 'Spara' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.getByLabelText(/Titel/)).toHaveValue('Viktigt')
    await userEvent.click(screen.getByRole('button', { name: 'Spara' }))
    expect(await screen.findByText('Viktigt')).toBeInTheDocument()
  })

  it('says so when deleting fails, and keeps the record', async () => {
    const { state } = setup({ path: '/app/a-drop' })
    create(state, 'a-drop', 'drops', { title: 'Kvar' })
    await userEvent.click(await screen.findByRole('button', { name: /Kvar/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Ta bort' }))
    state.refuseNext = 'failed'
    await userEvent.click(screen.getByRole('button', { name: 'Ja, ta bort' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Det gick inte att ta bort. Försök igen.')
    expect(state.records).toHaveLength(1)
  })
})

describe('theme', () => {
  it("gives the app its description's theme and leaves Pailo's own page alone", async () => {
    const { container } = setup()
    await screen.findByRole('heading', { name: 'Matschema' })
    const appRoot = container.querySelector<HTMLElement>('.app-screen')!
    expect(appRoot.style.getPropertyValue('--app-bg')).toBe(PALETTE_TOKENS.sage.bg)
    expect(appRoot.style.getPropertyValue('--app-radius')).toBe('18px')
    expect(container.querySelector('main')!.getAttribute('style')).toBeNull()

    await userEvent.click(screen.getByRole('link', { name: '← Till hushållet' }))
    await waitFor(() => expect(container.querySelector('.app-screen')).toBeNull())
  })

  it("uses the preset's defaults when the description only names a preset", async () => {
    const { container } = setup({
      path: '/app/a-plain',
      state: { apps: [fakeApp('a-plain', 'h-1', { ...rawDrop, theme: { preset: 'strict' } })] },
    })
    await screen.findByRole('heading', { name: 'Drop' })
    const appRoot = container.querySelector<HTMLElement>('.app-screen')!
    expect(appRoot.style.getPropertyValue('--app-bg')).toBe(PALETTE_TOKENS.slate.bg)
    expect(appRoot.style.getPropertyValue('--app-radius')).toBe('4px')
  })
})

describe('done criterion for M3', () => {
  it('runs the meal plan and Drop for two people in the same household', async () => {
    const { api, state, unmount } = setup()

    // Anna adds a dish and plans it for Wednesday.
    await userEvent.click(await screen.findByRole('button', { name: 'Ny rätt' }))
    await userEvent.type(screen.getByLabelText(/Namn/), 'Lasagne')
    await userEvent.click(screen.getByRole('button', { name: 'Spara' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Planera en måltid' }))
    fireEvent.change(screen.getByLabelText(/Dag/), { target: { value: '2026-11-11' } })
    await userEvent.selectOptions(screen.getByLabelText(/Rätt/), 'Lasagne')
    await userEvent.selectOptions(screen.getByLabelText('Vem lagar'), 'Anna')
    await userEvent.click(screen.getByRole('button', { name: 'Spara' }))
    expect((await screen.findByText('onsdag 11 november')).closest('li')).toHaveTextContent('Lasagne')
    unmount()

    // Bertil, an ordinary member, sees it and changes who cooks.
    state.userId = BERTIL
    state.households = [household('member')]
    window.history.replaceState(null, '', '/app/a-meal')
    render(<App api={api} now={NOW} />)
    const wednesday = (await screen.findByText('onsdag 11 november')).closest('li')!
    expect(wednesday).toHaveTextContent('Lasagne')
    expect(wednesday).toHaveTextContent('Anna')
    await userEvent.click(within(wednesday).getByRole('button'))
    await userEvent.selectOptions(screen.getByLabelText('Vem lagar'), 'Bertil')
    await userEvent.click(screen.getByRole('button', { name: 'Spara' }))
    expect((await screen.findByText('onsdag 11 november')).closest('li')).toHaveTextContent('Bertil')
    expect(state.records.find((r) => r.collection === 'maltider')?.data.lagar).toEqual({ member: BERTIL })

    // Bertil saves a link in Drop, and Anna sees it.
    await userEvent.click(screen.getByRole('link', { name: '← Till hushållet' }))
    const dropLinks = await screen.findAllByRole('link', { name: /Drop/ })
    await userEvent.click(dropLinks.find((link) => link.getAttribute('href') === '/app/a-drop')!)
    await userEvent.click(await screen.findByRole('button', { name: 'Spara något' }))
    await userEvent.type(screen.getByLabelText(/Titel/), 'Bra recept')
    await userEvent.type(screen.getByLabelText('Länk'), 'https://www.ica.se/recept')
    await userEvent.click(screen.getByRole('button', { name: 'Spara' }))
    expect(await screen.findByText('Bra recept')).toBeInTheDocument()

    state.userId = ANNA
    state.households = [household('admin')]
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(await screen.findByRole('link', { name: 'ica.se/recept' })).toBeInTheDocument()
  })

  it.each([
    ['Ny sak', 'Rubrik', 'qx-saker', {}],
    ['Ny grupp', 'Namn', 'qx-grupper', { Start: '2026-11-11' }],
    ['Ny anteckning', 'Anteckning', 'qx-arkiv', {}],
  ])('creates, edits and deletes with "%s" in the building-block description', async (button, label, collection, dates) => {
    const { state } = setup({ path: '/app/a-blocks/v-oversikt' })
    await userEvent.click(await screen.findByRole('button', { name: button }))
    await userEvent.type(screen.getByLabelText(new RegExp(label)), 'Första')
    for (const [dateLabel, value] of Object.entries(dates)) {
      fireEvent.change(screen.getByLabelText(new RegExp(dateLabel)), { target: { value } })
    }
    await userEvent.click(screen.getByRole('button', { name: 'Spara' }))
    await userEvent.click(await screen.findByRole('button', { name: /Första/ }))
    const input = screen.getByLabelText(new RegExp(label))
    await userEvent.clear(input)
    await userEvent.type(input, 'Andra')
    await userEvent.click(screen.getByRole('button', { name: 'Spara' }))
    await userEvent.click(await screen.findByRole('button', { name: /Andra/ }))
    expect(state.records.filter((r) => r.collection === collection)).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: 'Ta bort' }))
    await userEvent.click(screen.getByRole('button', { name: 'Ja, ta bort' }))
    await screen.findByRole('button', { name: button })
    expect(state.records.filter((r) => r.collection === collection)).toHaveLength(0)
  })
})

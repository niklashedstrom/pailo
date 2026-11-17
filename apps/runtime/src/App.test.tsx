import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { Member } from './api'
import { fakeApi, fakeApp, memoryStorage } from './test-helpers'
import { ANNA, BERTIL, CECILIA, rawDrop, rawMealPlan } from './test-fixtures'
import { Download } from './workshop/Download'

const anna: Member = { userId: ANNA, displayName: 'Anna', role: 'owner' }
const bertil: Member = { userId: BERTIL, displayName: 'Bertil', role: 'member' }
const cecilia: Member = { userId: CECILIA, displayName: 'Cecilia', role: 'owner' }

afterEach(() => window.history.replaceState(null, '', '/'))

function setup(state: Parameters<typeof fakeApi>[0] = {}, path = '/') {
  window.history.replaceState(null, '', path)
  const result = fakeApi({
    userId: ANNA,
    apps: [
      fakeApp('a-meal', [anna, bertil], rawMealPlan, 'matschema-k3f9qa'),
      fakeApp('a-drop', [anna], rawDrop, 'drop-aaaaaa'),
      fakeApp('a-cecilia', [cecilia, { ...anna, role: 'member' }], { ...rawDrop, name: 'Cecilias läslista' }, 'laslista-bbbbbb'),
      fakeApp('a-other', [cecilia], { ...rawDrop, name: 'Hemlig' }, 'hemlig-cccccc'),
    ],
    ...state,
  })
  render(<App api={result.api} storage={memoryStorage()} />)
  return result
}

describe('signing in to Pailo', () => {
  it('sends a link back to the page the person is on and tells them to check their email', async () => {
    const { api } = setup({ userId: null }, '/app/a-meal')

    expect(await screen.findByRole('heading', { name: 'Pailo' })).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Din e-postadress'), ' mamma@example.se ')
    await userEvent.click(screen.getByRole('button', { name: 'Skicka länk' }))

    expect(api.sendSignInLink).toHaveBeenCalledWith('mamma@example.se', '/app/a-meal')
    expect(await screen.findByRole('heading', { name: 'Kolla din mejl' })).toBeInTheDocument()
  })

  it('says so when the link could not be sent', async () => {
    const { api } = setup({ userId: null })
    api.sendSignInLink.mockRejectedValueOnce(new Error('rate limit'))
    await userEvent.type(await screen.findByLabelText('Din e-postadress'), 'a@example.se')
    await userEvent.click(screen.getByRole('button', { name: 'Skicka länk' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Det gick inte att skicka länken')
  })

  it('asks for nothing the first time: an empty list and the field for a new app', async () => {
    setup({ userId: 'ny-person' })
    expect(await screen.findByRole('heading', { name: 'Mina appar' })).toBeInTheDocument()
    expect(await screen.findByText('Du har inga appar än.')).toBeInTheDocument()
    expect(screen.getByLabelText('Vad vill du ha hjälp med?')).toBeInTheDocument()
    expect(screen.queryByText(/hushåll/i)).not.toBeInTheDocument()
  })

  it('returns to the sign-in page when the person signs out', async () => {
    setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Logga ut' }))
    expect(await screen.findByLabelText('Din e-postadress')).toBeInTheDocument()
  })
})

describe('my apps', () => {
  it('lists my own apps first, then the ones shared with me with the owner, and nobody else\'s', async () => {
    setup()
    const own = within(await screen.findByRole('region', { name: 'Appar du har byggt' }))
    expect(own.getAllByRole('link').map((l) => l.getAttribute('href'))).toEqual([
      '/a/drop-aaaaaa',
      '/app/a-drop',
      '/a/matschema-k3f9qa',
      '/app/a-meal',
    ])
    const shared = within(screen.getByRole('region', { name: 'Delade med dig' }))
    expect(shared.getByRole('link')).toHaveTextContent('Cecilias läslista från Cecilia')
    expect(screen.queryByText('Hemlig')).not.toBeInTheDocument()
  })

  it('opens an app on its own address, and my own apps also in the workshop', async () => {
    setup()
    const meal = await screen.findByRole('link', { name: 'Matschema' })
    expect(meal).toHaveAttribute('href', '/a/matschema-k3f9qa')
    expect(screen.getByRole('link', { name: 'Ändra Matschema' })).toHaveAttribute('href', '/app/a-meal')
    expect(screen.getByRole('link', { name: /Cecilias läslista/ })).toHaveAttribute('href', '/a/laslista-bbbbbb')
    expect(screen.queryByRole('link', { name: 'Ändra Cecilias läslista' })).not.toBeInTheDocument()
  })

  it('says so when the apps cannot be shown', async () => {
    const { api } = fakeApi({ userId: ANNA })
    api.listMyApps.mockRejectedValueOnce(new Error('down'))
    render(<App api={api} storage={memoryStorage()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Det gick inte att visa dina appar just nu.')
  })

  it('offers no ready-made apps to add', async () => {
    setup({ userId: 'ny-person' })
    await screen.findByText('Du har inga appar än.')
    expect(screen.queryByRole('button', { name: /Lägg till/ })).not.toBeInTheDocument()
  })
})

describe('building a new app with words', () => {
  const laxor = {
    ...rawDrop,
    name: 'Läxor',
    collections: [{ id: 'laxor', name: 'Läxor', access: 'edit', fields: [{ id: 'amne', label: 'Ämne', type: 'text' }] }],
    views: [{ id: 'alla', name: 'Alla', type: 'list', collection: 'laxor' }],
    inputs: [{ id: 'ny', name: 'Ny läxa', type: 'form', collection: 'laxor' }],
  }

  async function ask(wish: string) {
    await userEvent.type(await screen.findByLabelText('Vad vill du ha hjälp med?'), wish)
    await userEvent.click(screen.getByRole('button', { name: 'Bygg en app' }))
  }

  it('builds the app with me as owner, shows it in the workshop with what was built and its own address', async () => {
    const { api } = setup({ builds: [{ kind: 'ok', description: laxor, summary: 'Nu kan ni hålla koll på läxor.' }] })
    expect(await screen.findByText('Du har 20 ändringar kvar den här månaden.')).toBeInTheDocument()
    await ask('Vi vill hålla koll på läxor')
    expect(api.buildApp).toHaveBeenCalledWith('Vi vill hålla koll på läxor')
    expect(await screen.findByRole('heading', { name: 'Läxor' })).toBeInTheDocument()
    expect(window.location.pathname).toMatch(/^\/app\/a-new-/)
    expect(screen.getByRole('status', { name: 'Ändringen' })).toHaveTextContent('Nu kan ni hålla koll på läxor.')
    expect(screen.getByRole('link', { name: 'Öppna appen' })).toHaveAttribute('href', expect.stringMatching(/^\/a\/a-new-/))
    expect(screen.queryByRole('button', { name: 'Ångra' })).not.toBeInTheDocument()
  })

  it('keeps the text and explains when my month is used up', async () => {
    setup({ remaining: 0, builds: [{ kind: 'limit', reason: 'quota', retryAt: '2026-11-30T23:00:00Z' }] })
    expect(await screen.findByText('Du har inga ändringar kvar den här månaden.')).toBeInTheDocument()
    await ask('En app för läxor')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Dina ändringar för den här månaden är slut. De fylls på den 1 december.',
    )
    expect(screen.getByLabelText('Vad vill du ha hjälp med?')).toHaveValue('En app för läxor')
  })

  it.each([
    ['paused', 'Byggandet är pausat en stund. Dina appar fungerar som vanligt.'],
    ['too-long', 'Skriv lite kortare, högst 2 000 tecken.'],
  ] as const)('explains a stop for %s', async (reason, message) => {
    setup({ builds: [{ kind: 'limit', reason, retryAt: null }] })
    await ask('En app')
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })

  it('says when to try again after too many wishes', async () => {
    setup({ builds: [{ kind: 'limit', reason: 'rate-person', retryAt: '2026-11-17T09:42:00Z' }] })
    await ask('En app')
    expect(await screen.findByRole('alert')).toHaveTextContent('Försök igen efter kl. 10:42.')
  })

  it('tells honestly what is not possible and that the wish is saved', async () => {
    setup({
      builds: [{ kind: 'not-possible', summary: 'Pailo kan inte skicka sms.', notPossible: [{ wish: 'skicka sms', nearest: 'En lista att bocka av' }] }],
    })
    await ask('skicka sms till barnen')
    const answer = await screen.findByRole('status')
    expect(answer).toHaveTextContent('Det här kan Pailo inte göra än:')
    expect(answer).toHaveTextContent('Det närmaste som går: En lista att bocka av')
    expect(answer).toHaveTextContent('Vi har sparat önskemålet.')
  })

  it('says so when it did not work, without technical words', async () => {
    setup({ builds: [{ kind: 'failed' }] })
    await ask('En app')
    expect(await screen.findByRole('alert')).toHaveTextContent('Det gick inte den här gången.')
  })

  it('sends a wish only once on a double tap and locks the field while building', async () => {
    let finish: (value: { kind: 'failed' }) => void = () => {}
    const { api } = setup()
    api.buildApp.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)))
    await userEvent.type(await screen.findByLabelText('Vad vill du ha hjälp med?'), 'En app')
    await userEvent.dblClick(screen.getByRole('button', { name: 'Bygg en app' }))
    expect(api.buildApp).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Bygger …' })).toBeDisabled()
    expect(screen.getByLabelText('Vad vill du ha hjälp med?')).toBeDisabled()
    await act(async () => finish({ kind: 'failed' }))
    expect(screen.getByRole('button', { name: 'Bygg en app' })).toBeEnabled()
  })
})

describe('an app in the workshop', () => {
  it('is only for its owner: a member is sent to the app\'s own address and sees no way to change it', async () => {
    setup({ userId: BERTIL }, '/app/a-meal')
    await waitFor(() => expect(window.location.pathname).toBe('/a/matschema-k3f9qa'))
    expect(await screen.findByRole('heading', { name: 'Matschema' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ändra appen' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Vad vill du ändra?')).not.toBeInTheDocument()
  })

  it('says it cannot find an app the person is not in, and shows nothing of it', async () => {
    setup({}, '/app/a-other')
    expect(await screen.findByRole('heading', { name: 'Appen kunde inte hittas' })).toBeInTheDocument()
    expect(screen.queryByText('Hemlig')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Till mina appar' }))
    expect(await screen.findByRole('heading', { name: 'Mina appar' })).toBeInTheDocument()
  })
})

describe('sharing an app', () => {
  async function openSharing() {
    const result = setup({}, '/app/a-meal')
    await userEvent.click(await screen.findByRole('button', { name: 'Dela appen' }))
    return result
  }

  it('shows who is in the app, with the owner marked', async () => {
    await openSharing()
    const list = within((await screen.findByText('Bertil')).closest('ul')!)
    expect(list.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      expect.stringMatching(/^Anna\(du\)ägare/),
      expect.stringMatching(/^Bertil/),
    ])
  })

  it('gives a link to the app\'s own address that lasts 3 days, works once and only gives this app', async () => {
    const { api } = await openSharing()
    await userEvent.click(screen.getByRole('button', { name: 'Skapa inbjudningslänk' }))
    expect(api.createInviteLink).toHaveBeenCalledWith('a-meal', 'matschema-k3f9qa')
    expect(await screen.findByLabelText('Inbjudningslänk')).toHaveValue(
      'http://localhost:5173/a/matschema-k3f9qa/inbjudan#hemlig-1',
    )
    expect(screen.getByText(/ger tillgång till Matschema och inget annat\. Den gäller i 3 dagar och kan användas en gång\./)).toBeInTheDocument()
  })

  it('lists links not used yet and closes one', async () => {
    const { api, state } = await openSharing()
    await userEvent.click(screen.getByRole('button', { name: 'Skapa inbjudningslänk' }))
    expect(await screen.findByRole('heading', { name: 'Länkar som inte har använts' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Stäng länken' }))
    expect(api.revokeInvite).toHaveBeenCalledWith('i-1')
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Länkar som inte har använts' })).not.toBeInTheDocument())
    expect(state.invites[0].revoked).toBe(true)
  })

  it('removes a member after asking, and keeps them when the owner changes their mind', async () => {
    const { api, state } = await openSharing()
    await userEvent.click(await screen.findByRole('button', { name: 'Ta bort' }))
    await userEvent.click(screen.getByRole('button', { name: 'Avbryt' }))
    expect(api.removeMember).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Ta bort' }))
    expect(screen.getByText('Ta bort Bertil från appen?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ja, ta bort' }))
    expect(api.removeMember).toHaveBeenCalledWith('a-meal', BERTIL)
    await waitFor(() => expect(screen.queryByText('Bertil')).not.toBeInTheDocument())
    expect(state.apps[0].members).toEqual([anna])
  })

  it('offers no way to remove the owner', async () => {
    await openSharing()
    await screen.findByText('Bertil')
    expect(screen.getAllByRole('button', { name: 'Ta bort' })).toHaveLength(1)
  })

  it('lets the owner change their own name in the app', async () => {
    const { api } = await openSharing()
    await userEvent.click(await screen.findByRole('button', { name: 'Ändra ditt namn' }))
    const field = screen.getByLabelText('Ditt namn i appen')
    await userEvent.clear(field)
    await userEvent.type(field, 'Mamma')
    await userEvent.click(screen.getByRole('button', { name: 'Spara' }))
    expect(api.updateDisplayName).toHaveBeenCalledWith('a-meal', 'Mamma')
    expect(await screen.findByText('Mamma')).toBeInTheDocument()
  })
})

describe('downloading an app', () => {
  it('explains before downloading that the file holds everyone\'s records and works without network', async () => {
    setup({}, '/app/a-meal')
    await userEvent.click(await screen.findByRole('button', { name: 'Ladda ned' }))
    const panel = within(screen.getByRole('region', { name: 'Ladda ned Matschema' }))
    expect(panel.getByText(/fungerar utan nätverk och utan Pailo/)).toBeInTheDocument()
    expect(panel.getByText(/också det andra har skrivit/)).toBeInTheDocument()
  })

  it('puts the app, its records and members into the standalone page and saves it under the app\'s name', async () => {
    const { api, state } = fakeApi({ userId: ANNA, apps: [fakeApp('a-meal', [anna, bertil], rawMealPlan)] })
    state.records = [
      { id: 'r1', appId: 'a-meal', collection: 'ratter', data: { namn: '</script>' }, createdBy: BERTIL, createdAt: 'x', updatedAt: 'x' },
    ]
    const save = vi.fn()
    const template = '<html><head><title>App</title></head><body><script type="application/json" id="pailo-data"></script></body></html>'
    render(<Download api={api} appId="a-meal" name="Matschema" fetchTemplate={async () => template} save={save} />)

    await userEvent.click(screen.getByRole('button', { name: 'Ladda ned' }))

    expect(await screen.findByText('Filen är nedladdad.')).toBeInTheDocument()
    const [name, contents] = save.mock.calls[0] as [string, string]
    expect(name).toBe('Matschema.html')
    expect(contents).toContain('<title>Matschema</title>')
    expect(contents).toContain('\\u003c/script\\u003e')
    const data = JSON.parse(/id="pailo-data">(.*)<\/script>/.exec(contents)![1])
    expect(data.members).toEqual([
      { id: ANNA, displayName: 'Anna', owner: true },
      { id: BERTIL, displayName: 'Bertil', owner: false },
    ])
    expect(state.exports).toEqual(['a-meal'])
  })

  it('says so when the download is refused', async () => {
    const { api } = fakeApi({ userId: BERTIL, apps: [fakeApp('a-meal', [anna, bertil], rawMealPlan)] })
    const save = vi.fn()
    render(<Download api={api} appId="a-meal" name="Matschema" fetchTemplate={async () => ''} save={save} />)
    await userEvent.click(screen.getByRole('button', { name: 'Ladda ned' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Det gick inte att ladda ned appen just nu.')
    expect(save).not.toHaveBeenCalled()
  })
})

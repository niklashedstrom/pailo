import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { fakeApi, memoryStorage } from './test-helpers'

const familjen = { id: 'h-1', name: 'Familjen', role: 'admin' as const }
const members = {
  'h-1': [
    { userId: 'u-1', displayName: 'Niklas', role: 'admin' as const },
    { userId: 'u-2', displayName: 'Mamma', role: 'member' as const },
  ],
}

describe('signing in', () => {
  it('sends a link and tells the person to check their email', async () => {
    const { api } = fakeApi()
    render(<App api={api} storage={memoryStorage()} />)

    await userEvent.type(await screen.findByLabelText('Din e-postadress'), ' mamma@example.se ')
    await userEvent.click(screen.getByRole('button', { name: 'Skicka länk' }))

    expect(api.sendSignInLink).toHaveBeenCalledWith('mamma@example.se')
    expect(await screen.findByRole('heading', { name: 'Kolla din mejl' })).toBeInTheDocument()
    expect(screen.getByText('mamma@example.se')).toBeInTheDocument()
  })

  it('says so when the link could not be sent', async () => {
    const { api } = fakeApi()
    api.sendSignInLink.mockRejectedValueOnce(new Error('rate limit'))
    render(<App api={api} storage={memoryStorage()} />)

    await userEvent.type(await screen.findByLabelText('Din e-postadress'), 'a@example.se')
    await userEvent.click(screen.getByRole('button', { name: 'Skicka länk' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Det gick inte att skicka länken')
  })

  it('shows the household once the person is signed in', async () => {
    const { api, state } = fakeApi({ households: [familjen], members })
    render(<App api={api} storage={memoryStorage()} />)
    await screen.findByLabelText('Din e-postadress')

    state.userId = 'u-1'
    act(() => api.onUserChange.mock.calls[0][0]('u-1'))

    expect(await screen.findByRole('heading', { name: 'Familjen' })).toBeInTheDocument()
  })
})

describe('signing out', () => {
  it('returns to the sign-in page', async () => {
    const { api } = fakeApi({ userId: 'u-1', households: [familjen], members })
    render(<App api={api} storage={memoryStorage()} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Logga ut' }))

    expect(api.signOut).toHaveBeenCalled()
    expect(await screen.findByLabelText('Din e-postadress')).toBeInTheDocument()
  })
})

describe('first time', () => {
  it('asks for the household name and then shows the household', async () => {
    const { api } = fakeApi({ userId: 'u-1' })
    render(<App api={api} storage={memoryStorage()} />)

    await userEvent.type(await screen.findByLabelText('Hushållets namn'), 'Familjen Hedström')
    await userEvent.click(screen.getByRole('button', { name: 'Skapa hushåll' }))

    expect(api.createHousehold).toHaveBeenCalledWith('Familjen Hedström')
    expect(await screen.findByRole('heading', { name: 'Familjen Hedström' })).toBeInTheDocument()
  })
})

/** The member list row that shows the given name. */
function rowWith(name: string) {
  const row = screen.getAllByRole('listitem').find((item) => within(item).queryByText(name) !== null)
  if (row === undefined) throw new Error(`No member row with ${name}`)
  return row
}

describe('the household', () => {
  it('shows its name and members', async () => {
    const { api } = fakeApi({ userId: 'u-1', households: [familjen], members })
    render(<App api={api} storage={memoryStorage()} />)

    expect(await screen.findByRole('heading', { name: 'Familjen' })).toBeInTheDocument()
    expect(await screen.findByText('Niklas')).toBeInTheDocument()
    expect(screen.getByText('Mamma')).toBeInTheDocument()
    expect(screen.getByText('administratör')).toBeInTheDocument()
  })

  it('lets a person in several households choose which one to see', async () => {
    const other = { id: 'h-2', name: 'Sommarstugan', role: 'member' as const }
    const { api } = fakeApi({ userId: 'u-1', households: [familjen, other], members })
    render(<App api={api} storage={memoryStorage()} />)

    await userEvent.selectOptions(await screen.findByLabelText('Visa hushåll'), 'h-2')

    expect(await screen.findByRole('heading', { name: 'Sommarstugan' })).toBeInTheDocument()
    expect(api.listMembers).toHaveBeenLastCalledWith('h-2')
  })

  it('lets a member change their own name', async () => {
    const { api } = fakeApi({ userId: 'u-2', households: [{ ...familjen, role: 'member' }], members })
    render(<App api={api} storage={memoryStorage()} />)

    await screen.findByText('Niklas')
    const buttons = screen.getAllByRole('button', { name: 'Ändra namn' })
    expect(buttons).toHaveLength(1)
    expect(screen.getByText('Mamma')).toContainElement(buttons[0])

    await userEvent.click(buttons[0])
    const input = screen.getByLabelText('Ditt namn')
    expect(input).toHaveValue('Mamma')
    expect(input).toHaveFocus()
    await userEvent.clear(input)
    await userEvent.type(input, '  Pappa ')
    await userEvent.click(screen.getByRole('button', { name: 'Spara' }))

    expect(api.updateDisplayName).toHaveBeenCalledWith('h-1', 'Pappa')
    expect(await screen.findByText('Pappa')).toBeInTheDocument()
    expect(screen.queryByText('Mamma')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Ditt namn')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Namnet är sparat.')
    expect(screen.getByRole('button', { name: 'Ändra namn' })).toHaveFocus()
    expect(rowWith('Pappa')).toHaveTextContent('(du)')
  })

  it("marks the person's own name with (du)", async () => {
    const { api } = fakeApi({ userId: 'u-2', households: [{ ...familjen, role: 'member' }], members })
    render(<App api={api} storage={memoryStorage()} />)

    await screen.findByText('Niklas')
    expect(within(rowWith('Mamma')).getByText('(du)')).toBeInTheDocument()
    expect(rowWith('Niklas')).not.toHaveTextContent('(du)')
    expect(screen.getAllByText('(du)')).toHaveLength(1)
  })

  it('marks the signed-in person, not the admin', async () => {
    const { api } = fakeApi({ userId: 'u-1', households: [familjen], members })
    render(<App api={api} storage={memoryStorage()} />)

    await screen.findByText('Niklas')
    expect(rowWith('Niklas')).toHaveTextContent('Niklas(du)administratör')
    expect(rowWith('Mamma')).not.toHaveTextContent('(du)')
    expect(screen.getAllByText('(du)')).toHaveLength(1)
  })

  it('says so when the name could not be saved', async () => {
    const { api } = fakeApi({ userId: 'u-2', households: [{ ...familjen, role: 'member' }], members })
    api.updateDisplayName.mockRejectedValueOnce(new Error('offline'))
    render(<App api={api} storage={memoryStorage()} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Ändra namn' }))
    const input = screen.getByLabelText('Ditt namn')
    await userEvent.clear(input)
    await userEvent.type(input, 'Pappa')
    await userEvent.click(screen.getByRole('button', { name: 'Spara' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Det gick inte att spara namnet. Försök igen.')
    expect(screen.getByText('Mamma')).toBeInTheDocument()
    expect(screen.queryByText('Pappa')).not.toBeInTheDocument()

    await userEvent.type(input, '!')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not save an empty name', async () => {
    const { api } = fakeApi({ userId: 'u-2', households: [{ ...familjen, role: 'member' }], members })
    render(<App api={api} storage={memoryStorage()} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Ändra namn' }))
    const input = screen.getByLabelText('Ditt namn')
    expect(input).toHaveAttribute('maxLength', '80')

    await userEvent.clear(input)
    expect(screen.getByRole('button', { name: 'Spara' })).toBeDisabled()
    await userEvent.type(input, '   ')
    expect(screen.getByRole('button', { name: 'Spara' })).toBeDisabled()
    await userEvent.type(input, '{Enter}')
    expect(api.updateDisplayName).not.toHaveBeenCalled()
  })

  it('can be cancelled', async () => {
    const { api } = fakeApi({ userId: 'u-2', households: [{ ...familjen, role: 'member' }], members })
    render(<App api={api} storage={memoryStorage()} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Ändra namn' }))
    await userEvent.click(screen.getByRole('button', { name: 'Avbryt' }))
    expect(screen.getByRole('button', { name: 'Ändra namn' })).toHaveFocus()

    expect(screen.queryByLabelText('Ditt namn')).not.toBeInTheDocument()
    expect(api.updateDisplayName).not.toHaveBeenCalled()
  })

  it('lets an admin rename the household', async () => {
    const { api } = fakeApi({ userId: 'u-1', households: [familjen], members })
    render(<App api={api} storage={memoryStorage()} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Byt namn på hushållet' }))
    const input = screen.getByLabelText('Hushållets namn')
    expect(input).toHaveValue('Familjen')
    expect(input).toHaveFocus()
    await userEvent.clear(input)
    await userEvent.type(input, '  Familjen Hedström ')
    await userEvent.click(screen.getByRole('button', { name: 'Spara' }))

    expect(api.renameHousehold).toHaveBeenCalledWith('h-1', 'Familjen Hedström')
    expect(await screen.findByRole('heading', { name: 'Familjen Hedström' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Hushållets namn')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Namnet är sparat.')
    expect(screen.getByRole('button', { name: 'Byt namn på hushållet' })).toHaveFocus()
  })

  it('does not offer renaming to members who are not admin', async () => {
    const { api } = fakeApi({ userId: 'u-2', households: [{ ...familjen, role: 'member' }], members })
    render(<App api={api} storage={memoryStorage()} />)

    await screen.findByText('Niklas')
    expect(screen.queryByRole('button', { name: 'Byt namn på hushållet' })).not.toBeInTheDocument()
  })

  it('keeps showing the same household after renaming it', async () => {
    const stugan = { id: 'h-2', name: 'Sommarstugan', role: 'admin' as const }
    const { api } = fakeApi({ userId: 'u-1', households: [familjen, stugan], members })
    render(<App api={api} storage={memoryStorage()} />)

    await screen.findByRole('heading', { name: 'Familjen' })
    await userEvent.click(screen.getByRole('button', { name: 'Byt namn på hushållet' }))
    const input = screen.getByLabelText('Hushållets namn')
    await userEvent.clear(input)
    await userEvent.type(input, 'Vårt hem')
    await userEvent.click(screen.getByRole('button', { name: 'Spara' }))

    expect(await screen.findByRole('heading', { name: 'Vårt hem' })).toBeInTheDocument()
    const select = screen.getByLabelText('Visa hushåll')
    expect(select).toHaveValue('h-1')
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['Sommarstugan', 'Vårt hem'])
    expect(api.listHouseholds).toHaveBeenCalledTimes(1)
  })

  it('says so when the household could not be renamed', async () => {
    const { api } = fakeApi({ userId: 'u-1', households: [familjen], members })
    api.renameHousehold.mockRejectedValueOnce(new Error('offline'))
    render(<App api={api} storage={memoryStorage()} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Byt namn på hushållet' }))
    const input = screen.getByLabelText('Hushållets namn')
    await userEvent.clear(input)
    await userEvent.type(input, 'Familjen Hedström')
    await userEvent.click(screen.getByRole('button', { name: 'Spara' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Det gick inte att byta namn. Försök igen.')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Familjen')
    expect(screen.queryByRole('heading', { name: 'Familjen Hedström' })).not.toBeInTheDocument()
  })

  it('does not save an empty household name', async () => {
    const { api } = fakeApi({ userId: 'u-1', households: [familjen], members })
    render(<App api={api} storage={memoryStorage()} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Byt namn på hushållet' }))
    const input = screen.getByLabelText('Hushållets namn')
    expect(input).toHaveAttribute('maxLength', '80')

    await userEvent.clear(input)
    expect(screen.getByRole('button', { name: 'Spara' })).toBeDisabled()
    await userEvent.type(input, '   ')
    expect(screen.getByRole('button', { name: 'Spara' })).toBeDisabled()
    await userEvent.type(input, '{Enter}')
    expect(api.renameHousehold).not.toHaveBeenCalled()
  })
})

describe('inviting', () => {
  it('gives an admin a link that lasts 3 days and works once', async () => {
    const { api } = fakeApi({ userId: 'u-1', households: [familjen], members })
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<App api={api} storage={memoryStorage()} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Skapa inbjudningslänk' }))

    expect(api.createInviteLink).toHaveBeenCalledWith('h-1')
    expect(await screen.findByText('Länken gäller i 3 dagar och kan användas en gång.')).toBeInTheDocument()
    expect(screen.getByLabelText('Inbjudningslänk')).toHaveValue('http://localhost:5173/inbjudan#hemlig')

    await userEvent.click(screen.getByRole('button', { name: 'Kopiera länk' }))
    expect(writeText).toHaveBeenCalledWith('http://localhost:5173/inbjudan#hemlig')
    expect(await screen.findByRole('button', { name: 'Kopierad' })).toBeInTheDocument()
  })

  it('is not offered to members who are not admin', async () => {
    const { api } = fakeApi({ userId: 'u-2', households: [{ ...familjen, role: 'member' }], members })
    render(<App api={api} storage={memoryStorage()} />)

    await screen.findByText('Niklas')
    expect(screen.queryByRole('button', { name: 'Skapa inbjudningslänk' })).not.toBeInTheDocument()
  })
})

describe('opening an invite link', () => {
  it('tells a signed-out person they are invited, and joins after signing in', async () => {
    const { api, state } = fakeApi({ members })
    const storage = memoryStorage({ 'pailo.invite': 'hemlig' })
    api.acceptInvite.mockImplementation(async () => {
      state.households = [{ ...familjen, role: 'member' }]
      return { ok: true, householdId: 'h-1' }
    })
    render(<App api={api} storage={storage} />)

    expect(await screen.findByText(/Du har blivit inbjuden/)).toBeInTheDocument()

    state.userId = 'u-2'
    act(() => api.onUserChange.mock.calls[0][0]('u-2'))

    expect(await screen.findByRole('heading', { name: 'Familjen' })).toBeInTheDocument()
    expect(api.acceptInvite).toHaveBeenCalledWith('hemlig')
    expect(storage.values.has('pailo.invite')).toBe(false)
  })

  it('opens the household the person just joined', async () => {
    const other = { id: 'h-0', name: 'Annat hushåll', role: 'admin' as const }
    const { api } = fakeApi({ userId: 'u-2', households: [other, { ...familjen, role: 'member' }], members })
    api.acceptInvite.mockResolvedValue({ ok: true, householdId: 'h-1' })
    render(<App api={api} storage={memoryStorage({ 'pailo.invite': 'hemlig' })} />)

    expect(await screen.findByRole('heading', { name: 'Familjen' })).toBeInTheDocument()
  })

  it('explains in plain Swedish when the link no longer works', async () => {
    const { api } = fakeApi({ userId: 'u-2' })
    const storage = memoryStorage({ 'pailo.invite': 'gammal' })
    render(<App api={api} storage={storage} />)

    expect(await screen.findByRole('heading', { name: 'Länken fungerar inte längre' })).toBeInTheDocument()
    expect(screen.getByText(/Be den som bjöd in dig att skicka en ny länk/)).toBeInTheDocument()
    expect(storage.values.has('pailo.invite')).toBe(false)

    await userEvent.click(screen.getByRole('button', { name: 'Fortsätt till Pailo' }))
    await waitFor(() => expect(screen.getByLabelText('Hushållets namn')).toBeInTheDocument())
  })
})

describe('when something goes wrong', () => {
  it('offers to try again', async () => {
    const { api } = fakeApi({ userId: 'u-1', households: [familjen], members })
    api.listHouseholds.mockRejectedValueOnce(new Error('offline'))
    render(<App api={api} storage={memoryStorage()} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Försök igen' }))

    expect(await screen.findByRole('heading', { name: 'Familjen' })).toBeInTheDocument()
  })
})

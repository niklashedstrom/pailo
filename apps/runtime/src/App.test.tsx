import { act, render, screen, waitFor } from '@testing-library/react'
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

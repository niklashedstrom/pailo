import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import App from '../App'
import type { Member } from '../api'
import { captureInvite } from '../invite'
import { fakeApi, fakeApp, memoryStorage } from '../test-helpers'
import { ANNA, BERTIL, CECILIA, rawDrop, rawMealPlan } from '../test-fixtures'

const anna: Member = { userId: ANNA, displayName: 'Anna', role: 'owner' }
const bertil: Member = { userId: BERTIL, displayName: 'Bertil', role: 'member' }
const SLUG = 'matschema-k3f9qa'
const NOW = new Date(Date.UTC(2026, 10, 11, 10, 0))

afterEach(() => {
  window.history.replaceState(null, '', '/')
  document.title = 'Pailo'
})

function setup(userId: string | null, options: { path?: string; storage?: ReturnType<typeof memoryStorage> } = {}) {
  window.history.replaceState(null, '', options.path ?? `/a/${SLUG}`)
  const storage = options.storage ?? memoryStorage()
  const result = fakeApi({
    userId,
    apps: [
      fakeApp('a-meal', [anna, bertil], { ...rawMealPlan, theme: { preset: 'calm', palette: 'berry' } }, SLUG),
      fakeApp('a-drop', [anna], rawDrop, 'drop-aaaaaa'),
    ],
  })
  result.state.records = [
    { id: 'r1', appId: 'a-meal', collection: 'ratter', data: { namn: 'Lasagne' }, createdBy: ANNA, createdAt: '2026-11-01T10:00:00Z', updatedAt: '2026-11-01T10:00:00Z' },
  ]
  const utils = render(<App api={result.api} storage={storage} now={NOW} />)
  return { ...result, ...utils, storage }
}

describe('the app on its own address', () => {
  it('shows only the app, in its own name, icon and colours, and nothing of Pailo', async () => {
    const { container } = setup(BERTIL)
    expect(await screen.findByRole('heading', { name: 'Matschema' })).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/Pailo|Mina appar|Bygg en app/)
    expect(document.title).toBe('Matschema')
    expect(document.head.querySelector('link[rel="manifest"]')).toHaveAttribute('href', `/a/${SLUG}/manifest.webmanifest`)
    expect(document.head.querySelector('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/icons/food-berry-192.png')
    expect(document.head.querySelector('link[rel="icon"]')).toHaveAttribute('href', '/icons/food-berry-192.png')
  })

  it('keeps the view in its own address', async () => {
    setup(BERTIL)
    await userEvent.click(await screen.findByRole('link', { name: 'Rätter' }))
    expect(window.location.pathname).toBe(`/a/${SLUG}/ratter`)
    expect(await screen.findByText('Lasagne')).toBeInTheDocument()
  })

  it('gives the owner a way to change the app, and a member none', async () => {
    setup(ANNA)
    await userEvent.click(await screen.findByRole('button', { name: 'Meny' }))
    expect(screen.getByRole('link', { name: 'Ändra appen' })).toHaveAttribute('href', '/app/a-meal')
    expect(screen.queryByRole('button', { name: 'Lämna appen' })).not.toBeInTheDocument()
  })

  it("lets a member change their name in the app", async () => {
    const { api } = setup(BERTIL)
    await userEvent.click(await screen.findByRole('button', { name: 'Meny' }))
    expect(screen.queryByRole('link', { name: 'Ändra appen' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ändra ditt namn' }))
    const field = screen.getByLabelText('Ditt namn i Matschema')
    await userEvent.clear(field)
    await userEvent.type(field, 'Pappa')
    await userEvent.click(screen.getByRole('button', { name: 'Spara' }))
    expect(api.updateDisplayName).toHaveBeenCalledWith('a-meal', 'Pappa')
  })

  it('lets a member leave after asking, and then shows nothing of the app', async () => {
    const { state } = setup(BERTIL)
    await userEvent.click(await screen.findByRole('button', { name: 'Meny' }))
    await userEvent.click(screen.getByRole('button', { name: 'Lämna appen' }))
    expect(screen.getByText(/Vill du lämna Matschema\?/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ja, lämna' }))
    expect(await screen.findByText('Du är inte längre med i Matschema.')).toBeInTheDocument()
    expect(screen.queryByText('Lasagne')).not.toBeInTheDocument()
    expect(state.apps[0].members).toEqual([anna])
  })

  it('goes back to Pailo\'s own tab title and icon when the person leaves the app', async () => {
    const { unmount } = setup(BERTIL)
    await screen.findByRole('heading', { name: 'Matschema' })
    unmount()
    expect(document.title).toBe('Pailo')
    expect(document.head.querySelector('link[rel="manifest"]')).toBeNull()
  })
})

describe('signing in on the app\'s own address', () => {
  it('looks like the app, shows none of its content, and brings the person back to it', async () => {
    const { api, container } = setup(null)
    expect(await screen.findByRole('heading', { name: 'Matschema' })).toBeInTheDocument()
    expect(screen.getByText(/för att använda Matschema/)).toBeInTheDocument()
    expect(container.querySelector('.app-screen')!.getAttribute('style')).toContain('--app-accent')
    expect(container.textContent).not.toMatch(/Pailo|Lasagne|Bertil/)
    await userEvent.type(screen.getByLabelText('Din e-postadress'), 'bertil@example.se')
    await userEvent.click(screen.getByRole('button', { name: 'Skicka länk' }))
    expect(api.sendSignInLink).toHaveBeenCalledWith('bertil@example.se', `/a/${SLUG}`)
    expect(api.listRecords).not.toHaveBeenCalled()
  })

  it('says an unknown address leads to no app, and shows nothing else', async () => {
    const { container } = setup(null, { path: '/a/finns-inte-abc123' })
    expect(await screen.findByRole('heading', { name: 'Appen kunde inte hittas' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Din e-postadress')).not.toBeInTheDocument()
    expect(container.textContent).not.toMatch(/Pailo/)
  })
})

describe('someone who is not in the app', () => {
  it('is told they have no access and to ask the owner, and sees nothing of the app', async () => {
    const { container } = setup(CECILIA)
    expect(await screen.findByText('Du har inte tillgång till Matschema.')).toBeInTheDocument()
    expect(screen.getByText('Be den som äger appen om en inbjudan.')).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/Lasagne|Anna|Bertil|Rätter/)
  })

  it('cannot reach an app of the owner that was not shared, even as a member of another', async () => {
    setup(BERTIL, { path: '/a/drop-aaaaaa' })
    expect(await screen.findByText('Du har inte tillgång till Drop.')).toBeInTheDocument()
  })
})

describe('an invite to the app', () => {
  function invited() {
    const storage = memoryStorage()
    captureInvite({ pathname: `/a/${SLUG}/inbjudan`, hash: '#hemlig-1' }, storage, () => {})
    return storage
  }

  it('tells a signed-out person they are invited, and makes them a member once they sign in', async () => {
    const storage = invited()
    const { api, state } = setup(null, { storage })
    state.invites = [
      { id: 'i-1', appId: 'a-meal', token: 'hemlig-1', createdAt: 'x', expiresAt: 'y', used: false, revoked: false },
    ]
    expect(await screen.findByText(/Du har blivit inbjuden till Matschema/)).toBeInTheDocument()

    // The person follows the link in the mail.
    state.userId = CECILIA
    act(() => api.onUserChange.mock.calls.forEach(([callback]) => callback(CECILIA)))

    expect(await screen.findByRole('button', { name: 'Meny' })).toBeInTheDocument()
    expect(state.apps[0].members.map((m) => m.userId)).toEqual([ANNA, BERTIL, CECILIA])
    expect(storage.values.size).toBe(0)
    expect(window.location.pathname).toBe(`/a/${SLUG}`)
  })

  it('explains in plain Swedish when the link no longer works', async () => {
    const storage = invited()
    setup(CECILIA, { storage })
    expect(await screen.findByRole('heading', { name: 'Länken fungerar inte längre' })).toBeInTheDocument()
    expect(screen.getByText(/Be den som bjöd in dig att skicka en ny länk/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Fortsätt' }))
    expect(await screen.findByText('Du har inte tillgång till Matschema.')).toBeInTheDocument()
  })
})

describe('done criterion for M2b, in the runtime', () => {
  it('lets two people with their own accounts share the meal plan on its own address, and keeps a third out', async () => {
    const first = setup(ANNA, { path: `/a/${SLUG}/ratter` })
    expect(await screen.findByText('Lasagne')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ny rätt' }))
    await userEvent.type(screen.getByLabelText(/Namn/), 'Tacos')
    await userEvent.click(screen.getByRole('button', { name: 'Spara' }))
    expect(await screen.findByText('Tacos')).toBeInTheDocument()
    first.unmount()

    first.state.userId = BERTIL
    window.history.replaceState(null, '', `/a/${SLUG}/ratter`)
    const second = render(<App api={first.api} storage={memoryStorage()} now={NOW} />)
    const list = await screen.findByText('Tacos')
    expect(within(list.closest('ul')!).getByText('Lasagne')).toBeInTheDocument()
    expect(second.container.textContent).not.toMatch(/Pailo/)
    second.unmount()

    first.state.userId = CECILIA
    window.history.replaceState(null, '', `/a/${SLUG}/ratter`)
    const third = render(<App api={first.api} storage={memoryStorage()} now={NOW} />)
    expect(await screen.findByText('Du har inte tillgång till Matschema.')).toBeInTheDocument()
    await waitFor(() => expect(third.container.textContent).not.toMatch(/Tacos|Lasagne/))
  })
})

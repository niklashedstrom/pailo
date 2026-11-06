import { vi } from 'vitest'
import type { Household, Member, PailoApi } from './api'

export interface FakeState {
  userId: string | null
  households: Household[]
  members: Record<string, Member[]>
}

/** An in-memory PailoApi; every method is a vi.fn spy. */
export function fakeApi(initial: Partial<FakeState> = {}) {
  const state: FakeState = {
    userId: null,
    households: [],
    members: {},
    ...initial,
  }
  const listeners = new Set<(id: string | null) => void>()

  const api = {
    currentUserId: vi.fn(async () => state.userId),
    onUserChange: vi.fn((callback: (id: string | null) => void) => {
      listeners.add(callback)
      return () => listeners.delete(callback)
    }),
    sendSignInLink: vi.fn(async (_email: string) => {}),
    signOut: vi.fn(async () => {
      state.userId = null
      listeners.forEach((l) => l(null))
    }),
    listHouseholds: vi.fn(async () => state.households),
    createHousehold: vi.fn(async (name: string) => {
      const id = `h-${state.households.length + 1}`
      state.households = [...state.households, { id, name, role: 'admin' }]
      state.members[id] = [{ userId: state.userId ?? 'me', displayName: 'Jag', role: 'admin' }]
      return id
    }),
    listMembers: vi.fn(async (householdId: string) => state.members[householdId] ?? []),
    createInviteLink: vi.fn(async (_householdId: string) => 'http://localhost:5173/inbjudan#hemlig'),
    acceptInvite: vi.fn(async (_token: string) => ({ ok: false }) as Awaited<ReturnType<PailoApi['acceptInvite']>>),
  } satisfies PailoApi

  return { api, state }
}

export function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
    values,
  }
}

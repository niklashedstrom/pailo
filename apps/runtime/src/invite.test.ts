import { describe, expect, it, vi } from 'vitest'
import { inviteLink, readSupabaseConfig } from './api'
import { captureInvite, clearInvite, pendingInvite } from './invite'
import { memoryStorage } from './test-helpers'

describe('captureInvite', () => {
  it('keeps the secret from an invite link and cleans the address', () => {
    const storage = memoryStorage()
    const replaceUrl = vi.fn()

    captureInvite({ pathname: '/inbjudan', hash: '#abc-123_XYZ' }, storage, replaceUrl)

    expect(pendingInvite(storage)).toBe('abc-123_XYZ')
    expect(replaceUrl).toHaveBeenCalledWith('/')
  })

  it('ignores every other address', () => {
    const storage = memoryStorage()
    const replaceUrl = vi.fn()

    captureInvite({ pathname: '/', hash: '#abc' }, storage, replaceUrl)

    expect(pendingInvite(storage)).toBeNull()
    expect(replaceUrl).not.toHaveBeenCalled()
  })

  it('cleans an invite address without a secret', () => {
    const storage = memoryStorage()
    const replaceUrl = vi.fn()

    captureInvite({ pathname: '/inbjudan', hash: '' }, storage, replaceUrl)

    expect(pendingInvite(storage)).toBeNull()
    expect(replaceUrl).toHaveBeenCalledWith('/')
  })

  it('forgets the secret when cleared', () => {
    const storage = memoryStorage({ 'pailo.invite': 'abc' })
    clearInvite(storage)
    expect(pendingInvite(storage)).toBeNull()
  })
})

describe('inviteLink', () => {
  it('puts the secret in the fragment so it never reaches a server', () => {
    expect(inviteLink('https://pailo.se', 'abc')).toBe('https://pailo.se/inbjudan#abc')
  })
})

describe('readSupabaseConfig', () => {
  it('needs both the address and the publishable key', () => {
    expect(readSupabaseConfig({}, 'https://pailo.se')).toBeNull()
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co' }, 'https://pailo.se')).toBeNull()
    expect(
      readSupabaseConfig(
        { VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' },
        'https://pailo.se',
      ),
    ).toEqual({ url: 'https://x.supabase.co', publishableKey: 'sb_publishable_x', origin: 'https://pailo.se' })
  })
})

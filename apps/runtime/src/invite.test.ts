import { describe, expect, it, vi } from 'vitest'
import { inviteLink, readSupabaseConfig } from './api'
import { captureInvite, clearInvite, pendingInvite } from './invite'
import { memoryStorage } from './test-helpers'

describe('captureInvite', () => {
  it('keeps the secret from an invite link and cleans the address to the app', () => {
    const storage = memoryStorage()
    const replaceUrl = vi.fn()

    captureInvite({ pathname: '/a/matschema-k3f9qa/inbjudan', hash: '#abc-123_XYZ' }, storage, replaceUrl)

    expect(pendingInvite(storage, 'matschema-k3f9qa')).toBe('abc-123_XYZ')
    expect(replaceUrl).toHaveBeenCalledWith('/a/matschema-k3f9qa')
  })

  it('only gives the secret to the app it was for', () => {
    const storage = memoryStorage()
    captureInvite({ pathname: '/a/matschema-k3f9qa/inbjudan', hash: '#abc' }, storage, vi.fn())
    expect(pendingInvite(storage, 'drop-aaaaaa')).toBeNull()
  })

  it.each(['/', '/inbjudan', '/a/matschema-k3f9qa', '/a/<x>/inbjudan', '/app/x/inbjudan'])('ignores %s', (pathname) => {
    const storage = memoryStorage()
    const replaceUrl = vi.fn()

    captureInvite({ pathname, hash: '#abc' }, storage, replaceUrl)

    expect(storage.values.size).toBe(0)
    expect(replaceUrl).not.toHaveBeenCalled()
  })

  it('cleans an invite address without a secret', () => {
    const storage = memoryStorage()
    const replaceUrl = vi.fn()

    captureInvite({ pathname: '/a/matschema-k3f9qa/inbjudan', hash: '' }, storage, replaceUrl)

    expect(pendingInvite(storage, 'matschema-k3f9qa')).toBeNull()
    expect(replaceUrl).toHaveBeenCalledWith('/a/matschema-k3f9qa')
  })

  it('forgets the secret when cleared, and ignores something that is not an invite', () => {
    const storage = memoryStorage({ 'pailo.invite': JSON.stringify({ slug: 'x', token: 'abc' }) })
    clearInvite(storage)
    expect(pendingInvite(storage, 'x')).toBeNull()
    expect(pendingInvite(memoryStorage({ 'pailo.invite': 'inte json' }), 'x')).toBeNull()
  })
})

describe('inviteLink', () => {
  it('leads to the app\'s own address with the secret in the fragment, so it never reaches a server', () => {
    expect(inviteLink('https://pailo.se', 'matschema-k3f9qa', 'abc')).toBe('https://pailo.se/a/matschema-k3f9qa/inbjudan#abc')
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

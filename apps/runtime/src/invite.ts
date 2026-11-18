const STORAGE_KEY = 'pailo.invite'
const INVITE = /^\/a\/([a-z0-9]+(?:-[a-z0-9]+)*)\/inbjudan\/?$/

interface Place {
  pathname: string
  hash: string
}

export interface PendingInvite {
  slug: string
  token: string
}

/**
 * When an app is opened from an invite link (/a/<slug>/inbjudan#<secret>),
 * keep the secret and clean the address bar to the app's own address. The
 * secret sits in the fragment, so it is never sent to a server or written
 * to a log. It is kept in localStorage, not sessionStorage, because the
 * sign-in link in the mail usually opens in a new tab; it is cleared as
 * soon as it has been used.
 */
export function captureInvite(
  place: Place,
  storage: Pick<Storage, 'setItem'>,
  replaceUrl: (url: string) => void,
): void {
  const match = INVITE.exec(place.pathname)
  if (!match) return
  const token = place.hash.replace(/^#/, '')
  if (token !== '') storage.setItem(STORAGE_KEY, JSON.stringify({ slug: match[1], token }))
  replaceUrl(`/a/${match[1]}`)
}

/** The invite waiting for this app, if any. */
export function pendingInvite(storage: Pick<Storage, 'getItem'>, slug: string): string | null {
  try {
    const value: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null')
    if (typeof value !== 'object' || value === null) return null
    const { slug: forSlug, token } = value as Partial<PendingInvite>
    return forSlug === slug && typeof token === 'string' && token !== '' ? token : null
  } catch {
    return null
  }
}

export function clearInvite(storage: Pick<Storage, 'removeItem'>): void {
  storage.removeItem(STORAGE_KEY)
}

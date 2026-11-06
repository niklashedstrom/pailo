import { INVITE_PATH } from './api'

const STORAGE_KEY = 'pailo.invite'

interface Place {
  pathname: string
  hash: string
}

/**
 * When the app is opened from an invite link (/inbjudan#<secret>), keep the
 * secret for this browser tab and clean the address bar. The secret sits in
 * the fragment, so it is never sent to a server or written to a log; it
 * survives the sign-in round trip in sessionStorage.
 */
export function captureInvite(
  place: Place,
  storage: Pick<Storage, 'setItem'>,
  replaceUrl: (url: string) => void,
): void {
  if (place.pathname !== INVITE_PATH) return
  const token = place.hash.replace(/^#/, '')
  if (token !== '') storage.setItem(STORAGE_KEY, token)
  replaceUrl('/')
}

export function pendingInvite(storage: Pick<Storage, 'getItem'>): string | null {
  return storage.getItem(STORAGE_KEY)
}

export function clearInvite(storage: Pick<Storage, 'removeItem'>): void {
  storage.removeItem(STORAGE_KEY)
}

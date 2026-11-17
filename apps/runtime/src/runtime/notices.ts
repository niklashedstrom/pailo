import type { Notice } from './Building'

// What the build service just did, carried from the household page to the
// app it opens. Only lives in memory: a reload simply shows the app.
const notices = new Map<string, Notice>()

export function rememberNotice(appId: string, notice: Notice): void {
  notices.set(appId, notice)
}

export function noticeFor(appId: string): Notice | null {
  return notices.get(appId) ?? null
}

export function forgetNotice(appId: string): void {
  notices.delete(appId)
}

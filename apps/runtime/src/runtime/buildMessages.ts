import type { BuildResult, LimitReason, RestoreResult } from '../api'

const time = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', hour: '2-digit', minute: '2-digit' })
const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', day: 'numeric', month: 'long' })

/** Everyday words for every way a wish can be stopped. */
export function limitMessage(reason: LimitReason, retryAt: string | null): string {
  const at = retryAt ? new Date(retryAt) : null
  switch (reason) {
    case 'paused':
      return 'Byggandet är pausat en stund. Dina appar fungerar som vanligt.'
    case 'daily-cap':
      return 'Byggandet är pausat resten av dagen. Försök igen i morgon. Dina appar fungerar som vanligt.'
    case 'too-long':
      return 'Skriv lite kortare, högst 2 000 tecken.'
    case 'rate-person':
      return `Du har gjort många ändringar på kort tid. Försök igen${at ? ` efter kl. ${time.format(at)}` : ' om en stund'}.`
    case 'rate-household':
      return `Hushållet har gjort många ändringar på kort tid. Försök igen${at ? ` efter kl. ${time.format(at)}` : ' om en stund'}.`
    case 'quota':
      return `Hushållets ändringar för den här månaden är slut. De fylls på${at ? ` den ${day.format(at)}` : ' nästa månad'}.`
  }
}

/** The message for a result that did not save anything, or null for 'ok'. */
export function problemMessage(result: BuildResult | RestoreResult): string | null {
  switch (result.kind) {
    case 'ok':
    case 'not-possible':
      return null
    case 'limit':
      return limitMessage(result.reason, result.retryAt)
    case 'not-found':
      return 'Appen kunde inte hittas. Den kan ha tagits bort.'
    case 'failed':
      return 'Det gick inte den här gången. Försök igen, gärna med lite andra ord.'
  }
}

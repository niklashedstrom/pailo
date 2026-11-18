import { type AppFace, faceIconPath, facePalette, PALETTE_TOKENS } from '@pailo/schema'
import { useEffect } from 'react'

const PAILO = { title: 'Pailo', icon: '/favicon.svg', iconType: 'image/svg+xml' }

function link(rel: string): HTMLLinkElement {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!element) {
    element = document.createElement('link')
    element.rel = rel
    document.head.append(element)
  }
  return element
}

function themeColor(): HTMLMetaElement {
  let element = document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (!element) {
    element = document.createElement('meta')
    element.name = 'theme-color'
    document.head.append(element)
  }
  return element
}

/**
 * On the app's own address the browser tab, the home-screen icon and the
 * install manifest are the app's, not Pailo's. Restores Pailo's when the
 * person leaves the app.
 */
export function useAppHead(slug: string, face: AppFace | null): void {
  useEffect(() => {
    if (!face) return
    document.title = face.name
    const icon = link('icon')
    icon.type = 'image/png'
    icon.href = faceIconPath(face, 192)
    link('apple-touch-icon').href = faceIconPath(face, 192)
    link('manifest').href = `/a/${slug}/manifest.webmanifest`
    themeColor().content = PALETTE_TOKENS[facePalette(face.theme)].accent
    return () => {
      document.title = PAILO.title
      icon.type = PAILO.iconType
      icon.href = PAILO.icon
      for (const rel of ['apple-touch-icon', 'manifest']) document.head.querySelector(`link[rel="${rel}"]`)?.remove()
      document.head.querySelector('meta[name="theme-color"]')?.remove()
    }
  }, [slug, face])
}

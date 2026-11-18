import { useEffect, useState } from 'react'

// A deliberately small router with three kinds of address, the same for
// every app; there are never routes per app:
//   /                       Pailo, the workshop: my apps
//   /app/<id>[/<view>]      an app being changed in the workshop (its owner)
//   /a/<slug>[/<view>]      the app on its own address, without Pailo
// Invite links (/a/<slug>/inbjudan#<secret>) are read once at start-up (invite.ts).

export type Route =
  | { kind: 'home' }
  | { kind: 'workshop'; appId: string; viewId?: string }
  | { kind: 'app'; slug: string; viewId?: string }

const SEGMENT = /^[A-Za-z0-9-]+$/

export function parseRoute(pathname: string): Route {
  const parts = pathname.split('/').filter((part) => part !== '')
  const valid = parts.length >= 2 && parts.length <= 3 && parts.slice(1).every((p) => SEGMENT.test(p))
  if (valid && parts[0] === 'app') {
    return parts[2] ? { kind: 'workshop', appId: parts[1], viewId: parts[2] } : { kind: 'workshop', appId: parts[1] }
  }
  if (valid && parts[0] === 'a') {
    return parts[2] ? { kind: 'app', slug: parts[1], viewId: parts[2] } : { kind: 'app', slug: parts[1] }
  }
  return { kind: 'home' }
}

export function routePath(route: Route): string {
  if (route.kind === 'home') return '/'
  const base = route.kind === 'workshop' ? `/app/${encodeURIComponent(route.appId)}` : `/a/${encodeURIComponent(route.slug)}`
  return route.viewId ? `${base}/${encodeURIComponent(route.viewId)}` : base
}

const CHANGE = 'pailo:navigate'

export function navigate(route: Route, options: { replace?: boolean } = {}): void {
  const path = routePath(route)
  if (path === window.location.pathname) return
  if (options.replace) window.history.replaceState(null, '', path)
  else window.history.pushState(null, '', path)
  window.dispatchEvent(new Event(CHANGE))
}

/** The current route; follows navigate(), links and the back button. */
export function useRoute(): Route {
  const [pathname, setPathname] = useState(() => window.location.pathname)
  useEffect(() => {
    const update = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', update)
    window.addEventListener(CHANGE, update)
    return () => {
      window.removeEventListener('popstate', update)
      window.removeEventListener(CHANGE, update)
    }
  }, [])
  return parseRoute(pathname)
}

import { useEffect, useState } from 'react'

// A deliberately small router: the only addresses are the household page and
// an app, optionally with a view. Every app uses the same two patterns; there
// are never routes per app. /inbjudan is handled once at start-up (invite.ts).

export type Route = { kind: 'home' } | { kind: 'app'; appId: string; viewId?: string }

const SEGMENT = /^[A-Za-z0-9-]+$/

export function parseRoute(pathname: string): Route {
  const parts = pathname.split('/').filter((part) => part !== '')
  if (parts[0] === 'app' && parts.length >= 2 && parts.length <= 3 && parts.slice(1).every((p) => SEGMENT.test(p))) {
    return parts[2] ? { kind: 'app', appId: parts[1], viewId: parts[2] } : { kind: 'app', appId: parts[1] }
  }
  return { kind: 'home' }
}

export function routePath(route: Route): string {
  if (route.kind === 'home') return '/'
  const app = `/app/${encodeURIComponent(route.appId)}`
  return route.viewId ? `${app}/${encodeURIComponent(route.viewId)}` : app
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

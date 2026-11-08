import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { Link } from './Link'
import { navigate, parseRoute, routePath, useRoute } from './router'

function Where() {
  const route = useRoute()
  return <p data-testid="where">{routePath(route)}</p>
}

afterEach(() => window.history.replaceState(null, '', '/'))

describe('parseRoute', () => {
  it.each([
    ['/', { kind: 'home' }],
    ['/app/a-1', { kind: 'app', appId: 'a-1' }],
    ['/app/a-1/', { kind: 'app', appId: 'a-1' }],
    ['/app/a-1/veckan', { kind: 'app', appId: 'a-1', viewId: 'veckan' }],
    ['/app', { kind: 'home' }],
    ['/app/a-1/veckan/mer', { kind: 'home' }],
    ['/app/<script>', { kind: 'home' }],
    ['/inbjudan', { kind: 'home' }],
  ])('%s', (path, route) => expect(parseRoute(path)).toEqual(route))

  it('round-trips through routePath', () => {
    const route = { kind: 'app', appId: 'a-1', viewId: 'v-2' } as const
    expect(parseRoute(routePath(route))).toEqual(route)
  })
})

describe('useRoute', () => {
  it('starts from the address after a reload', () => {
    window.history.replaceState(null, '', '/app/a-1/veckan')
    render(<Where />)
    expect(screen.getByTestId('where')).toHaveTextContent('/app/a-1/veckan')
  })

  it('follows navigate and the back button', () => {
    render(<Where />)
    act(() => navigate({ kind: 'app', appId: 'a-1' }))
    expect(screen.getByTestId('where')).toHaveTextContent('/app/a-1')
    expect(window.location.pathname).toBe('/app/a-1')

    act(() => {
      window.history.back()
    })
    // jsdom fires popstate asynchronously; simulate what the browser does.
    act(() => {
      window.history.replaceState(null, '', '/')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(screen.getByTestId('where')).toHaveTextContent('/')
  })

  it('replaces instead of adding to history when asked', () => {
    const before = window.history.length
    render(<Where />)
    act(() => navigate({ kind: 'app', appId: 'a-1', viewId: 'v' }, { replace: true }))
    expect(window.history.length).toBe(before)
    expect(screen.getByTestId('where')).toHaveTextContent('/app/a-1/v')
  })
})

describe('Link', () => {
  it('is a real link that navigates within the page', async () => {
    render(
      <>
        <Link to={{ kind: 'app', appId: 'a-1' }}>Matschema</Link>
        <Where />
      </>,
    )
    const link = screen.getByRole('link', { name: 'Matschema' })
    expect(link).toHaveAttribute('href', '/app/a-1')
    await userEvent.click(link)
    expect(screen.getByTestId('where')).toHaveTextContent('/app/a-1')
  })
})

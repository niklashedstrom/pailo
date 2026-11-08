import { type AnchorHTMLAttributes, type MouseEvent, useCallback } from 'react'
import { type Route, navigate, routePath } from './router'

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { to: Route }

/** A real link (works with open-in-new-tab) that navigates within the page on a plain click. */
export function Link({ to, onClick, ...rest }: LinkProps) {
  const click = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event)
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return
      }
      event.preventDefault()
      navigate(to)
    },
    [onClick, to],
  )
  return <a href={routePath(to)} onClick={click} {...rest} />
}

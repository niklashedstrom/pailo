import { useEffect, useState } from 'react'
import type { MyApp, PailoApi } from '../api'
import { Link } from '../Link'
import { navigate } from '../router'
import { BuildForm } from '../runtime/Building'
import { ICON_EMOJI } from '../runtime/icons'
import { rememberNotice } from '../runtime/notices'

interface Props {
  api: PailoApi
  onSignOut: () => void
}

/**
 * Pailo's own page, the workshop: the person's apps and a way to build a
 * new one. Pailo has no ready-made apps to pick from: the person describes
 * what they need, and the build service builds it from the building blocks.
 */
export default function MyApps({ api, onSignOut }: Props) {
  const [apps, setApps] = useState<MyApp[] | 'failed'>()

  useEffect(() => {
    let active = true
    api.listMyApps().then(
      (list) => active && setApps(list),
      () => active && setApps('failed'),
    )
    return () => {
      active = false
    }
  }, [api])

  const own = Array.isArray(apps) ? apps.filter((app) => app.role === 'owner') : []
  const shared = Array.isArray(apps) ? apps.filter((app) => app.role !== 'owner') : []

  return (
    <>
      <h1>Mina appar</h1>
      <section aria-labelledby="apps-heading">
        <h2 id="apps-heading" className="visually-hidden">
          Appar du har byggt
        </h2>
        {apps === undefined && <p aria-busy="true">Laddar …</p>}
        {apps === 'failed' && <p role="alert">Det gick inte att visa dina appar just nu.</p>}
        {Array.isArray(apps) && apps.length === 0 && <p>Du har inga appar än.</p>}
        {own.length > 0 && (
          <ul className="app-list">
            {own.map((app) => (
              <li key={app.id}>
                <Link to={{ kind: 'app', slug: app.slug }}>
                  <AppIcon app={app} />
                  {app.name}
                </Link>
                <Link className="app-change" to={{ kind: 'workshop', appId: app.id }} aria-label={`Ändra ${app.name}`}>
                  Ändra
                </Link>
              </li>
            ))}
          </ul>
        )}
        <BuildForm
          api={api}
          label="Vad vill du ha hjälp med?"
          hint="Beskriv med egna ord, till exempel: ”Vi vill planera veckans middagar och se vem som lagar maten.”"
          submitLabel="Bygg en app"
          onSubmit={(wish) => api.buildApp(wish)}
          onSaved={(result) => {
            rememberNotice(result.appId, { summary: result.summary, notPossible: result.notPossible })
            navigate({ kind: 'workshop', appId: result.appId })
          }}
        />
      </section>

      {shared.length > 0 && (
        <section aria-labelledby="shared-heading">
          <h2 id="shared-heading">Delade med dig</h2>
          <ul className="app-list">
            {shared.map((app) => (
              <li key={app.id}>
                <Link to={{ kind: 'app', slug: app.slug }}>
                  <AppIcon app={app} />
                  {app.name}
                  {app.ownerName && <span className="hint"> från {app.ownerName}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <button type="button" className="secondary" onClick={onSignOut}>
        Logga ut
      </button>
    </>
  )
}

function AppIcon({ app }: { app: MyApp }) {
  return (
    <span aria-hidden="true" className="app-icon">
      {app.icon ? ICON_EMOJI[app.icon] : '▫️'}
    </span>
  )
}

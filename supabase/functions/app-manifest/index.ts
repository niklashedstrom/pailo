// The install manifest of one app: /a/<slug>/manifest.webmanifest on the
// app's own address is passed here by Vercel. Open to anyone, like the
// app's sign-in page: it shows only the app's name, icon and colour.
import { appManifest, readFace, SLUG } from '../../../packages/schema/src/index.ts'
import { serviceClient } from '../_shared/server.ts'

function notFound(): Response {
  return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}

Deno.serve(async (request) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405 })
  const slug = new URL(request.url).searchParams.get('slug') ?? ''
  if (slug.length > 31 || !SLUG.test(slug)) return notFound()

  const { data, error } = await serviceClient().rpc('app_face', { p_slug: slug }).maybeSingle()
  if (error) {
    console.error('Could not read the app face', error)
    return new Response(null, { status: 500 })
  }
  const face = readFace(data)
  if (!face) return notFound()

  return new Response(JSON.stringify(appManifest(slug, face)), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      // A new name or icon reaches phones within minutes, and unknown names are not cached.
      'Cache-Control': 'public, max-age=300',
    },
  })
})

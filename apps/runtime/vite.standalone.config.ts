// Builds standalone.html: the runtime as ONE html file with every script and
// style inside, for the app a person downloads and opens without network
// and without Pailo. Runs after the main build and adds the file to dist/.
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

/**
 * The downloaded file may run only what is inside it: no requests to any
 * server, no outside scripts, styles, fonts or images. Only in the build,
 * because the development server serves scripts from files.
 */
export const STANDALONE_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'"

function contentSecurityPolicy(): Plugin {
  return {
    name: 'pailo-standalone-csp',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${STANDALONE_CSP}" />`),
  }
}

export default defineConfig({
  plugins: [react(), viteSingleFile({ removeViteModuleLoader: true }), contentSecurityPolicy()],
  // The main build already copies public/ (icons, favicon) into dist/.
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: { input: 'standalone.html' },
  },
})

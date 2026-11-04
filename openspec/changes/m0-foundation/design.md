## Context

Repot innehåller bara dokumentation. Ägaren har 1–2 timmar på vardagar, så verktygskedjan ska vara liten, snabb och utan underhåll. Se proposal.md för motivering.

## Goals / Non-Goals

**Goals:**
- En kedja kod → CI → förhandsvisning → produktion som fungerar från dag ett
- Databastester (pgTAP) i CI redan nu, så att RLS-testerna i M2 bara är nya testfiler

**Non-Goals:**
- Riktig appbeskrivning (M1), tabeller och RLS (M2), PWA och rendering (M3)
- Automatisk migrering till moln-databasen (läggs till när projektet finns, se Open Questions)

## Decisions

- **npm workspaces istället för pnpm/Turborepo.** Följer med Node, inget extra verktyg att installera eller uppgradera. Två paket behöver ingen byggcache. Kan bytas senare utan att påverka koden.
- **Vite-mallens oxlint istället för ESLint.** Snabbt, nollkonfiguration och redan med i Vite-mallen. ESLint-plugins som saknas kan läggas till om behov uppstår.
- **Vitest för all TypeScript-testning.** Samma konfiguration som Vite, fungerar för både schema och React-komponenter (jsdom + Testing Library).
- **`packages/schema` exporterar TypeScript-källan direkt** (`exports` pekar på `src/index.ts`). Inget byggsteg för paketet; Vite och Vitest läser TS direkt.
- **pgTAP mot lokal Supabase i CI** (`supabase db start` + `supabase test db`). Gratis, isolerat och kräver inga hemligheter. Samma kommandon fungerar lokalt.
- **Egna lokala portar (55420–55429)** så att Pailo kan köras parallellt med andra lokala Supabase-projekt.
- **Vercels Git-integration för förhandsvisning och produktion** istället för deploy-steg i GitHub Actions. Ingen token i CI, förhandsvisning per pull request ingår.

## Risks / Trade-offs

- [Nyaste major-versioner (TypeScript 7, Vite 8, Vitest 5) kan ha barnsjukdomar] → Låsta via `package-lock.json`; nedgradera enskilt paket vid problem.
- [Supabase-CLI i CI är låst till en version] → Uppdatera medvetet, samma version lokalt och i CI.
- [Moln-databasen kan glida isär från migreringarna innan automatisk migrering finns] → Inga tabeller finns förrän M2; automatisk migrering införs senast där.

## Migration Plan

Ny kodbas, inget att migrera. Rollback = återställ commit på `main`; Vercel kan även återgå till tidigare deploy.

## Open Questions

- När och hur migreringar körs mot moln-databasen (GitHub Action med `supabase db push` vid merge till `main`, eller Supabase GitHub-integration). Avgörs när Supabase-projektet finns, senast i M2.

# Tasks

## 1. Monorepo och appar

- [x] 1.1 Skapa npm workspaces-monorepo med `apps/*` och `packages/*`; verifiera med `npm install` utan fel
- [x] 1.2 Skapa `apps/runtime` (Vite + React + TS) med svensk startsida och komponenttest; verifiera med `npm test` och `npm run build`
- [x] 1.3 Skapa `packages/schema` med platshållarschema (Zod, `schemaVersion`) och tester för giltig/ogiltig beskrivning; verifiera med `npm test`
- [x] 1.4 Lint och typkontroll i alla paket; verifiera med `npm run lint` och `npm run typecheck`

## 2. Supabase lokalt

- [x] 2.1 Initiera `supabase/` med egna portar (55420–55429); verifiera med `supabase start`
- [x] 2.2 Baslinjemigrering som aktiverar pgTAP och ett röktest; verifiera med `supabase test db`

## 3. CI

- [x] 3.1 GitHub Actions-jobb för lint, typkontroll, tester och bygge
- [x] 3.2 GitHub Actions-jobb som applicerar migreringar och kör pgTAP
- [x] 3.3 Öppna pull request och verifiera att båda CI-jobben är gröna

## 4. OpenSpec

- [x] 4.1 Initiera OpenSpec med projektbeskrivning från `docs/` i `openspec/config.yaml`; verifiera med `openspec validate m0-foundation`

## 5. Molntjänster (kräver ägarens godkännande)

- [ ] 5.1 Skapa eget Supabase-projekt i EU-region på gratisnivån; verifiera att projektet syns i Supabase med region i EU
- [ ] 5.2 Koppla repot till Vercel (gratisnivå) med `apps/runtime` som rotkatalog; verifiera att pull requesten får en förhandsvisningsadress
- [ ] 5.3 Peka pailo.se till Vercel via DNS hos simply.com; verifiera att https://pailo.se visar startsidan

## 6. Klart när

- [ ] 6.1 Slå ihop till `main`; verifiera att CI är grön på `main` och att produktionsadressen visar den tomma appen

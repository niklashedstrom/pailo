## Why

Inget av Pailo går att bygga förrän det finns ett repo med en fungerande kedja från kod till körbar app: monorepo, tester, CI och deploy. M0 lägger den grunden så att varje kommande milstolpe (M1–M5) kan levereras i små steg med `main` alltid grön.

## What Changes

- npm workspaces-monorepo med `apps/runtime`, `packages/schema` och `supabase/`
- `apps/runtime`: tom Vite + React + TypeScript-app med svensk startsida och ett komponenttest
- `packages/schema`: platshållare för appbeskrivningen (Zod) med `schemaVersion`, utan riktig modell (den kommer i M1)
- `supabase/`: lokal konfiguration, baslinjemigrering som aktiverar pgTAP och ett röktest
- GitHub Actions: lint, typkontroll, tester och bygge för appen, samt migreringar + pgTAP mot en lokal databas
- OpenSpec initierat med projektbeskrivning utifrån `docs/`
- Eget Supabase-projekt i EU-region och Vercel med förhandsvisning per pull request (kräver ägarens godkännande, kan kosta pengar)

## Capabilities

### New Capabilities

- `delivery-pipeline`: hur varje ändring kontrolleras och levereras – kontroller som måste passera innan sammanslagning, förhandsvisning per pull request och deploy från `main`.

### Modified Capabilities

(inga)

## Impact

- Nya kataloger: `apps/runtime`, `packages/schema`, `supabase/`, `.github/workflows/`, `openspec/`
- Nya beroenden: React, Vite, Vitest, Testing Library, oxlint, Zod, OpenSpec CLI
- Externa tjänster: GitHub Actions (gratis för publika/små privata repon), Supabase och Vercel (gratisnivåer, kräver godkännande)
- Lokalt: Supabase körs på portarna 55420–55429 för att inte krocka med andra lokala projekt

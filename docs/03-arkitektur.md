# Arkitektur

Varje användarapp är en strukturerad appbeskrivning (JSON) i databasen, inte kod. Vi driftar en enda runtime, oavsett hur många appar som finns.

```
Användare ──► Intervju (chatt i runtime)
                 │
                 ▼
         Byggtjänst (Supabase Edge Function)
           1. kvot + hastighetsgräns + nödbroms
           2. Claude API, strukturerad output
           3. JSON Patch mot appbeskrivningen
           4. Zod-validering
           5. spara som ny version (app_versions) + kostnadslogg
                 │
                 ▼
         Supabase Postgres (EU, RLS per hushåll)
           households · members · apps · app_versions
           records (jsonb) · invites · wishes
                 │
                 ▼
         Runtime (Vite + React + TS, PWA på Vercel)
           renderar alla appar från sin beskrivning
```

AI:n får aldrig skriva direkt till en app. Varje ändring valideras mot schemat och sparas som en ny version, så ångra och "gå tillbaka till i tisdags" ingår från start.

## Delar

- **Appbeskrivning** (`packages/schema`): Zod-schema för samlingar och fält, vyer, inmatning, personer och roller, påminnelser och tema. Har `schemaVersion` och migreringsfunktioner så att gamla appar fungerar när schemat växer.
- **Runtime** (`apps/runtime`): en app som renderar alla användarappar från beskrivningen. Vyer, formulär genererade från fält, tema-tokens, PWA, Web Share Target, bokmärkesknapp.
- **Byggtjänst** (Edge Function): Claude → strukturerad output → JSON Patch → validering → ny version. Inga andra verktyg än att föreslå en patch.
- **Data:** generisk `records`-tabell med jsonb. Nya appar kräver aldrig nya tabeller.
- **Påminnelser:** schemalagd Edge Function som skickar mejl, web push om tiden räcker.

## Stack

- Vite + React + TypeScript på Vercel, förhandsvisning per pull request
- Supabase: Postgres, Auth, RLS, Edge Functions
- GitHub Actions: lint, typkontroll, tester, Supabase-migreringar
- **Eget Supabase-projekt** för det här, skilt från hobbyprojekten, med data i EU
- **Kostnadsmätning:** varje AI-anrop loggas med tokens och hushåll

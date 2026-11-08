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
- **Data:** generisk `records`-tabell med jsonb. Nya appar kräver aldrig nya tabeller. Fältvärdena har ett fast format per fälttyp, och runtime kontrollerar dem med `recordDataSchema` innan de sparas:

  | Fälttyp | Lagrat värde |
  |---|---|
  | text | sträng |
  | datum | `"2026-11-11"`, med tid `"2026-11-11T18:30"` (svensk tid, utan tidszon) |
  | länk | adress som börjar med `https://` eller `http://` |
  | val | alternativets värde, eller en lista om flera får väljas |
  | person | `{ "member": "<användar-id>" }` eller `{ "other": "<person-id>" }`, eller en lista |
  | koppling | id för en post i den kopplade samlingen |
  | bild | inget än (bilder kommer i M3b) |

  Ett fält utan värde saknas i posten. Ett värde som inte följer formatet visas som tomt, utan att resten av posten påverkas.
- **Inga färdiga appar:** runtime känner bara till byggstenarna. Innan byggtjänsten finns lägger utvecklare in handskrivna beskrivningar i den lokala databasen med `npm run dev:app` (se README), som validerar beskrivningen och vägrar skriva till molnet.
- **Påminnelser:** schemalagd Edge Function som skickar mejl, web push om tiden räcker.

## Stack

- Vite + React + TypeScript på Vercel, förhandsvisning per pull request
- Supabase: Postgres, Auth, RLS, Edge Functions
- GitHub Actions: lint, typkontroll, tester, Supabase-migreringar
- **Eget Supabase-projekt** för det här, skilt från hobbyprojekten, med data i EU
- **Kostnadsmätning:** varje AI-anrop loggas med tokens och hushåll

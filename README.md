# Pailo

Vanliga människor ska kunna bygga små appar som gör deras privatliv enklare, utan att förstå hosting, git eller kod. Fokus är privatlivet och hushållet, inte småföretag.

Användaren beskriver ett vardagsproblem med egna ord. AI:n intervjuar, föreslår saker användaren inte tänkt på och bygger appen av en fast uppsättning beprövade byggstenar. Ingen fri kodgenerering: varje app är en strukturerad beskrivning (JSON) som en enda runtime renderar, så varje ändring är säker, kan ångras och fungerar om ett år.

Första användaren är mamma, och hennes första app är familjens matschema.

## Status

M1 (appschemat) och M2 (hushåll, inloggning och behörighet) är klara, se [openspec/specs](openspec/specs). M0 väntar bara på domänen pailo.se. Plan: [docs/06-roadmap.md](docs/06-roadmap.md).

## Dokumentation

| Dokument | Innehåll |
|---|---|
| [01-vision.md](docs/01-vision.md) | Vision, USP, målgrupp, produktprinciper |
| [02-byggstenar-och-flode.md](docs/02-byggstenar-och-flode.md) | Byggstenar, intervju- och designflöde, designsystem |
| [03-arkitektur.md](docs/03-arkitektur.md) | Appbeskrivning, runtime, byggtjänst, datamodell, stack |
| [04-affarsmodell.md](docs/04-affarsmodell.md) | Provperiod, prisnivåer, budget |
| [05-sakerhet.md](docs/05-sakerhet.md) | Skydd mot AI-missbruk, säkerhet i apparna, GDPR |
| [06-roadmap.md](docs/06-roadmap.md) | Faser, grindar och byggsteg M0–M5 |
| [07-risker.md](docs/07-risker.md) | Risker, motåtgärder och öppna frågor |
| [08-namn.md](docs/08-namn.md) | Namnbeslut |

## Stack

Vite + React + TypeScript på Vercel, Supabase (Postgres, Auth, RLS, Edge Functions, EU-region), GitHub Actions, Claude API för intervju och byggtjänst.

## Utveckling

Kräver Node 22+ och Docker (för lokal Supabase).

```sh
npm install
npm run dev          # runtime på http://localhost:5173
npm run lint
npm run typecheck
npm test
supabase start       # lokal databas på portarna 55420–55429
supabase test db     # pgTAP-tester
```

### Logga in lokalt

Runtime pratar med den lokala Supabase. Inloggningsmejlen hamnar i Mailpit i stället för att skickas på riktigt.

1. `supabase start` och kopiera `apps/runtime/.env.example` till `apps/runtime/.env.local`. Fyll i nyckeln `Publishable` från `supabase status`.
2. `npm run dev` och öppna http://localhost:5173.
3. Ange en påhittad e-postadress, till exempel `anna@exempel.se`.
4. Öppna Mailpit på http://127.0.0.1:55424 i samma webbläsare och klicka på länken i mejlet "Logga in i Pailo".
5. Namnge hushållet och tryck på *Skapa inbjudningslänk*. Kopiera länken.
6. Öppna ett privat fönster (eget konto), klistra in länken, logga in som `bertil@exempel.se` via Mailpit i samma privata fönster. Bertil hamnar direkt i Annas hushåll.

Länken i mejlet måste öppnas i samma webbläsare som bad om den. `supabase db reset` tömmer databasen, även testkonton.

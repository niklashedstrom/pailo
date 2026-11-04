# Pailo

Vanliga människor ska kunna bygga små appar som gör deras privatliv enklare, utan att förstå hosting, git eller kod. Fokus är privatlivet och hushållet, inte småföretag.

Användaren beskriver ett vardagsproblem med egna ord. AI:n intervjuar, föreslår saker användaren inte tänkt på och bygger appen av en fast uppsättning beprövade byggstenar. Ingen fri kodgenerering: varje app är en strukturerad beskrivning (JSON) som en enda runtime renderar, så varje ändring är säker, kan ångras och fungerar om ett år.

Första användaren är mamma, och hennes första app är familjens matschema.

## Status

Planering klar. Nästa steg är M0, se [docs/06-roadmap.md](docs/06-roadmap.md).

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

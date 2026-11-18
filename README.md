# Pailo

Vanliga människor ska kunna bygga små appar som gör deras privatliv enklare, utan att förstå hosting, git eller kod. Fokus är privatlivet och hushållet, inte småföretag.

Användaren beskriver ett vardagsproblem med egna ord. AI:n intervjuar, föreslår saker användaren inte tänkt på och bygger appen av en fast uppsättning beprövade byggstenar. Ingen fri kodgenerering: varje app är en strukturerad beskrivning (JSON) som en enda runtime renderar, så varje ändring är säker, kan ångras och fungerar om ett år.

Första användaren är mamma, och hennes första app är familjens matschema.

## Status

M0 (grunden), M1 (appschemat), M2 (inloggning och behörighet), M3 (runtime) och M4 (byggtjänsten) är klara och Pailo finns på https://pailo.se. Man beskriver en app eller en ändring med egna ord, byggtjänsten gör om det till en giltig ny version av appbeskrivningen, och allt kan ångras. Byggandet i molnet är på sedan 17 november 2026. M2b är byggd: varje person har ett eget konto, en app delas med dem ägaren bjuder in, varje app har en egen adress utan Pailo och kan laddas ned som en fil som fungerar utan nätverk. Den räknas som klar när klart-kontrollen efter utrullningen är gjord. Sedan kommer M5 (intervju och design). Kraven finns i [openspec/specs](openspec/specs). Plan: [docs/06-roadmap.md](docs/06-roadmap.md).

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
5. Du hamnar i *Mina appar*. Lägg in en app enligt *Prova en app lokalt* nedan, öppna den med *Ändra*, tryck på *Dela appen* och *Skapa inbjudningslänk*. Kopiera länken.
6. Öppna ett privat fönster (eget konto), klistra in länken och logga in som `bertil@exempel.se` via Mailpit. Bertil hamnar direkt i appen, på dess egen adress.

Länken i mejlet måste öppnas i samma webbläsare som bad om den. `supabase db reset` tömmer databasen, även testkonton.

### Prova en app lokalt

Pailo har inga färdiga appar; användarnas appar byggs av byggstenarna, av byggtjänsten. För att prova runtime utan byggtjänsten kan du lägga in en handskriven beskrivning som en app i den **lokala** databasen. Verktyget validerar beskrivningen först och vägrar att skriva till molnet.

1. Logga in lokalt en gång enligt stegen ovan, så att kontot finns.
2. Lägg in en beskrivning med kontot som ägare:
   ```sh
   npm run dev:app -- anna@exempel.se packages/schema/examples/matschema.json
   ```
   Verktyget skriver ut appens egen adress. Med appens id i stället för en e-postadress sparas filen som en ny version.
3. Prova med två konton: bjud in det andra kontot enligt stegen ovan, öppna appens adress i båda fönstren och ändra i ett av dem. Det andra visar ändringen när du går tillbaka till fliken.
4. Ladda ned appen från verkstaden (*Ladda ned*). Kör `npm run build` först, så att `standalone.html` finns i `apps/runtime/dist`, och starta runtime med `npm run preview -w @pailo/runtime`, eftersom `npm run dev` inte bygger den fristående filen.

Exemplen finns i `packages/schema/examples/`: `drop.json` och `matschema.json` är provexempel, och `alla-byggstenar.json` använder varje byggsten.

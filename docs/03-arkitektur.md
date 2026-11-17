# Arkitektur

Varje användarapp är en strukturerad appbeskrivning (JSON) i databasen, inte kod. Vi driftar en enda runtime, oavsett hur många appar som finns.

```
Användare ──► Pailo, verkstaden (intervju, ändringar, versioner)
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
         Supabase Postgres (EU, RLS per appmedlemskap)
           apps · app_members · app_versions
           records (jsonb) · invites · wishes
                 │
                 ▼
         Runtime (Vite + React + TS, PWA på Vercel)
           varje app på egen adress, utan Pailo runt omkring
                 │
                 ▼
         Exportpaket (runtime + beskrivning + poster)
           körs offline eller på valfri hosting, utan Pailo
```

**Beslut 17 november 2026, genomfört i M2b:** det finns inga hushåll. Konton är per person, en app delas med dem som ägaren bjuder in (`app_members` med rollen `owner` eller `member`), och varje app står på egna ben.

AI:n får aldrig skriva direkt till en app. Varje ändring valideras mot schemat och sparas som en ny version, så ångra och "gå tillbaka till i tisdags" ingår från start.

## Delar

- **Appbeskrivning** (`packages/schema`): Zod-schema för samlingar och fält, vyer, inmatning, personer och roller, påminnelser och tema. Har `schemaVersion` och migreringsfunktioner så att gamla appar fungerar när schemat växer.
- **Runtime** (`apps/runtime`): en app som renderar alla användarappar från beskrivningen. Den har tre sorters adresser, samma för alla appar:
  - `/` är verkstaden, med mina appar;
  - `/app/<id>` är en egen app i verkstaden;
  - `/a/<kortnamn>` är appen på sin egen adress, till exempel `pailo.se/a/matschema-k3f9qa`.

  På sin egen adress har appen eget namn, ikon och tema och visar ingen Pailo-meny. Inloggningen och inbjudan sker där i appens egen stil. Kortnamnet bildas av appens namn och sex slumpade tecken och ändras aldrig. Vyer, formulär genererade från fält och tema-tokens; Web Share Target och bokmärkesknapp kommer i M3b.
- **Installera:** varje app har ett eget manifest på `/a/<kortnamn>/manifest.webmanifest`. Vercel skickar den adressen vidare till funktionen `app-manifest`, som bara läser appens namn, ikon och tema via `app_face`. Ikonerna ritas vid bygget (`npm run icons -w @pailo/scripts`) för varje ikon och palett, med Lucides teckningar.
- **Pailo, verkstaden:** där man skapar appar, ändrar dem med ord, ser versioner, delar appen och laddar ned den. Från appens egen adress leder "Ändra appen" i menyn hit, bara för ägaren.
- **Export:** ägaren kan ladda ned appen som en enda HTML-fil. Bygget gör `standalone.html`: samma runtime med allt inbakat i en fil (`vite.standalone.config.ts`). Funktionen `export` loggar nedladdningen och lämnar ut beskrivningen, posterna och medlemmarnas namn, och verkstaden lägger in dem i filen. Filen sparar ändringar i webbläsaren, behöver ingen server och fungerar offline. Den är för en person på en enhet; delning mellan personer och byggandet kräver Pailo. Filen innehåller ingen kod som genereras per app.
- **Byggtjänst** (Edge Functions `build` och `restore`, kärnan i `packages/schema/src/build`): Claude → strukturerad output → JSON Patch → validering → ny version. Inga andra verktyg än att föreslå en patch. Se avsnittet om byggtjänsten nedan.
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
- **Inga färdiga appar:** runtime känner bara till byggstenarna. För att prova runtime utan byggtjänsten lägger utvecklare in handskrivna beskrivningar i den lokala databasen med `npm run dev:app` (se README). Verktyget validerar beskrivningen och vägrar skriva till molnet.
- **Påminnelser:** schemalagd Edge Function som skickar mejl, web push om tiden räcker.

## Stack

- Vite + React + TypeScript på Vercel, förhandsvisning per pull request
- Supabase: Postgres, Auth, RLS, Edge Functions
- GitHub Actions: lint, typkontroll, tester, Supabase-migreringar
- **Eget Supabase-projekt** för det här, skilt från hobbyprojekten, med data i EU
- **Kostnadsmätning:** varje AI-anrop loggas med tokens, personen som bygger och appen

## Byggtjänsten

Ett önskemål går så här, och inget steg kan hoppas över.

1. **Inloggning och ägarskap.** `build` tar emot `{ appId?, wish }` med personens inloggning. En ändring kräver att personen äger appen; en annans app ser ut som en app som inte finns. En ny app får personen som ägare.
2. **Reservation i databasen.** `reserve_ai_call` kontrollerar under ett lås, i ordning: nödbromsen, dygnstaket (dagens kostnad plus pågående anrop gånger en uppskattning), längden (högst 2 000 tecken), 10 i timmen per person, 30 i timmen per app och personens månadskvot (20 om inget annat är satt). Stoppas önskemålet anropas inte Claude och inget räknas.
3. **Claude.** Byggkärnan (`buildChange`) skickar systemprompten med byggstenarnas regler, schemat och två exempel, cachad, och appens beskrivning och önskemålet som data. Svaret är strukturerat: `summary`, `operations` (JSON Patch) och `not_possible`.
4. **Validering.** Patchen tillämpas på en kopia och resultatet valideras med `parseAppDescription`; en ny app måste också ha en samling, en vy och ett formulär. Är det ogiltigt får Claude ett nytt försök med felen. Två misslyckanden ger ett ärligt besked och inget sparas.
5. **Sparande.** En giltig beskrivning sparas som ny version med sammanfattning och `source = 'build'`, en ny app tillsammans med sin första version i en transaktion. Det som inte gick sparas i `wishes`.
6. **Loggen.** `finish_ai_call` fyller i resultat, modell, tokens och kostnad. Ett anrop som aldrig avslutas räknas som misslyckat efter tio minuter, till uppskattad kostnad.

**Ångra och återställning** (`restore`) sparar en tidigare version, lyft till aktuellt schema, som en ny version med `source = 'restore'`. Claude anropas inte och kvoten påverkas inte. Poster ändras aldrig av byggtjänsten, så data i ett borttaget fält finns kvar och syns igen efter en återställning.

**Modell och kostnad.** Standard är `claude-opus-5-5` med `effort: medium` och server-side fallback. Modellen sätts med `BUILD_MODEL` och `BUILD_EFFORT`. Kostnaden räknas från svarets tokens med pristabellen i `packages/schema/src/build/pricing.ts`; en modell utan pris vägras.

**Tester utan kostnad.** CI kör kärnan med en låtsas-Claude, och funktionerna mot den lokala stacken med `PAILO_FAKE_CLAUDE=1` (`supabase/functions/test.env`), där svaren skickas i själva önskemålet. Låtsasläget fungerar bara mot den lokala stacken.

### Slå på och av byggandet

Byggandet slogs på i molnet 17 november 2026 med standardgränserna: dygnstak 2 US$, 0,25 US$ uppskattat per pågående anrop och 20 byggsamtal per månad. Arbetsytan Pailo hos Anthropic har dessutom ett tak på 20 US$ i månaden. Nyckeln ligger som hemlighet `ANTHROPIC_API_KEY` i Supabase. Gränserna ändras med Supabase SQL-editor eller `psql`:

```sql
-- Slå på (efter att nyckeln är satt med: supabase secrets set ANTHROPIC_API_KEY=...)
update public.ai_settings set paused = false;
-- Nödbroms: pausa allt byggande direkt
update public.ai_settings set paused = true;
-- Dygnstak och uppskattning per pågående anrop, i dollar
update public.ai_settings set daily_cap_usd = 2.00, call_estimate_usd = 0.25;
-- Annan kvot för en person
insert into public.ai_quotas (user_id, monthly_calls) values ('<personens id>', 100)
  on conflict (user_id) do update set monthly_calls = excluded.monthly_calls;
-- Dagens kostnad
select sum(cost_usd) from public.ai_calls where started_at >= date_trunc('day', now() at time zone 'Europe/Stockholm') at time zone 'Europe/Stockholm';
```

Utan nyckel svarar `build` att byggandet är pausat, även om `paused` är av.

## E-post

Inloggningsmejlen skickas via Brevo (EU-baserad, gratisnivå 300 mejl om dagen) från `no-reply@pailo.se` med avsändarnamnet Pailo, över SMTP till `smtp-relay.brevo.com` port 587. Inställningen finns bara i Supabase (Authentication → SMTP), inte i repot. Lokalt fångar Mailpit mejlen.

- **DNS hos Simply.com:** TXT `brevo-code:…` på `pailo.se`, CNAME `brevo1._domainkey` och `brevo2._domainkey` till Brevos DKIM-nycklar, och TXT `_dmarc` med `p=none`.
- **SMTP-nyckeln** `pailo-supabase-sign-in` har ett slutdatum (se Brevo, högst ett år) och slutar dessutom gälla om inget mejl skickas på 90 dagar. Skapa en ny i Brevo under SMTP & API och byt lösenordet i Supabase innan dess, annars kan ingen logga in.

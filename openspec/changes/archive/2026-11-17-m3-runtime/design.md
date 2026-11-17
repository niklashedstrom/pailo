# Design

## Context

Från M1 finns appbeskrivningen (`packages/schema`) med samlingar, fält, vyer, inmatningar och tema som namn från fasta listor, plus `migrateAppDescription` och de handskrivna exemplen i `packages/schema/examples/`. Från M2 finns `apps`, `app_versions` (bara läsbara för klienten, skrivs av servern) och `records` med RLS per hushåll och per samlingens åtkomst. Databasen kontrollerar samling, åtkomst och storlek men inte fältvärdenas innehåll (beslut i M2: det görs i runtime i M3).

Runtime är en Vite/React-app utan router. `App.tsx` växlar mellan inloggning, hushåll och inbjudan, och sidorna pratar bara med gränssnittet `PailoApi`, som ersätts med en fejk i testerna. Vercel skickar redan alla adresser till `index.html`.

Motivering och avgränsning: se proposal.md. Beteendet: se `specs/app-runtime` och `specs/app-data`.

## Goals / Non-Goals

**Goals:**
- En väg från beskrivning till användbar app som M4 och M5 kan bygga vidare på utan omskrivning
- Inget per app: varje vy, fält och tema renderas av samma komponenter utifrån beskrivningen
- Behörighet i gränssnittet som speglar RLS exakt, men där databasen alltid har sista ordet

**Non-Goals:**
- Edge Functions och validering av beskrivningar på servern vid körning (M4, där byggtjänsten behöver dem ändå)
- Ändringar i realtid mellan enheter; poster hämtas om när personen kommer tillbaka till fliken
- Mörkt läge för apparnas teman (Pailos egna sidor påverkas inte)
- PWA, dela-meny, bokmärkesknapp, påminnelser och bilder (M3b)

## Decisions

### 1. Inga färdiga appar; ett lokalt utvecklarskript lägger in beskrivningar

Produkten har inga mallar eller inbyggda appar. Runtime vet bara vad byggstenarna är och läser allt annat ur beskrivningen. För att kunna prova runtime innan byggtjänsten finns får utvecklare skriptet `npm run dev:app -- <hushålls-id> <fil.json>` (`scripts/dev-app.ts`, körs med `tsx`):
1. läser beskrivningen och kör `migrateAppDescription`, och avbryter med felen om den inte validerar
2. hämtar den lokala adressen och service-nyckeln från `supabase status -o env`, och **vägrar** om adressen inte är `127.0.0.1` eller `localhost`
3. skapar raden i `apps` och version 1 i `app_versions` med service-rollen, och skriver ut appens adress

Kör man skriptet igen med en app-id i stället för hushålls-id sparas filen som en ny version, så att det går att prova ändringar och ångra.

**Varför:** kravet är att beskrivningar bara skrivs av servern efter validering. Skriptet validerar och skriver med service-rollen lokalt, och molnet berörs inte. Det behövs ingen ny tabell, funktion eller migrering, och inget i produkten pekar ut en viss app.

**Alternativ:**
- *Mallar i databasen:* avvisat, eftersom produkten ska bygga appar av byggstenar, inte erbjuda färdiga appar.
- *Edge Function som sparar en validerad beskrivning:* det är byggtjänstens skrivväg i M4 och tas där, med kvot och kostnadslogg.
- *`supabase/seed.sql`:* fungerar inte, eftersom hushållen skapas först när någon loggar in.

**Bevis för byggstenarna, inte för två appar:** `packages/schema/examples/alla-byggstenar.json` använder varje fälttyp med sina varianter (`multiline`, `withTime`, `multiple`, `required`), varje vytyp, varje åtkomstnivå, personer utan konto och ett tema med alla tillval. Ett test läser fälttyperna och vytyperna ur schemats unioner och kräver att exemplet täcker dem, så att en ny byggsten inte kan läggas till utan att testas i runtime. Runtime-testerna körs mot detta exempel och mot beskrivningar med påhittade id:n, inte bara mot Drop och matschemat.

### 2. Format för fältvärden och var de kontrolleras

| Fälttyp | Lagrat värde |
|---|---|
| `text` | sträng (högst 10 000 tecken) |
| `date` | `"2026-11-11"`, med tid `"2026-11-11T18:30"` (svensk tid, utan tidszon) |
| `link` | sträng som börjar med `https://` eller `http://` |
| `choice` | `"vego"`, eller `["las-senare", "recept"]` om `multiple` |
| `person` | `{ "member": "<user-uuid>" }` eller `{ "other": "barn-1" }`, eller en lista om `multiple` |
| `reference` | `"<record-uuid>"` |
| `image` | används inte i M3 |

Personer lagras som objekt eftersom en användares uuid också matchar id-mönstret för personer utan konto (`a1b2…` med bindestreck). Datum lagras utan tidszon, eftersom ett matschema handlar om vilken dag det är hemma och inte om en absolut tidpunkt, och hela målgruppen är i Sverige.

`packages/schema` får `recordDataSchema(collection)`, som bygger ett strikt Zod-schema av samlingens fält (okända fält, fel format, val utanför alternativen och tomma obligatoriska fält avvisas). Att en medlem eller kopplad post faktiskt finns kontrolleras inte av schemat: formuläret erbjuder bara de som finns, och visningen hanterar det som saknas. **Alternativ:** kontroll i databasen med en trigger som läser beskrivningen. Det dubblerar Zod-reglerna i SQL och kan glida isär. Det kan läggas till om M4 eller fler klienter kräver det, och databasen begränsar redan form och storlek.

Visningen läser värden med samma schema per fält (`safeParse` fält för fält), så ett trasigt värde blir tomt utan att posten försvinner.

### 3. Adresser med en liten egen router

Adresserna är `/` (hushållet), `/app/<app-id>` och `/app/<app-id>/<vy-id>`. En router på cirka 50 rader ovanpå `history.pushState` och `popstate` räcker, med `<a href>` som fångas för navigering inom sidan. `/inbjudan` läses en gång vid start som i dag.

**Alternativ:** React Router. Det är ett beroende för tre adresser, och M5 kan byta om behovet växer.

### 4. Data för en öppen app

`PailoApi` utökas med:
- `listApps(householdId)`
- `openApp(appId)`, som ger appen och senaste versionen, migrerad och validerad med `migrateAppDescription`; ogiltig ger ett eget utfall
- `listRecords(appId)`
- `createRecord`, `updateRecord`, `deleteRecord`

Alla poster i appen hämtas på en gång (hushållsappar är små) och hämtas om vid `visibilitychange` till synlig och efter egna ändringar. Uppdateringar och borttagningar som RLS tyst inte träffar (0 rader) räknas som nekade, på samma sätt som `updateDisplayName`. Hushållets medlemmar hämtas med befintliga `listMembers` för personfält och visning av namn.

**Alternativ:** Supabase Realtime. Det ger direkt uppdatering men kräver publicering av `records`, RLS-prövning av kanalen och tester av det. Det räcker för klart-kriteriet att Bertil ser ändringen när han kommer tillbaka.

### 5. Komponenter

```
AppScreen (laddar app, poster, medlemmar; sätter tema)
├─ ViewTabs
├─ ListView · CardsView · CalendarView · OverviewView
│    └─ RecordSummary → FieldValue (per fälttyp)
├─ InputButtons (en per form-inmatning)
└─ RecordSheet (visa / ändra / ta bort) → RecordForm → FieldControl (per fälttyp)
```

En `switch` på `view.type` och `field.type`, med TypeScripts kontroll av att alla fall täcks, så att en ny fälttyp eller vytyp inte kan glömmas. Postens titel (i listor och kopplingar) är värdet i samlingens första obligatoriska textfält, annars i första textfältet, annars "Namnlös".

### 6. Behörighet i gränssnittet

En ren funktion `permissions(access, role, createdBy, userId)` ger `canCreate`, `canEdit` och `canDelete` med samma regler som RLS-policyerna i M2. Den testas med samma matris som pgTAP-testerna (edit/add/read × admin/medlem × egen/annans). Gränssnittet döljer knappar, men om databasen ändå nekar visas ett vardagligt fel och formuläret behåller innehållet.

### 7. Tema som tokens i TypeScript

`theme/tokens.ts` har tabeller med fasta värden:
- `PRESETS`: standardvärden per `calm`, `playful` och `strict`
- `PALETTES`: bakgrund, yta, text, dämpad text, kant, accent och text på accent
- `FONTS`: systemtypsnitt per `rounded`, `classic` och `modern`
- `SPACINGS`, `RADII` och `DENSITIES`

`resolveTheme(theme)` slår ihop förinställningen med det beskrivningen anger och ger ett objekt med CSS-variabler (`--app-bg`, `--app-accent` …). Objektet sätts som `style` på appens yttersta element, så temat bara gäller där. Värdena kommer bara ur tabellerna, aldrig ur text i beskrivningen.

**Typsnitt** är systemtypsnitt (ingen nedladdning från Google Fonts), eftersom det ger snabbare start, fungerar utan nät i en framtida PWA och skickar inga besökare till tredje part. **Kontrast:** ett Vitest-test räknar WCAG-kontrasten för varje palett (text mot bakgrund och yta, dämpad text, text på accent) och kräver AA. **Alternativ:** CSS-klasser per temavärde. Det går också, men tabeller i TypeScript går att testa för kontrast direkt.

### 8. Datum, veckor och sortering

Datumsträngar tolkas för hand (`ÅÅÅÅ-MM-DD`) och aldrig med `new Date(sträng)`, som tolkar dem som UTC. Veckan börjar på måndag och namn på dagar och månader kommer från `Intl.DateTimeFormat('sv-SE')`. Sortering jämför text med `localeCompare(…, 'sv')` (så att å, ä och ö hamnar rätt) och datum som strängar. Saknade värden hamnar sist.

### 9. Pausad fabrikskö och roadmap

`factory/backlog.md` får en rubrik "Pausat till efter M3" för hushållsjobben utom "ta bort en medlem" och "lämna hushållet". `docs/06-roadmap.md` delar M3 i M3 (vyer, formulär, tema) och M3b (PWA, dela-meny och bokmärkesknapp, påminnelser, bilder).

## Risks / Trade-offs

- [Fältvärden kontrolleras bara i klienten, så en klient som går förbi runtime kan spara konstiga värden inom storleksgränsen] → Värdet kan bara påverka det egna hushållets data, visningen tål trasiga värden fält för fält och all text visas som text. Kontroll i databasen kan läggas till senare utan att formatet ändras.
- [Runtime anpassas omedvetet efter Drop och matschemat] → Testerna körs mot `alla-byggstenar.json` och påhittade id:n, och kravet förbjuder kod som beror på en viss app.
- [Utvecklarskriptet körs av misstag mot molnet] → Skriptet vägrar allt utom `127.0.0.1` och `localhost`, och service-nyckeln för molnet finns inte på datorn.
- [Ingen realtid, så två personer som ändrar samma post samtidigt skriver över varandra] → Den som sparar sist vinner, vilket är acceptabelt i ett hushåll. Konflikthantering eller realtid tas upp om testarna i fas 2 märker det.
- [Bildfältet i matschemat gör korten mindre lockande] → Ärlig text i formuläret, och bilder ligger först i M3b.
- [Inloggning på pailo.se når bara projektets teammedlemmar tills en egen e-posttjänst finns] → Klart-kriteriet visas lokalt med Mailpit och två konton. Beslutet om e-posttjänst tas separat innan mamma ska använda Pailo.
- [Egen router kan växa] → Den hålls till app och vy. Behövs mer i M5 byts den mot ett bibliotek.

## Migration Plan

1. Ingen migrering: `apps`, `app_versions` och `records` från M2 används som de är, och molndatabasen ändras inte.
2. Runtime driftsätts via Vercel vid merge. Utan appar i hushållet visar pailo.se en tom applista, och inga befintliga anrop ändras.
3. **Återställning:** återställ commit:en. Det finns ingen data att flytta.

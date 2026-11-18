# Proposal

## Why

Den 17 november 2026 bestämde ägaren att hushållet inte ska vara Pailos enhet. Var och en loggar in som sig själv, en app delas med dem som ska använda den, och varje app ska stå på egna ben: egen adress, eget namn och egen ikon, ingen Pailo-meny, och möjlig att ladda ned och köra utan Pailo (docs/01-vision.md, docs/03-arkitektur.md, docs/06-roadmap.md M2b). Koden bygger fortfarande på hushåll i datamodell, RLS, kvoter och gränssnitt. Det måste ändras före M5, annars byggs intervjun och designverktyget ovanpå en modell vi redan har lämnat.

## What Changes

- **BREAKING** Tabellerna `households` och `members` tas bort. Nya `app_members` (roll `owner` eller `member`, visningsnamn per app) säger vem som når en app. Befintliga hushållsappar flyttas över: den som skapade appen blir ägare (annars hushållets äldsta administratör) och hushållets övriga medlemmar blir medlemmar i appen.
- **BREAKING** En inbjudan gäller en app i stället för ett hushåll. Bara appens ägare bjuder in, ser och återkallar inbjudningar och tar bort medlemmar. En medlem kan lämna appen.
- **BREAKING** RLS på `apps`, `app_versions`, `records`, `wishes`, `invites` och `ai_calls` utgår från appmedlemskap. Kolumnen `household_id` tas bort överallt. pgTAP-tester bevisar att en person som inte är medlem i en app varken kan läsa eller skriva något i den.
- **BREAKING** Kvot, hastighetsgränser och kostnadslogg räknas per person: kvoten per byggare och månad, högst 10 önskemål i timmen per person och 30 per app. `ai_quotas` nycklas på person.
- Bara appens ägare kan ändra appen med ord, ångra och gå tillbaka till en tidigare version. Medlemmar använder appen.
- Varje app får en egen adress, `/a/<kortnamn>`. Där visas bara appen: dess namn, ikon och tema, en inloggningssida i appens stil och ett installerbart manifest per app, utan Pailo-meny eller Pailo-namn.
- Pailo på `/` blir verkstaden: mina appar (egna och delade), bygga en ny app, ändra, versioner, bjuda in och hantera medlemmar. Sidorna för att namnge och hantera ett hushåll tas bort.
- Ägaren kan ladda ned appen som en enda fristående HTML-fil med runtime, beskrivning och poster. Den fungerar utan nätverk för en person, och ändringar sparas i webbläsaren. Varje nedladdning loggas.

## Capabilities

### New Capabilities
- `app-sharing`: vem som når en app, ägare och medlemmar, inbjudan per app, ta bort och lämna, och isolering mellan appar bevisad av tester.
- `standalone-app`: appen på egen adress utan Pailo, inloggning i appens stil, installerbart manifest per app, och export som fristående fil som fungerar offline.

### Modified Capabilities
- `households`: alla krav tas bort, ersatta av `app-sharing`.
- `sign-in`: första inloggningen leder till mina appar i stället för att namnge ett hushåll; inbjudan gäller en app; "Se sitt hushåll" ersätts av mina appar.
- `app-data`: appar har en ägare och medlemmar i stället för ett hushåll; ägaren har de rättigheter administratören hade; önskemål och personfält utgår från appen.
- `app-description`: åtkomstnivåerna gäller appens medlemmar, och ägaren kan alltid ändra allt.
- `app-runtime`: applistan blir mina appar i verkstaden, appen öppnas på sin egen adress, knappar efter roll i appen, delning mellan appens medlemmar, och byggfälten finns bara för ägaren.
- `app-builder`: önskemål, ny app, ångra och återställning gäller appar personen äger; önskemål sparas på personen och appen.
- `ai-usage-limits`: kvot, hastighetsgränser och kostnadslogg per person och per app i stället för per hushåll.

## Impact

- **Databas:** en ny migration som flyttar data till `app_members`, skriver om RLS, funktioner och kvotlogik, och tar bort `households`, `members` och `household_id`. Den rullas ut i molnet när PR:en slås ihop, så ägaren slår ihop den. pgTAP-testerna `01`–`05` skrivs om och ett test för isolering mellan appar läggs till.
- **Edge Functions:** `build` och `restore` byter hushåll mot ägarskap. En ny publik funktion `app-face` ger namn, ikon och tema för en app via kortnamnet (inget innehåll), och `app-manifest` ger manifestet per app. Exportfunktionen `export` loggar och lämnar ut beskrivning och poster till ägaren.
- **Runtime:** routern får `/a/<kortnamn>`. Hushållssidorna (`NameHousehold`, `HouseholdPage`) ersätts av verkstaden, `api.ts` byter hushåll mot appar och medlemskap, och en ny ingång bygger den fristående filen. PNG-ikoner per ikon och palett genereras vid bygget.
- **Vercel:** en omskrivning skickar `/a/<kortnamn>/manifest.webmanifest` till `app-manifest`, så manifestet kommer från samma adress som appen.
- **Paket:** `packages/schema` ändrar bara kommentarer och texter om hushåll. Beskrivningens format är oförändrat och ingen ny schemaversion behövs.
- **Dokument:** docs beskriver redan målet. `docs/03-arkitektur.md` och README uppdateras när hushållskoden är borta.
- **Utanför M2b:** Pailo-avsändaren i inloggningsmejlet (det kommer från Supabase Auth och är gemensamt), egen domän per app, en service worker för appen på sin adress, betalning och nivåer, och att dela en app som mall.

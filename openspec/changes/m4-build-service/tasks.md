# Tasks

## 1. Edge Functions går att bygga

- [x] 1.1 Skapa `supabase/functions/build` med `deno.json` som mappar `zod` och `@anthropic-ai/sdk` till `npm:` och importerar `packages/schema/src` relativt, och en funktion som bara svarar "pausat"; verifiera med `supabase functions serve` lokalt och `supabase functions deploy --dry-run` (eller paketering lokalt) att importen utanför `supabase/` följer med. Annars: esbuild till `supabase/functions/_shared/` och ett CI-steg som kontrollerar att filen är aktuell (design beslut 1)
- [x] 1.2 Lägg till Deno-kontroll (`deno check` och `deno lint` för `supabase/functions`) i CI-jobbet för lint och typkontroll; verifiera att CI blir rött av ett medvetet typfel i en funktion

## 2. JSON Patch och byggkärna i schemat

- [x] 2.1 `applyPatch(document, operations)` i `packages/schema` för RFC 6902 (`add`, `remove`, `replace`, `move`, `copy`, `test`, JSON Pointer med `~0`/`~1` och `-` för slutet av en lista), som aldrig ändrar indata och ger ett begripligt fel med operationens index; verifiera med Vitest-tester för varje operation och för felaktiga sökvägar
- [x] 2.2 Grundbeskrivningen för en ny app och `isUsableApp` (validerar och har minst en samling, en vy och ett formulär); verifiera med tester att grundbeskrivningen plus en patch med samling, vy och formulär blir användbar och att grundbeskrivningen ensam inte är det
- [x] 2.3 Systemprompten som genereras från schemat (regler för byggstenarna, JSON Schema, Drop och matschemat som exempel) och schemat för svaret (`summary`, `operations` med `value_json`, `not_possible`); verifiera med ett snapshot-test och ett test att prompten är byte-identisk mellan två anrop (krav för cache)
- [x] 2.4 `buildChange({ description, wish, claude })` enligt design beslut 2–4 och 9: ett anrop, tillämpa, validera, ett nytt försök med felen, summera `usage` och kostnad från pristabellen och avvisa okänd modell; verifiera med tester med låtsasklient: giltigt direkt, giltigt på andra försöket, ogiltigt två gånger, bara `not_possible`, delvis möjligt, fel från klienten och avbrott
- [x] 2.5 Ett test att appens innehåll ligger i användarmeddelandet märkt som data och inte i systemprompten; verifiera med låtsasklienten att ett samlingsnamn med instruktioner aldrig hamnar i `system`

## 3. Skydd och logg i databasen

- [x] 3.1 Migrering med `ai_settings` (en rad, `paused = true`), `ai_quotas` och `ai_calls` med RLS enligt design beslut 5, utan åtkomst för klienter utom läsning av egna hushållets `ai_calls`; verifiera med pgTAP att klienter inte kan läsa eller skriva inställningar och kvoter, att hushåll A inte ser B:s rader och att ingen klient kan skriva i loggen
- [x] 3.2 `private.reserve_ai_call` och `private.finish_ai_call`, körbara bara av `service_role`, med kontrollerna i design beslut 5 (nödbroms, dygnstak med pågående anrop, längd högst 2 000 tecken, 10 i timmen per person, 30 per hushåll, månadskvot, standard 20, och gamla `pending` som `failed`); verifiera med pgTAP för varje skäl, för att sista kvoten bara ges en gång och för att en reservation inte görs när något stoppar
- [x] 3.3 `public.remaining_builds(household)` för medlemmar; verifiera med pgTAP att en medlem får sitt hushålls siffra och att en icke-medlem nekas
- [x] 3.4 Kolumnerna `summary`, `source`, `restored_from` och `ai_call_id` på `app_versions`, gamla rader `developer`, och `dev:app` som sätter `developer`; verifiera med pgTAP att versioner fortfarande inte kan ändras och med `dev:app`-testerna

## 4. Byggtjänsten

- [x] 4.1 Edge Function `build` för ändring av en app: inloggning, medlemskap, reservation, `buildChange`, sparande av ny version med sammanfattning, önskemål i `wishes` och avslut i loggen, med typade utfall (`ok`, `not-possible`, `limit` med skäl och tid, `failed`) och svenska besked utan tekniska ord; verifiera med tester mot lokal Supabase och låtsas-Claude (miljövariabel som bara gäller lokalt) för lyckat, ogiltigt, gräns, annat hushåll och utloggad
- [x] 4.2 Ny app i `build`: skapar `apps` och version 1 i samma transaktion först när beskrivningen är användbar; verifiera med test att en misslyckad ny app inte lämnar någon rad i `apps`
- [x] 4.3 Edge Function `restore` för ångra och återställning: medlemskap, `migrate`, validering, ny version med `source = 'restore'` och `restored_from`, 60 i timmen per person, ingen kvot; verifiera med tester för ångra, återställning till en äldre schemaversion, annat hushåll och att kvoten är oförändrad
- [x] 4.4 Test att poster finns kvar när en samling eller ett fält tas bort och syns igen efter ångra; verifiera i runtime-testerna med fejk-API och i ett integrationstest mot lokal databas
- [x] 4.5 CI rullar ut Edge Functions efter `db push` vid sammanslagning till `main`; verifiera att jobbet hoppar över utrullning i pull requests och att stegen finns i arbetsflödet
- [x] 4.6 Uppdatera `docs/03-arkitektur.md` och `docs/05-sakerhet.md` med byggtjänsten, skydden och hur ägaren slår på och av byggandet; verifiera att SQL-raden i dokumentet fungerar lokalt

## 5. Gränssnitt i runtime

- [x] 5.1 Utöka `PailoApi`, `supabaseApi` och `fakeApi` med `buildApp`, `changeApp`, `restoreVersion`, `listVersions` och `remainingBuilds`; verifiera med tester i `api.test.ts` för varje utfall
- [x] 5.2 Fältet "Vad vill du ha hjälp med?" på hushållssidan, med väntan, låst skicka-knapp, besked och kvar-räknare, som öppnar den nya appen med sammanfattningen; verifiera med `App.test.tsx`-tester för ok, gräns, kvoten slut, pausat, inte möjligt och dubbeltryck
- [x] 5.3 Fältet "Vad vill du ändra?" i appen, med sammanfattning och ångra efter en ändring; verifiera med `AppScreen`-tester för ändring, ångra och att texten finns kvar vid fel
- [x] 5.4 Versionslistan med tid, person, sammanfattning och "Gå tillbaka hit"; verifiera med tester för listan och återställning
- [x] 5.5 Kontrollera i headless Chrome vid 360 px att fälten, beskeden och versionslistan fungerar i alla tre stilarna utan sidledsscroll, och att ingen nyckel finns i det byggda paketet (`grep` efter `sk-ant` i `dist/`); spara skärmbilder i ändringens mapp

## 6. Evals

- [x] 6.1 20 problem i `evals/build/` enligt design beslut 10: ungefär 14 nya appar (bland dem Drop och matschemat från noll), 6 ändringar av exemplen, varav 2 med en del som inte går; verifiera med ett test att alla 20 läses och har giltig form
- [x] 6.2 `npm run eval:build` med obligatoriskt `--max-usd`, `--model`, `--only`, kontroll av taket före varje problem, tabell i terminalen och JSON-fil som git ignorerar; verifiera med låtsasklient att skriptet stannar vid taket och att det vägrar köra utan `--max-usd`
- [ ] 6.3 **Kostar pengar, kräver ägarens klartecken och tak:** kör evals med standardmodellen; verifiera att minst 18 av 20 blir användbara appar och spara en sammanfattning av resultatet (andel, kostnad per byggsamtal, tid) i `evals/build/RESULTAT.md`
- [ ] 6.4 Om under 18: förbättra systemprompten eller felbeskeden i det nya försöket utifrån felen per problem, och kör igen med nytt klartecken; verifiera med en ny körning

## 7. Klart när

- [ ] 7.1 Visa klart-kriteriet: evals-resultatet med minst 18 av 20 och kostnad per byggsamtal, plus en genomgång lokalt där en medlem skapar en app med ord, ändrar den, ångrar och går tillbaka i versionslistan, och där nödbromsen, kvoten och gränsen syns; verifiera med skärmbilder och resultatfilen
- [ ] 7.2 Uppdatera `docs/06-roadmap.md` och statussidan med uppmätt kostnad och vilken modell ägaren valde

## Workflow follow-up

- Ägaren slår ihop PR:en med migreringarna, eftersom de rullas ut till molndatabasen.
- Ägaren sätter nyckeln, dygnstaket och kvoterna i molnet och slår av nödbromsen när byggandet ska öppnas.
- Arkivera ändringen när klart-kriteriet är visat.

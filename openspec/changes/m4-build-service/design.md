# Design

## Context

Se proposal.md för varför. Det som finns i dag och styr lösningen:

- `apps` och `app_versions` (M2): klienter får bara läsa. Versioner kan inte ändras, och löpnumret sätts av en trigger som låser appen, så samtidiga sparningar får olika nummer. Ångra är redan tänkt som "spara en äldre beskrivning som ny version".
- `wishes` (M2): medlemmar kan lägga till och läsa önskemål i sitt hushåll.
- `packages/schema`: `parseAppDescription` validerar form och kopplingar, `migrate` lyfter äldre `schemaVersion`, `appDescriptionJsonSchema()` ger JSON Schema för formen.
- Runtime (M3) läser senaste versionen och visar den. Poster är jsonb, och okända fält eller samlingar påverkar inte resten.
- Inga Edge Functions finns än. CI kör `supabase db push` vid sammanslagning till `main`.
- Budget: högst 10 000 kr fram till betalande användare. Planerade nivåer: 20, 100 eller 300 AI-ändringar per månad.

## Goals / Non-Goals

**Goals:**

- En kärna för byggandet som är **plattformsneutral** (inga Deno- eller Supabase-anrop) och som körs både i Edge Function, i tester med förberedda svar och i evals-skriptet. Då mäter evals samma kod som användarna kör.
- Alla skydd i databasen, i en transaktion, så att de håller även när flera anrop pågår samtidigt.
- Inget kostar pengar förrän ägaren aktivt slår på det.

**Non-Goals:**

- Samtal i flera steg, följdfrågor och förslag (M5). Varje önskemål är ett fristående anrop med appens aktuella beskrivning som underlag.
- Streaming av svaret till webbläsaren. Personen ser en väntan och sedan resultatet.
- Larm via mejl, avvikelsedetektion och Turnstile (efter beslutet om e-posttjänst respektive före fas 2).

## Decisions

### 1. Byggkärnan i `packages/schema`, Edge Functions som tunt skal

`packages/schema` får en byggdel: en egen liten implementation av JSON Patch (RFC 6902: `add`, `remove`, `replace`, `move`, `copy`, `test`), en systemprompt som genereras från schemat och en funktion `buildChange({ description, wish, claude })`. Den gör anropet, tillämpar patchen, validerar och gör vid behov ett nytt försök. Claude-klienten skickas in, så tester och evals kan ge en låtsasklient.

Edge Function `build` sköter bara inloggning, medlemskap, reservation och avslut i databasen, sparande och svar. Edge Function `restore` sköter ångra och återställning.

*Alternativ:* biblioteket `fast-json-patch`. Det avvisades eftersom en egen implementation är cirka 150 rader, går att testa fullt ut, fungerar likadant i Node och Deno och kan avvisa sökvägar vi inte vill tillåta.

*Import i Deno:* funktionerna importerar `packages/schema/src/index.ts` med relativ sökväg, och varje funktions `deno.json` mappar `zod` och `@anthropic-ai/sdk` till `npm:`. Edge-runtime klarar inte importer utan filändelse, så `packages/schema` importerar sina egna filer med `.ts` (tillåtet av `allowImportingTsExtensions`, som redan är påslaget). Prövat lokalt med `supabase functions serve` och `deno bundle`; ingen separat paketering behövs.

### 2. Claude svarar med patch, inte med hel beskrivning

Anropet använder strukturerad output (`output_config.format` med JSON Schema) med formen:

```
{ summary: string, operations: [{ op, path, from?, value_json? }], not_possible: [{ wish, nearest? }] }
```

`value_json` är en JSON-sträng som parsas på servern. Det håller schemat för strukturerad output enkelt och strikt, i stället för ett fält som kan ha vilken form som helst.

*Alternativ:* låta Claude returnera hela beskrivningen, begränsad av `appDescriptionJsonSchema()`. Det ger säkrare form men mer output-tokens per ändring (dyrare och långsammare). Dessutom kan delar personen inte bad om ändras i tysthet, och projektprincipen säger patch. En ny app är en patch mot en tom grundbeskrivning (`schemaVersion`, namn, tomma listor).

Systemprompten innehåller byggstenarnas regler och JSON Schema, plus Drop och matschemat som exempel. Den är stabil och markeras med `cache_control`, så upprepade anrop läser den från cachen. Appens aktuella beskrivning och önskemålet ligger i användarmeddelandet och är tydligt märkta som data.

### 3. Modell och inställningar som konfiguration

Modellen sätts med en miljövariabel. Standard är `claude-opus-5-5` med `effort: medium` och adaptivt tänkande, och server-side fallback (`fallbacks: "default"`) är påslaget, så att ett nekat svar tas om av en annan modell i samma anrop. Kostnaden räknas från `usage` (in, ut, cache skrivning och läsning) med en pristabell per modell i koden. En modell som inte finns i tabellen avvisas, så kostnadsloggen aldrig blir fel. Används en fallback-modell räknas den modellens pris.

Evals körs först med standarden. Om ägaren vill jämförs också `claude-sonnet-5-5` och `claude-haiku-5-5`, men varje körning kostar och kräver klartecken. Valet av modell för produktion görs av ägaren utifrån mätningen.

### 4. Nytt försök en gång

Ger patchen en ogiltig beskrivning, eller går den inte att tillämpa, görs ett nytt anrop. Det innehåller det första svaret och felen (sökväg och meddelande från `parseAppDescription`). Båda anropen räknas som **ett** byggsamtal mot kvoten, och båda anropens tokens och kostnad loggas på samma rad. Mer än ett nytt försök ger sällan något och fördubblar kostnaden i värsta fall.

### 5. Skydd i databasen med reservation

Nya tabeller (RLS på alla, pgTAP-tester):

- `ai_settings`: en enda rad med `paused` (standard `true`), `daily_cap_usd` och `call_estimate_usd` (uppskattad kostnad för ett pågående anrop). Ingen åtkomst för klienter.
- `ai_quotas`: `household_id` och `monthly_calls`. Saknas en rad gäller 20. Ingen åtkomst för klienter.
- `ai_calls`: en rad per byggsamtal med `household_id`, `app_id`, `user_id`, `kind` (`create` eller `change`), `status` (`pending`, `ok`, `invalid`, `failed`), `model`, tokens, `cost_usd`, `attempts`, `started_at` och `finished_at`. Medlemmar läser sitt hushålls rader, men skriver aldrig.

`public.reserve_ai_call(...)` körs bara av serverkod: funktionen avvisar alla som inte är `service_role` själv, eftersom en saknad körrätt får den lokala databasen att krascha (samma lösning som `create_household`). Den tar ett globalt transaktionslås och kontrollerar i ordning: nödbromsen, dygnets kostnad plus pågående anrop gånger uppskattningen mot dygnstaket, längden, personens och hushållets anrop senaste timmen och hushållets anrop den här månaden. Sedan läggs en `pending`-rad in. Svaret är antingen ett id eller ett skäl med när det går igen. `public.finish_ai_call(...)` fyller i resultat, tokens och kostnad. En `pending`-rad som är äldre än 10 minuter räknas som `failed` med uppskattad kostnad, så att en krasch inte släpper taket.

Det globala låset gör alla reservationer seriella. Det är inga problem vid fas 1:s volym och gör kontrollen enkel att bevisa med tester.

*Alternativ:* räknare i minnet eller i en extern tjänst. Avvisades, eftersom Edge Functions saknar delat minne och en ny tjänst ger mer drift.

Dygnstaket kontrolleras vid varje reservation, så pausen upphör av sig själv vid midnatt (svensk tid). Den manuella nödbromsen (`paused`) slås bara av av ägaren. När dygnstaket slår till skrivs en tydlig rad i funktionens logg. Larm via mejl kommer med e-posttjänsten.

### 6. Versioner får sammanfattning och ursprung

`app_versions` får kolumnerna `summary` (text), `source` (`build`, `restore` eller `developer`), `restored_from` (versionsnummer) och `ai_call_id`. Gamla rader får `developer`. Triggern som stoppar ändringar påverkas inte, eftersom kolumnerna sätts vid insättning. Versionslistan läses direkt av klienten med befintlig RLS. En ny app och dess första version sparas av `public.create_built_app` i en transaktion, och en återställd version av `public.save_restored_version`, som också har hastighetsgränsen.

### 7. Ångra och återställning utan AI

`restore` tar emot app och versionsnummer, kontrollerar medlemskap, lyfter den gamla beskrivningen med `migrate`, validerar den och sparar den som ny version med `source = 'restore'`. Ångra är `restore` till versionen före den senaste. Inget räknas mot kvoten. En generös hastighetsgräns (60 i timmen per person) skyddar mot loopar.

### 8. Vem får bygga

Alla medlemmar får skapa och ändra appar. Kvoten gäller per hushåll och allt kan ångras, så någon särskild roll behövs inte i fas 1. Om testarna i fas 2 vill begränsa det läggs en inställning per hushåll till.

### 9. Önskemål vid gränsen

`not_possible` i svaret sparas i `wishes` av servern med `household_id`, `app_id` och `created_by`. Är `operations` tom och `not_possible` inte tom sparas ingen ny version, men byggsamtalet räknas (AI:n anropades). Personen ser beskedet och närmaste alternativ.

### 10. Evals som skript

`evals/build/` innehåller 20 problem som JSON-filer: text på svenska, ny app eller ändring av Drop eller matschemat och enkla förväntningar ("har ett datumfält", "har en kalendervy"). Skriptet `npm run eval:build -- --max-usd <tak> [--model <id>] [--only <id>]` kör byggkärnan direkt med en riktig Claude-klient och nyckel från miljön, utan databas. Utan `--max-usd` vägrar det köra. Innan varje problem kontrolleras att kostnaden hittills plus uppskattningen ryms under taket.

Resultatet skrivs som tabell och JSON till `evals/build/results/<tid>.json` (ignoreras av git): giltig app ja eller nej, uppfyllda förväntningar, försök, tokens, kostnad och sammanfattningen.

"Giltig app" betyder att beskrivningen validerar och har minst en samling, en vy och ett formulär. Det är kriteriet för 18 av 20. Förväntningarna redovisas som ett mått på kvalitet men stoppar inte.

### 11. Gränssnitt i runtime

`PailoApi` utökas med `buildApp`, `changeApp`, `restoreVersion`, `listVersions` och `remainingBuilds`. Anropen går via `supabase.functions.invoke`, och svaren är typade utfall (`ok`, `not-possible`, `limit` med skäl och tid, `failed`) som översätts till svenska besked i runtime. Fältet låses medan anropet pågår, och texten sparas tills ett `ok` kommer.

### 12. Utrullning av Edge Functions

CI får ett steg som kör `supabase functions deploy` efter `db push` vid sammanslagning till `main`, med samma token. Nyckeln till Anthropic sätts av ägaren med `supabase secrets set` och läggs aldrig i repot eller i CI. Utan nyckel svarar `build` med "byggandet är pausat".

## Risks / Trade-offs

- [Supabase paketering följer kanske inte relativa importer utanför `supabase/functions`] → Prova tidigt (första uppgiften). Annars används esbuild till `_shared/` med kontroll i CI att filen är aktuell.
- [Strukturerad output stödjer kanske inte hela JSON Schema för beskrivningen] → Det behövs inte: patchformen är liten och strikt, och `value_json` är en sträng som valideras efteråt.
- [Andelen giltiga appar under 90 %] → Mät per problem och förbättra systemprompten (exempel, regler för kopplingar), prova `effort: high`, och se om fel av samma slag kan fångas med bättre felmeddelanden i det nya försöket. Varje ny körning kostar och sker med ägarens klartecken.
- [Svarstiden blir lång (tiotals sekunder)] → Visa tydligt att det byggs. Mät tiden i evals. Edge Functions tidsgräns räcker för ett anrop och ett nytt försök med `max_tokens` 16 000; om inte sänks den.
- [Global låsning blir en flaskhals] → Inte vid fas 1:s volym. Bytes mot lås per hushåll plus en separat kontroll av dygnstaket om det behövs.
- [Uppskattningen per pågående anrop är för låg, så taket passeras något] → Sätts konservativt från evals mätning. Taket är ett skydd per dygn, inte exakt bokföring.
- [Patchen tar bort något personen inte bad om] → Sammanfattningen visar vad som ändrades, ångra är ett tryck bort och data finns kvar i `records`.
- [Promptinjektion via namn och texter i appen] → AI:n har bara patch som verktyg, resultatet valideras, appen kan ångras och AI:n ser aldrig poster.

## Migration Plan

1. Migreringen lägger till tabeller, funktioner och kolumner. Nödbromsen är på och ingen nyckel finns, så inget kan kosta efter utrullningen. PR:en har migreringar och slås därför ihop av ägaren.
2. Edge Functions rullas ut av CI. Utan nyckel svarar de "pausat".
3. Evals körs lokalt med ägarens nyckel och ett tak i kronor som ägaren anger. Resultatet redovisas i PR:en eller ändringens mapp.
4. När ägaren vill öppna för riktiga användare: `supabase secrets set ANTHROPIC_API_KEY=...`, sätt dygnstak och kvoter, slå av nödbromsen med en SQL-rad. Allt är ägarens beslut.
5. Återställning: slå på nödbromsen. Tabellerna kan stå kvar. Ingen befintlig data ändras av migreringen, utöver att gamla versioner får `source = 'developer'`.

## Open Questions

- Dygnstakets nivå och uppskattningen per anrop i molnet. Sätts efter första evals-körningen, med försiktiga värden till dess.
- Vilken modell som används i produktion. Avgörs av ägaren utifrån evals; koden stödjer alla i pristabellen.

# Design

## Context

Se proposal.md för varför. Läget i koden i dag:

- **Databas.** `households` och `members` (roll `admin`/`member`) styr allt. `apps`, `app_versions`, `records`, `wishes`, `invites` och `ai_calls` har `household_id`, och RLS går via `private.is_member(household)` och `private.is_admin(household)`. `records` har redan `app_id`, och samlingsåtkomsten (`private.collection_access`) räknas per app.
- **Byggtjänsten.** `reserve_ai_call(p_user, p_household, p_app, …)` kontrollerar nödbroms, dygnstak, längd, 10/h per person, 30/h per hushåll och månadskvot per hushåll (`ai_quotas.household_id`). `create_built_app` och `save_restored_version` kräver hushållsmedlemskap. Edge Functions `build` och `restore` skickar `householdId`.
- **Runtime.** En liten router med `/` (hushållssidan) och `/app/<id>[/<vy>]`; `/inbjudan#<hemlighet>` fångas vid start (`invite.ts`). `api.ts` har `listHouseholds`, `createHousehold`, `createInviteLink(householdId)` och så vidare. Det finns inget PWA-manifest, och ikonerna är emoji (`runtime/icons.ts`).
- **Utrullning.** Migrationer och Edge Functions rullas ut till molnet när en PR slås ihop. Vercel bygger runtime från `main`. Supabase Auth i molnet har `site_url = https://pailo.se` och en lista över tillåtna adresser att skicka tillbaka till efter inloggning.
- **Data i molnet.** Bara ägarens egna testkonton och testappar finns. Inga riktiga användare.

## Goals / Non-Goals

**Goals:**
- Appmedlemskap blir den enda behörighetsgrunden i databasen, och varje policy kan testas med tre konton: ägare, medlem och utomstående.
- Samma runtime-kod visar appen på tre ställen: i verkstaden, på appens egen adress och i den fristående filen. Bara datakällan och ramen runt appen skiljer sig.
- Migrationen flyttar befintliga testappar utan dataförlust.

**Non-Goals:**
- Egen domän eller underdomän per app (`matschema.pailo.se`). Sökvägen `/a/<kortnamn>` räcker nu, eftersom DNS ligger hos Simply och jokerdomäner är krångligare där.
- En service worker som gör appens adress tillgänglig offline. Offline är den nedladdade filen.
- Att föra över ägarskap, flera ägare eller att låta medlemmar ändra appen.
- Att importera en fristående fil tillbaka till Pailo.
- Egen avsändare i inloggningsmejlet per app.

## Decisions

### 1. `app_members` med rollen i tabellen, en ägare per app
`app_members(app_id, user_id, role 'owner'|'member', display_name, joined_at)` med primärnyckeln `(app_id, user_id)`. Ett unikt partiellt index `(app_id) where role = 'owner'` gör att en app bara kan ha en ägare. Triggers ser till att den ägaren alltid finns: ägaren kan inte tas bort eller nedgraderas, och ingen klient kan sätta `role = 'owner'`. Ägarraden skapas av `create_built_app` i samma transaktion som appen.
*Alternativ:* `apps.owner_id` plus en tabell bara för medlemmar. Det ger två ställen att fråga och dubbla policyer. Med rollen i en tabell blir hjälpfunktionerna `private.is_app_member(app)` och `private.is_app_owner(app)` en enda uppslagning var, samma mönster som `is_member`/`is_admin` i dag.

### 2. `household_id` tas bort, appen är enheten
`apps`, `app_versions`, `records` och `invites` (som får `app_id`) använder appen för RLS. `ai_calls` behåller `user_id` och `app_id` och läses av den som gjorde anropet. `wishes` får `user_id` (`created_by`) och valfritt `app_id`: personen läser sina egna, och ägaren läser dem som är kopplade till appen. `private.collection_access` är oförändrad. Där `is_admin` stod i policyerna för records står nu `is_app_owner(app_id)`.
*Alternativ:* behålla en dold "personlig grupp" per person och låta RLS gå via den. Den lösningen gömmer bara hushållet under ett annat namn och gör delning per app krångligare.

### 3. En migration som flyttar data och tar bort hushållen
En enda migration (`2026111800xxxx_app_members.sql`):
1. skapar `app_members`, hjälpfunktionerna och `apps.slug`;
2. fyller `app_members`: ägaren är appens `created_by` om hen är med i hushållet, annars hushållets äldsta administratör, och övriga hushållsmedlemmar blir `member` med samma visningsnamn;
3. ger befintliga appar kortnamn;
4. flyttar `ai_quotas` till hushållets äldsta administratör;
5. tar bort oanvända hushållsinbjudningar;
6. skriver om policyer, triggers och funktioner;
7. tar bort `household_id`, `members`, `households`, `create_household` och hushållsfunktionerna.

Allt sker i en transaktion, så antingen lyckas hela flytten eller ingenting.
*Alternativ:* två steg, först nya tabeller och sedan borttagning i en senare PR. Det hade varit tryggare med riktiga användare. Nu är det bara testdata, och ett steg undviker en period med två behörighetsmodeller.

### 4. Kortnamn: läsbart namn plus slump, fast för alltid
`apps.slug` byggs av namnet i små bokstäver utan å, ä och ö, högst 24 tecken, och 6 slumpade tecken (`matschema-k3f9qa`). Det skapas av servern när appen skapas och kan sedan inte ändras (trigger). Slumpdelen gör adressen svår att gissa, men den är inte en hemlighet. Skyddet är inloggning och RLS.
*Alternativ:* appens uuid i adressen. Den är ful att dela och säger inget om vad appen är.

### 5. Appens ansikte är det enda som syns utan inloggning
En `security definer`-funktion, `public.app_face(slug)`, kan anropas utan inloggning. Den returnerar bara `id`, `name`, `icon` och `theme` från senaste versionen. Inloggningssidan i appens stil och manifestet använder den. Allt annat kräver inloggning och medlemskap via RLS.
*Alternativ:* att ladda appen först efter inloggning. Då kan inloggningssidan inte se ut som appen, och det kravet kommer från ägaren.

### 6. Tre sorters adresser i samma runtime
- `/` och `/app/<id>[/<vy>]` är verkstaden: mina appar, bygga, ändra, versioner och medlemmar. Det är den nuvarande sidan utan hushållsdelarna.
- `/a/<kortnamn>[/<vy>]` är appen ensam: en ram utan Pailo med appens namn, ikon och tema. Där finns en liten meny för att byta sitt namn, lämna appen och logga ut, och för ägaren en knapp "Ändra" som leder till `/app/<id>`.
- `/a/<kortnamn>/inbjudan#<hemlighet>` fångas som i dag. Hemligheten sparas i `sessionStorage` och adressen byts till `/a/<kortnamn>`.

Efter inloggningen skickas personen tillbaka till samma adress (`emailRedirectTo` = nuvarande sida). Därför måste `https://pailo.se/a/**` läggas till bland de tillåtna adresserna i Supabase Auth, både i `config.toml` och i molnet. Det gör ägaren eller jag med ägarens ja.
Inga rutter skapas per app, och mönstret är detsamma för alla appar.
*Alternativ:* en separat Vite-app för appens adress. Det ger två byggen och två sätt att rendera, och just det förbjuder principen om en runtime.

### 7. Manifest per app via omskrivning i Vercel
En ny Edge Function `app-manifest?slug=…` (utan JWT) hämtar `app_face` och returnerar ett webbmanifest:
- `name` och `short_name`: appens namn;
- `start_url` och `scope`: `/a/<kortnamn>/`;
- `display`: `standalone`;
- `theme_color` och `background_color`: från paletten;
- `icons`: `/icons/<ikon>-<palett>-192.png` och `-512.png`.

`vercel.json` skickar `/a/:slug/manifest.webmanifest` vidare till funktionen, så att manifestet kommer från samma adress som appen. Runtime sätter `<link rel="manifest">`, `apple-touch-icon`, favicon och `<title>` när en `/a/`-adress öppnas.
*Alternativ:* ett manifest som skapas i webbläsaren som blob. Chrome kan inte installera från ett blob-manifest. Ett statiskt manifest per app vid bygget fungerar inte heller, eftersom appar skapas efter bygget.

### 8. PNG-ikoner ritas vid bygget
De 18 ikonnamnen i schemat får vektorikoner från Lucide (ISC-licens, kopierade in i repot med licenstexten). Ett skript ritar dem vita på palettens accentfärg i 192 och 512 pixlar, alltså 18 × 6 × 2 = 216 filer, med `@resvg/resvg-js` (ny dev-beroende) som ett `prebuild`-steg in i `apps/runtime/public/icons/`. Filerna checkas inte in. Inne i appen används emoji som i dag.
*Alternativ:* emoji som PNG. Det kräver ett färgemoji-typsnitt som resvg inte ritar pålitligt. PNG-filer som ritas av en funktion vid varje begäran är långsammare och dyrare än 216 statiska filer.

### 9. Datakällan bakom ett gränssnitt
`AppScreen`, formulären och vyerna pratar i dag med `PailoApi` för poster och medlemmar. De får i stället ett smalare `AppData`-gränssnitt: `listRecords`, `createRecord`, `updateRecord`, `deleteRecord`, `members` och `me`. Det finns två implementationer: Supabase (verkstaden och appens adress) och lokal (den fristående filen). Behörighetskontrollen i `permissions.ts` utgår från rollen `owner`/`member` i stället för `admin`/`member`.

### 10. Den fristående filen
- **Bygget.** `apps/runtime` får en andra ingång, `standalone.html`. Den byggs med `vite-plugin-singlefile` (ny dev-beroende) till en enda HTML-fil där JS och CSS ligger inline. Filen innehåller en tom `<script type="application/json" id="pailo-data">`. Supabase-klienten importeras inte i den ingången, och ett test kontrollerar att den byggda filen saknar `supabase` och Pailos adresser.
- **Data.** Edge Function `export` (inloggad ägare) kontrollerar ägarskap, skriver en rad i `app_exports(app_id, user_id, created_at)` och returnerar `{ name, description, records, members: [{ id, displayName }], exportedAt }`. Tabellen har RLS, och ägaren läser sina egna rader.
- **Ihopsättning i webbläsaren.** Verkstaden hämtar `/standalone.html` från samma adress och lägger in datan som JSON, där `<` skrivs som `<` så att posterna inte kan stänga skripttaggen. Sedan sparas filen som `<Appnamn>.html`. Servern behöver då ingen kopia av runtime-bygget.
- **Körning.** Den lokala datakällan läser posterna från `pailo-data` första gången och sparar sedan i `localStorage` under en nyckel med appens id och exporttiden. Personen är ägare, så allt är tillåtet. En `Content-Security-Policy`-meta (`default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:`) gör att filen inte kan anropa någon server.

*Alternativ:* en zip med flera filer. Den måste packas upp och kräver en lokal server för ES-moduler på `file://`. En enda HTML-fil öppnas med ett dubbelklick.

### 11. Kvot och hastighet per person och app
- `ai_quotas(user_id, monthly_calls)`.
- `reserve_ai_call(p_user, p_app, p_kind, p_message_length)`, där `p_app` är null för en ny app:
  - för `change` krävs att `p_user` är ägare av `p_app`;
  - gränserna är 10/h per `user_id` och 30/h per `app_id`, och den senare gäller bara `change`;
  - kvoten räknas på `user_id`.
- `remaining_builds()` utan argument räknar för den inloggade personen.
- `save_restored_version` kräver ägarskap.
- Orsaken `rate-household` byter namn till `rate-app` i API och texter.

## Risks / Trade-offs

- [Migrationen tar bort data som inte kan återställas] → Före sammanslagningen tar ägaren en kopia av datan i molnet (`supabase db dump --data-only`). Migrationen körs först lokalt mot en kopia av samma testdata, och CI kör alla pgTAP-tester.
- [Runtime och databas byts inte exakt samtidigt vid sammanslagningen] → Det kan ge några minuter av fel för ägarens testkonton. Det godtas, eftersom det inte finns några riktiga användare. README berättar om det.
- [Inloggningslänken leder till fel ställe om `pailo.se/a/**` saknas i Supabase Auth] → Det läggs till i molnet före sammanslagningen, och den manuella kontrollen i tasks testar en inloggning på appens adress.
- [`app_face` avslöjar namn och tema för den som känner kortnamnet] → Avsiktligt och begränsat: inget innehåll, ingen ägare, inga medlemmar. Det dokumenteras i `docs/05-sakerhet.md`.
- [`localStorage` i den fristående filen kan tömmas av webbläsaren eller vara delad mellan alla `file://`-sidor] → Nyckeln innehåller appens id. Filen säger i klartext att ändringar sparas i den här webbläsaren. Export ur filen kommer senare.
- [Filen innehåller allas poster i klartext] → Bara ägaren kan ladda ned den, varje nedladdning loggas, och verkstaden säger det i klartext före nedladdningen.
- [iOS och Android läser manifest och ikoner olika] → Manuell prov på både Android och iPhone ingår i klart-kontrollen. Ikonerna är PNG, så båda kan läsa dem.

## Migration Plan

1. Allt byggs på en gren med lokal Supabase. Alla pgTAP-tester skrivs om och får gröna resultat, och nya tester för tre konton läggs till.
2. Före sammanslagningen, med ägarens ja:
   - lägga till `https://pailo.se/a/**` bland de tillåtna adresserna i Supabase Auth i molnet;
   - ägaren tar en kopia av datan.
3. Ägaren slår ihop PR:en. Migrationen och funktionerna (`build`, `restore`, `app-manifest`, `export`) rullas ut, och Vercel bygger runtime.
4. Kontroll efter utrullningen:
   - ägarens testappar finns i verkstaden med kortnamn;
   - en andra person bjuds in till matschemat på dess adress;
   - en tredje person nekas;
   - appen installeras på en telefon;
   - filen öppnas utan nätverk.
5. **Om något går fel:** en ny migration kan inte återskapa hushållen. Återställningen är att lägga tillbaka den sparade kopian i en ny databas och rulla tillbaka runtime i Vercel. Med enbart testdata godtas det.

## Open Questions

- Hur meddelar den fristående filen att det finns ändringar som inte finns i Pailo? Det kan vänta tills import finns.
- Ska appens adress senare kunna bli en underdomän (`matschema.pailo.se`)? Kortnamnet fungerar likadant, så det ändrar inget nu.

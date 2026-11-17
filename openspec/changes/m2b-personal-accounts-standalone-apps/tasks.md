# Tasks

## 1. Appmedlemskap i databasen

- [ ] 1.1 Migrationen `app_members` enligt design beslut 1 och 3, steg 1: tabellen med roll och visningsnamn, unikt index för en ägare per app, `private.is_app_member(app)` och `private.is_app_owner(app)`, triggers som hindrar klienter från att sätta `owner`, ta bort eller nedgradera ägaren och ändra någon annans visningsnamn. Verifiera med pgTAP att en app inte kan få två ägare och att ägarraden inte går att ta bort av en klient.
- [ ] 1.2 Kolumnen `apps.slug` enligt design beslut 4: en funktion som bildar kortnamnet utan å, ä och ö plus 6 slumptecken, ett unikt index och en trigger som hindrar ändring. Verifiera med pgTAP att "Matschema för Åsa" ger ett kortnamn som matchar `^matschema-for-asa-[a-z0-9]{6}$` och att en ändring avvisas.
- [ ] 1.3 Flytt av befintlig data enligt design beslut 3, steg 2–5: ägare från `created_by` eller äldsta administratör, övriga hushållsmedlemmar som `member`, kortnamn till befintliga appar, `ai_quotas` till äldsta administratör och oanvända inbjudningar borttagna. Verifiera med ett pgTAP-test som lägger in hushållsdata före migrationen, eller ett separat SQL-skript mot lokal databas med `supabase db reset` på en dump, att varje app får rätt ägare och medlemmar.
- [ ] 1.4 Ta bort `household_id` från `apps`, `app_versions`, `records`, `wishes`, `invites` och `ai_calls`, ge `invites` `app_id`, och ta bort `households`, `members`, `create_household`, `is_member`, `is_admin` och hushållstriggers. Verifiera att `supabase db reset` går igenom och att `grep -ri household supabase/migrations/2026111800*` bara träffar flyttsteget.

## 2. RLS per app och tester med tre konton

- [ ] 2.1 Policyer för `apps`, `app_versions`, `app_members`, `records`, `invites` och `wishes` enligt design beslut 2. Medlemmar läser appen, versioner, medlemmar och poster. Bara ägaren läser och återkallar inbjudningar. Samlingsåtkomsten med `is_app_owner` i stället för `is_admin`. Önskemål läses av avsändaren och ägaren. Verifiera med `supabase test db`.
- [ ] 2.2 `create_invite(app)` (bara ägaren) och `accept_invite(token)` som returnerar appens id och kortnamn, samt `leave_app(app)` och ägarens borttagning av en medlem. Verifiera med pgTAP för: medlem bjuder in (nekas), giltig, okänd, utgången, återkallad och redan medlem; medlem lämnar och når sedan inget; ägaren försöker lämna (nekas).
- [ ] 2.3 Skriv om `01_households`, `02_invites`, `03_app_data` och `04_isolation` till `01_app_members`, `02_invites`, `03_app_data` och `04_isolation` med tre testkonton (ägare A, medlem B, utomstående C) och två appar. Verifiera att C inte når någon rad i någon tabell och inte kan skriva, att B når Matschema men inte Drop, och att alla tester är gröna i CI.
- [ ] 2.4 `public.app_face(slug)` enligt design beslut 5, körbar utan inloggning. Verifiera med pgTAP att den returnerar exakt `id`, `name`, `icon` och `theme`, att ett okänt kortnamn ger inga rader, och att `anon` fortfarande inte kan läsa `apps`, `app_versions` eller `records`.
- [ ] 2.5 Tabellen `app_exports` med RLS (ägaren läser sina egna, ingen klient skriver). Verifiera med pgTAP.

## 3. Kvot och gränser per person

- [ ] 3.1 `ai_quotas` per `user_id`, `reserve_ai_call(p_user, p_app, p_kind, p_message_length)`, `create_built_app(p_user, p_name, …)` (skapar ägarrad och kortnamn), `save_restored_version` (kräver ägare) och `remaining_builds()` enligt design beslut 11. Verifiera genom att skriva om `05_build_service` för: medlem som inte är ägare nekas ändring, 10/h per person, 30/h per app, kvot per person, att sista kvoten bara ges en gång och att ångra inte räknas.
- [ ] 3.2 RLS på `ai_calls` så att personen läser sina egna rader. Verifiera med pgTAP att A inte ser B:s rader.

## 4. Edge Functions

- [ ] 4.1 `build` och `restore` utan `householdId`: ny app med personen som ägare, och ändring och återställning bara för ägaren, med `rate-app` i stället för `rate-household`. Verifiera med funktionstesterna mot lokal Supabase och låtsas-Claude för: ägare lyckas, medlem nekas, utomstående nekas och utloggad nekas.
- [ ] 4.2 `app-manifest` (utan JWT) enligt design beslut 7. Verifiera med ett test att svaret har `start_url` och `scope` `/a/<kortnamn>/`, appens namn och ikonsökvägar, att det är `404` för okänt kortnamn, och att svaret inte innehåller något annat från beskrivningen.
- [ ] 4.3 `export` enligt design beslut 10. Verifiera med test: ägaren får namn, beskrivning, poster och medlemmarnas visningsnamn och en rad i `app_exports`; medlem och utomstående nekas utan att någon rad skrivs.
- [ ] 4.4 Lägg till de nya funktionerna i utrullningen och i CI:s Deno-kontroll. Verifiera att CI är grönt och att utrullningsjobbet listar `app-manifest` och `export`.

## 5. Runtime: API och datakälla

- [ ] 5.1 `api.ts` utan hushåll: `listMyApps` (egna och delade, med ägarens namn), `appBySlug`, `appFace`, `listMembers(app)`, `updateDisplayName(app, name)`, `createInviteLink(app)` (länk till `/a/<kortnamn>/inbjudan#…`), `listInvites`, `revokeInvite`, `removeMember`, `leaveApp`, `buildApp(wish)`, `changeApp(app, wish)`, `remainingBuilds()` och `exportApp(app)`. Verifiera med `api.test.ts` mot lokal Supabase.
- [ ] 5.2 `AppData`-gränssnittet enligt design beslut 9 med Supabase-implementationen, `AppScreen` och formulär flyttade dit, och `permissions.ts` med `owner`/`member`. Verifiera med befintliga runtime-tester (uppdaterade) och nya tester för ägarens rättigheter.
- [ ] 5.3 Routern med `/`, `/app/<id>[/<vy>]`, `/a/<kortnamn>[/<vy>]` och `/a/<kortnamn>/inbjudan#…`, och `invite.ts` som sparar hemligheten och kortnamnet. Verifiera med `router.test.tsx` och `invite.test.ts`, även för okända och felaktiga adresser.

## 6. Verkstaden

- [ ] 6.1 Ta bort `NameHousehold` och `HouseholdPage` och gör startsidan till Mina appar: egna appar, sedan delade med ägarens namn, tomt läge med fältet för en ny app, och ett nytt konto landar direkt där. Verifiera med `App.test.tsx`.
- [ ] 6.2 Appen i verkstaden (`/app/<id>`): bygg- och ändringsfältet, ångra och versioner bara för ägaren, kvar av kvoten per person, och en länk "Öppna appen" till appens adress. Verifiera med tester för att en medlem som öppnar `/app/<id>` skickas till appens adress och inte ser byggfältet.
- [ ] 6.3 Medlemmar per app i verkstaden: lista, bjud in (med texten om 3 dagar, en gång och just den här appen), se och återkalla inbjudningar och ta bort en medlem med bekräftelse. Verifiera med komponenttester.
- [ ] 6.4 "Ladda ned appen" för ägaren, med en förklaring före nedladdningen att filen innehåller allas poster och fungerar utan nätverk. Verifiera med ett test att filen sätts ihop med `pailo-data` och att `<` i en post skrivs som `<`.

## 7. Appens egen adress

- [ ] 7.1 Ramen för `/a/<kortnamn>` utan Pailo enligt design beslut 6: titel, favicon och tema från appen, menyn (byta namn, lämna, logga ut) och knappen "Ändra" bara för ägaren. Verifiera med tester att texten "Pailo" inte finns i den renderade sidan för en medlem.
- [ ] 7.2 Inloggning i appens stil via `app_face`, med `emailRedirectTo` tillbaka till samma adress, och lägg till `/a/**` i `config.toml`. Verifiera med tester för utloggad, okänt kortnamn och inte medlem, och manuellt lokalt med Inbucket att länken i mejlet leder tillbaka till appen.
- [ ] 7.3 Inbjudan på appens adress: logga in, gå med och visa appen. Visa ett vänligt besked vid ogiltig länk. Verifiera med tester och manuellt lokalt med två konton.

## 8. Installera appen

- [ ] 8.1 Vektorikoner från Lucide för de 18 ikonnamnen, med licenstext, och ett `prebuild`-skript med `@resvg/resvg-js` som ritar 192 och 512 pixlar per ikon och palett till `apps/runtime/public/icons/` (ignoreras av git). Verifiera med ett test att alla 216 filer skapas och att varje ikonnamn i schemat har en vektor.
- [ ] 8.2 Omskrivningen `/a/:slug/manifest.webmanifest` i `vercel.json` och länkarna till manifest och `apple-touch-icon` på `/a/`-sidor. Verifiera i förhandsvisningen från Vercel att manifestet laddas från appens adress och att Chrome visar att appen går att installera.

## 9. Den fristående filen

- [ ] 9.1 Ingången `standalone.html` med `vite-plugin-singlefile`, den lokala `AppData` med `localStorage` och meta-taggen för CSP enligt design beslut 10. Verifiera med ett test att den byggda filen är en enda HTML-fil utan `supabase`, `pailo.se` eller funktionsadresser.
- [ ] 9.2 Ett test som öppnar en fristående fil med Drop och matschemat i jsdom (eller Playwright om det redan finns), skapar, ändrar och tar bort en post, laddar om och ser ändringen. Verifiera att testet är grönt.
- [ ] 9.3 Manuell kontroll: ladda ned matschemat, stäng av nätverket, öppna filen, lägg till en måltid, stäng och öppna igen. Skriv resultatet i PR:en.

## 10. Dokument, utrullning och klart-kontroll

- [ ] 10.1 Uppdatera `docs/03-arkitektur.md` (ta bort notisen om hushåll i koden, lägg till adresser, manifest och export), `docs/05-sakerhet.md` (`app_face` och exportloggen), README:s lokala steg, `CLAUDE.md` (ta bort "until then the code still has them") och `openspec/config.yaml` (RLS per appmedlemskap, kvot per person). Verifiera att `grep -ri hushåll docs README.md` bara träffar historik och affärsmodellens namn.
- [ ] 10.2 Före sammanslagningen och med ägarens ja: lägg till `https://pailo.se/a/**` bland de tillåtna adresserna i Supabase Auth i molnet och be ägaren ta en kopia av datan. Verifiera att adressen syns i Auth-inställningarna.
- [ ] 10.3 Efter att ägaren slagit ihop PR:en, klart-kontrollen enligt design, Migration Plan, steg 4:
  - ägarens testappar finns med kortnamn;
  - en andra person bjuds in och ser ägarens måltider på matschemats adress utan Pailo;
  - en tredje person nekas;
  - appen installeras på Android och iPhone;
  - filen fungerar utan nätverk.

  Skriv resultatet i PR:en och bocka av M2b i `docs/06-roadmap.md`.

## Workflow follow-up

- Uppdatera statussidan (docs/status.html och artefakten) när M2b är klar.
- Arkivera ändringen med `/opsx:archive` när klart-kontrollen är gjord.

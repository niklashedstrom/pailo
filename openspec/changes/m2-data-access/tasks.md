# Tasks

## 1. Hushåll och medlemmar

- [x] 1.1 Migrering: schemat `private`, tabellerna `households` och `members`, hjälpfunktionerna `private.is_member`/`private.is_admin`, RLS och policyer för båda tabellerna, trigger för minst en administratör; verifiera med `supabase db reset` lokalt
- [x] 1.2 Funktionen `create_household(name)` med `revoke` från `public`/`anon`; verifiera med `supabase db reset`
- [x] 1.3 pgTAP-hjälpfil som skapar testanvändare och byter identitet, plus tester för hushåll A och B: skapa hushåll, läsa/ändra/ta bort åt båda hållen, medlem kan inte ändra roll, sista administratören kan inte lämna, utloggad kan inte skapa hushåll; verifiera med `supabase test db`

## 2. Inbjudningar

- [x] 2.1 Migrering: tabellen `invites` med RLS (admin läser och återkallar), funktionerna `create_invite` och `accept_invite` enligt design; verifiera med `supabase db reset`
- [x] 2.2 pgTAP-tester: medlem kan inte bjuda in, hemligheten finns inte i databasen, giltig inbjudan ger medlemskap, utgången/använd/återkallad/okänd avvisas med samma fel, redan medlem förbrukar inte inbjudan, B kan inte se eller återkalla A:s inbjudningar; verifiera med `supabase test db`

## 3. Appar, versioner, poster och önskemål

- [x] 3.1 Migrering: `apps` och `app_versions` med select-policyer för medlemmar, ingen klientskrivning, trigger för löpnummer och oföränderliga versioner, storleksgräns på beskrivningen, index `(app_id, version desc)`; verifiera med `supabase db reset`
- [x] 3.2 Migrering: `records` med `private.collection_access`, policyer per åtkomstnivå, trigger för systemfält och låsta kolumner, storleksgräns 64 kB; `wishes` med insert/select för medlemmar; verifiera med `supabase db reset`
- [x] 3.3 pgTAP-tester: klient kan inte skriva appar/versioner, versioner kan inte ändras eller tas bort, ångra ger nytt löpnummer, post i okänd samling avvisas, `edit`/`add`/`read` för medlem och admin, förfalskad skapare skrivs över, för stor post avvisas, önskemål; verifiera med `supabase test db`
- [x] 3.4 Isoleringstest som för varje tabell (households, members, invites, apps, app_versions, records, wishes) visar att B inte kan läsa, skapa, ändra eller ta bort A:s rader och att A:s data är oförändrad efteråt, samt att egen data syns; verifiera med `supabase test db`

## 4. Inloggning och sidor i runtime

- [x] 4.1 Auth-inställningar i `supabase/config.toml` (site URL, redirect-adresser för lokal utveckling, magisk länk), `@supabase/supabase-js` i runtime, klientmodul som läser `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` och `.env.example`; verifiera med `npm run typecheck` och `npm run build`
- [x] 4.2 Sidorna logga in och kolla mejlen, utloggning; tester med mockad klient för att e-post skickas och att bekräftelsetexten visas; verifiera med `npm test -w @pailo/runtime`
- [x] 4.3 Sidorna namnge hushåll och hushållet (namn, medlemmar, val mellan flera hushåll); tester; verifiera med `npm test -w @pailo/runtime`
- [x] 4.4 Bjud in (skapa och kopiera/dela länk med texten om 3 dagar och en gång) och ta emot inbjudan via `/inbjudan#<token>`, även efter inloggning, med svensk feltext för ogiltig länk; tester; verifiera med `npm test -w @pailo/runtime`
- [x] 4.5 Manuell kontroll lokalt mot lokal Supabase: två konton via Mailpit, A skapar hushåll och bjuder in B, B går med; dokumentera körsättet i README:s utvecklingsavsnitt

## 5. Utrullning till molnet

- [x] 5.1 CI-jobbet `deploy-database` (bara push till `main`, efter `database`, egen concurrency utan avbrott, `supabase link` + `supabase db push`); verifiera att arbetsflödet är giltigt och att jobbet hoppas över i pull request
- [x] 5.2 Ägaren lägger in `SUPABASE_ACCESS_TOKEN` och `SUPABASE_DB_PASSWORD` som GitHub-hemligheter; verifiera med `gh secret list`
- [x] 5.3 Auth-inställningar i molnprojektet (Site URL `https://pailo.se`, redirect-adresser) och `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` i Vercel för production och preview; verifiera med `vercel env ls` och att den byggda koden inte innehåller någon hemlig nyckel

## 6. Klart när

- [ ] 6.1 Kör `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` och `supabase test db`, öppna pull request och verifiera att CI är grön – två testkonton i olika hushåll är helt isolerade, bevisat av tester
- [ ] 6.2 Efter sammanslagning: verifiera att `deploy-database` lyckades och att molnprojektets migreringshistorik innehåller M2:s migreringar

## Workflow follow-up

- Arkivera ändringen med `/opsx:archive`
- Bocka av M2 i `docs/06-roadmap.md`
- Beslut om egen e-postleverantör innan andra personer än ägaren ska logga in (före M3:s "Klart när")

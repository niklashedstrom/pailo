# Design

## Context

`supabase/` har i dag bara en init-migrering (pgTAP) och ett röktest. CI kör `supabase db start` och `supabase test db` lokalt i GitHub Actions. Molnprojektet `pailo` (ref `edtgepobtmyogdmaphfm`, eu-north-1) finns men är tomt. Runtime är en Vite/React-app utan Supabase-klient. Lokalt används portarna 55420–55429.

Appbeskrivningen från M1 (`packages/schema`) anger åtkomst per samling (`edit`/`add`/`read`). Den regeln ska nu gälla i databasen. Motivering: se proposal.md.

## Goals / Non-Goals

**Goals:**
- Isolering mellan hushåll som går att lita på eftersom den bevisas av tester, inte av klientkod
- En datamodell som räcker för M3 (Drop och matschemat mellan två konton) och M4 (versioner, ångra, önskemål)
- Säkra standardval: allt som inte uttryckligen tillåts är stängt

**Non-Goals:**
- Validering av posternas fältvärden mot fälttyperna (görs i runtime i M3; databasen kontrollerar bara samling, form och storlek)
- Det validerade skrivflödet för appbeskrivningar (Edge Function i M3/M4); i M2 skrivs appar bara med service-rollen, t.ex. i tester och seed
- Kvoter, prisnivåer och medlemsgräns per nivå, provperiod, filer/bilder, påminnelser
- Passkeys, Turnstile, egen e-postleverantör (se risker)
- Delning mellan hushåll (bara kolumnen `copied_from_app_id` förbereds)

## Decisions

### Tabeller

```
households   id, name, created_at
members      household_id, user_id, role (admin|member), display_name, joined_at   PK (household_id, user_id)
apps         id, household_id, name, copied_from_app_id?, created_by, created_at
app_versions id, app_id, household_id, version, description jsonb, created_by, created_at   UNIQUE (app_id, version)
records      id, household_id, app_id, collection, data jsonb, created_by, created_at, updated_by, updated_at
invites      id, household_id, token_hash, created_by, created_at, expires_at, accepted_by?, accepted_at?, revoked_at?
wishes       id, household_id, app_id?, text, created_by, created_at
```

`household_id` finns direkt på varje tabell, även där den går att härleda (`app_versions`, `records`). Då blir varje RLS-policy en enkel kontroll av medlemskap utan joins, och en trigger säkerställer att `household_id` stämmer med appens. Alternativet att bara härleda via `app_id` förkastades: det ger dyrare policyer och lättare fel.

Främmande nycklar har `on delete cascade` från hushåll och app, så att radering av ett hushåll (GDPR, provperiod) tar allt.

### Hjälpfunktioner i ett privat schema
`private.is_member(household_id)`, `private.is_admin(household_id)` och `private.collection_access(app_id, collection)` är `security definer`, `stable` och ligger i schemat `private` som inte exponeras av API:t. Policyerna anropar dem som `(select private.is_member(household_id))` så att Postgres kan cacha resultatet per fråga. `security definer` behövs för att policyn på `members` inte ska rekursera i sig själv. Alla får `set search_path = ''`.

### Åtkomst per samling i RLS
`collection_access` läser `description->'collections'` i appens senaste version och returnerar `edit`, `add`, `read` eller `null` (samlingen finns inte). Policyer på `records`:
- **select:** medlem i hushållet
- **insert:** admin, eller access är `edit`/`add`; samlingen måste finnas (`null` avvisas, även för admin)
- **update:** admin, eller `edit`, eller `add` och `created_by = auth.uid()`
- **delete:** admin, eller `edit`

Att läsa senaste versionen i varje skrivning kostar en indexerad uppslagning (`app_versions (app_id, version desc)`); det duger för hushållsstora data. Alternativet att kopiera åtkomsten till en egen tabell vid varje ny version förkastades i M2 som för tidig optimering.

### Systemfält sätts av triggers
En `before insert/update`-trigger på `records` sätter `created_by`, `created_at`, `updated_by`, `updated_at` från `auth.uid()` och `now()`, och hindrar att `household_id`, `app_id`, `collection` och `created_by` ändras. Samma mönster för `apps`, `app_versions`, `wishes`, `invites`. Då kan klienten inte förfalska vem som gjorde vad.

### Appar och versioner: läs för medlemmar, skriv bara för servern
`apps` och `app_versions` har bara select-policyer för `authenticated`. Inga insert/update/delete-policyer, och `app_versions` har dessutom en trigger som avvisar update och delete för alla roller (även service-rollen), så versioner är oföränderliga. `version` sätts av en trigger till `max + 1` per app. Ångra = ny version med en äldre beskrivning.

### Funktioner för det som inte kan göras rad för rad
Exponerade `security definer`-funktioner i `public`, anropbara bara av `authenticated`:
- `create_household(name)` → skapar hushåll och gör anroparen till admin i samma transaktion (annars kan ingen bli första medlem)
- `create_invite(household_id)` → kräver admin; slumpar 32 byte, sparar `sha256` av dem och returnerar hemligheten en gång. `expires_at = now() + 3 days`
- `accept_invite(token)` → hashar, låser raden, kontrollerar att den inte är utgången, använd eller återkallad; lägger till anroparen som `member` och markerar inbjudan. Är anroparen redan medlem returneras hushållet utan att inbjudan förbrukas. Alla fel ger samma neutrala felkod så att hushållet inte avslöjas

Återkallelse görs med en update-policy på `invites` för admin som bara får sätta `revoked_at` (kolumnbehörighet).

### Medlemmar
- select: medlemmar i samma hushåll
- update: egen rad får bara ändra `display_name` (kolumnbehörighet); admin får ändra `role`
- delete: egen rad (lämna) eller admin
- insert: ingen policy; bara via `create_household` och `accept_invite`
- En trigger avvisar ändringar som lämnar hushållet utan admin

### Storleksgränser
`check (octet_length(data::text) <= 65536)` på `records.data` och `<= 262144` på `app_versions.description` (storleken på JSON-texten, så att komprimering inte påverkar gränsen), plus `jsonb_typeof(...) = 'object'`. `collection` och namn har längdgränser som matchar `LIMITS` i schemat.

### Tester
pgTAP-filer per område i `supabase/tests/`. En gemensam hjälpfil skapar användare i `auth.users` och byter identitet med `set local role authenticated` och `set local request.jwt.claims`. Två hushåll A och B med var sin admin och medlem, och en app per hushåll med samlingar för varje åtkomstnivå, seedas med service-rollen. Varje tabell testas för select/insert/update/delete åt båda hållen, och varje funktion för fel hushåll. `tests/` körs i CI som i dag.

### Inloggning och sidor i runtime
`@supabase/supabase-js` med publik nyckel. Magisk länk via `signInWithOtp({ email, options: { emailRedirectTo } })` med PKCE. Inga router-bibliotek: en enkel tillståndsmaskin i `App` (utloggad → inget hushåll → hushåll) och sökvägen `/inbjudan#<token>` läses vid start. Hemligheten ligger i fragmentet (`#`) så att den inte skickas till servern eller hamnar i loggar; den sparas i `sessionStorage` under inloggningen så att personen inte behöver öppna länken igen. Sidor: logga in, kolla mejlen, namnge hushåll, hushållet (namn, medlemmar, bjud in, logga ut), ta emot inbjudan. All text på svenska utan tekniska ord.

Tester med Testing Library och en mockad Supabase-klient för flödena; den riktiga behörigheten testas i pgTAP.

### Utrullning till molnet
Nytt jobb `deploy-database` i CI som bara körs vid `push` till `main`, kräver att jobbet `database` lyckats och använder `supabase link --project-ref edtgepobtmyogdmaphfm` + `supabase db push`. Hemligheter: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`. Jobbet får en egen `concurrency`-grupp utan `cancel-in-progress`, så att en pågående utrullning aldrig avbryts. Auth-inställningar i molnet (Site URL `https://pailo.se`, tillåtna redirect-adresser för pailo.se, www och lokal utveckling) sätts en gång via Supabase och dokumenteras. Vercel får `VITE_SUPABASE_URL` och `VITE_SUPABASE_PUBLISHABLE_KEY` för production och preview.

## Risks / Trade-offs

- [Supabases inbyggda e-post skickar bara till projektets teammedlemmar och har låg gräns per timme] → Räcker för att testa M2 själv. Innan mamma ska logga in (M3) behövs en egen e-postleverantör (SMTP); det beslutet tas separat eftersom det är en ny extern tjänst.
- [På gratisnivån går mejltexterna inte att ändra med Supabases inbyggda e-post] → Lokalt är inloggningsmejlen på svenska (`supabase/templates/`). Molnet skickar Supabases engelska standardmejl tills en egen e-postleverantör finns; då kan `supabase config push` också föra över adresserna i `[remotes.production]`. Fram till dess sätts Site URL och tillåtna adresser för hand i Supabase.
- [RLS-fel är tysta: en felaktig policy ger tomma svar, inte fel] → Testerna kontrollerar både att egen data syns och att annans inte gör det, så en för snäv policy upptäcks också.
- [`security definer`-funktioner kringgår RLS] → Få funktioner, tom `search_path`, egna tester för fel hushåll. Funktionerna i `public` avvisar själva den som inte är inloggad i stället för att lita på saknad `execute`-behörighet: i Supabase-avbildningen Postgres 17.6.1.x (lokalt och i CI) kraschar serverprocessen vid felet "permission denied for function", så det felet får aldrig kunna uppstå från API:t. Funktionerna i `private` nås inte från API:t.
- [Utrullning till molnet kan misslyckas halvvägs] → Varje migrering körs i en transaktion; `db push` stoppar vid första fel och nästa körning fortsätter där den slutade. Molnprojektet har ingen användardata ännu.
- [Preview-deployer i Vercel pekar mot samma molnprojekt som produktion] → Acceptabelt tills det finns riktiga användare; separat projekt för preview kostar ett nytt projekt-slot och tas upp då.
- [Läsning av senaste version i varje postskrivning] → Index på `(app_id, version desc)`; mät när det finns verklig data.

## Migration Plan

1. Migreringar läggs till efter `20261104000000_init.sql` och testas lokalt och i CI.
2. Ägaren skapar `SUPABASE_ACCESS_TOKEN` och lägger in det och databaslösenordet som GitHub-hemligheter innan sammanslagning.
3. Efter sammanslagning kör CI `db push`; resultatet kontrolleras i molnprojektets migreringshistorik.
4. Återställning: molnprojektet är tomt, så vid fel kan schemat återställas och migreringarna köras om. När det finns användardata gäller i stället nya framåtriktade migreringar.

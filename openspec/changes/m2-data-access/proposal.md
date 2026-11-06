# Proposal

## Why

M1 gav oss formatet för en app, men det finns ingenstans att spara appar, data eller vilka som hör till ett hushåll. Hushållet är Pailos enhet: en app delas med familjen från start och ingen annan får se den. Innan runtime (M3) kan visa riktiga appar för två personer behövs datamodellen, inloggning, inbjudan och – framför allt – bevis för att ett hushåll aldrig kan läsa eller ändra ett annats data.

## What Changes

- **Tabeller** i Supabase: `households`, `members`, `apps`, `app_versions`, `records` (jsonb), `invites`, `wishes`
  - All appdata i en generisk `records`-tabell; nya appar kräver aldrig nya tabeller
  - Appversioner kan inte ändras eller tas bort, så ångra blir en ny version
  - `apps` får en valfri koppling till appen den kopierades från, så delning mellan hushåll ryms i modellen senare
- **RLS per hushåll** på varje tabell, plus samlingens åtkomst (`edit`/`add`/`read`) från appbeskrivningen för `records`. Administratörer kan alltid allt
- **Funktioner i databasen** för det som inte kan göras rad för rad: skapa hushåll (med dig som administratör), skapa inbjudan, ta emot inbjudan
- **Inbjudan** med tidsbegränsad engångslänk (3 dagar); bara en hash av länkens hemlighet sparas
- **Appar och versioner skrivs bara från servern.** Inloggade användare kan läsa sina hushålls appar men inte skriva beskrivningar direkt; det validerade skrivflödet kommer i M3/M4
- **pgTAP-tester** som bevisar att två testkonton i olika hushåll är helt isolerade i varje tabell och funktion
- **Inloggning med magisk länk** och enkla sidor i runtime: logga in, skapa hushåll, bjud in, ta emot inbjudan
- **Utrullning till molnet:** CI kör migreringarna mot Supabase-projektet `pailo` när `main` ändras; inloggningens adresser pekar på pailo.se och runtime får Supabase-adress och publik nyckel via Vercel

## Capabilities

### New Capabilities

- `households`: hushåll, medlemmar och roller, inbjudan med tidsbegränsad länk, samt isoleringen mellan hushåll
- `app-data`: lagring av appar, appversioner, poster och önskemål, med åtkomst per hushåll och per samling
- `sign-in`: inloggning med magisk länk och sidorna för att komma in i ett hushåll
- `database-rollout`: hur databasändringar testas i CI och rullas ut till molnprojektet

### Modified Capabilities

(inga)

## Impact

- `supabase/`: nya migreringar, RLS-policyer, funktioner, pgTAP-tester; auth-inställningar i `config.toml`
- `apps/runtime`: nytt beroende `@supabase/supabase-js`, inloggnings- och hushållssidor, miljövariabler `VITE_SUPABASE_URL` och `VITE_SUPABASE_PUBLISHABLE_KEY`
- `.github/workflows/`: nytt jobb som kör `supabase db push` mot molnprojektet efter merge till `main`
- **Kräver av ägaren:** ett Supabase-åtkomsttoken som GitHub-hemlighet (`SUPABASE_ACCESS_TOKEN`) och databaslösenordet (`SUPABASE_DB_PASSWORD`). Inget kostar pengar; molnprojektet har ingen användardata ännu
- Ingen påverkan på `packages/schema`, men RLS läser samlingarnas `access` ur appbeskrivningen

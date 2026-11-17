# Proposal

## Why

Efter M0–M2 finns grunden, appformatet och en säker datamodell, men ingen beskrivning går att använda som app. Allt som återstår i fas 1 (byggtjänsten i M4, intervjun i M5) förutsätter en runtime som kan visa vilken giltig beskrivning som helst, byggd av byggstenarna. Runtime är därför nästa flaskhals. Vi tar bara med det som behövs för M3:s klart-kriterium, så att vi snabbt kan gå vidare till M4, som är den största risken.

## What Changes

- **Byggstenar, inte appar:** runtime känner bara till byggstenarna (fälttyper, vyer, inmatning, åtkomst, tema) och visar varje giltig beskrivning med samma komponenter. Inga appar är inbyggda i produkten. Drop och matschemat är bara provexempel, och en ny testbeskrivning som använder varje byggsten och variant visar att inget är skräddarsytt för just dem
- **Appar i hushållet:** hushållssidan visar hushållets appar och öppnar en app på egen adress. Användare kan inte skapa appar i M3; det gör byggtjänsten i M4 och intervjun i M5
- **Utvecklarverktyg för att prova:** ett skript validerar en beskrivning från fil och lägger in den som app i ett hushåll i den **lokala** databasen, så att klart-kriteriet kan visas innan byggtjänsten finns. Skriptet vägrar köra mot molnet
- **Vyer från beskrivningen:** `list`, `cards`, `calendar` (vecka och månad) och `overview`, med visade fält, sortering och sektioner som beskrivningen anger
- **Formulär från fälten:** skapa, ändra och ta bort poster i `records` för fälttyperna text, datum, länk, person, val och koppling. Formuläret visar bara det personen får göra enligt samlingens åtkomst och sin roll; databasen avgör ändå
- **Fältvärden med fast format** per fälttyp, validerade med Zod i `packages/schema` innan de sparas, och visade försiktigt om något i databasen inte stämmer
- **Tema:** namnen i beskrivningen (förinställning, palett, typsnitt, avstånd, rundning, täthet) blir CSS-variabler. Tre förinställda stilar (`calm`, `playful`, `strict`) och sex paletter, där varje palett är testad för kontrast enligt WCAG AA
- **Delat i hushållet:** två konton i samma hushåll ser och ändrar samma poster. Listan hämtas igen när personen kommer tillbaka till fliken
- **Ingen ny teknik i gränssnittet:** all text på svenska utan tekniska ord, inga beroenden för router eller design
- **Pausad fabrikskö:** hushållsjobben i `factory/backlog.md` pausas utom "ta bort en medlem" och "lämna hushållet"

**Utanför M3, flyttas till M3b** (efter klart-kriteriet): installerbar app (PWA), dela-meny och bokmärkesknapp med återkallbar nyckel, påminnelser, bilder (lagring av filer). Bildfält visas med en ärlig text om att bilder kommer senare.

## Capabilities

### New Capabilities

- `app-runtime`: hur vilken giltig appbeskrivning som helst visas och används: applista och adresser, vyerna, formulären, tema och vad personen ser utifrån åtkomst

### Modified Capabilities

- `app-data`: nya krav på fältvärdenas format per fälttyp och att värdena kontrolleras före sparande

## Impact

- `packages/schema`: nytt `recordDataSchema(collection)` med format per fälttyp, och testbeskrivningen `examples/alla-byggstenar.json` med ett test som kräver att den täcker varje fälttyp och vytyp
- `apps/runtime`: applista, en liten egen router, vy- och formulärkomponenter, temavariabler, utökat `PailoApi` för appar och poster. Inga nya beroenden i runtime
- `scripts/`: utvecklarskriptet för lokala appar, med `tsx` som nytt utvecklingsberoende i roten
- `supabase/`: **ingen ny migrering.** `apps`, `app_versions` och `records` med RLS och triggers från M2 räcker, och molndatabasen ändras inte
- `docs/06-roadmap.md`: M3 delas i M3 och M3b
- `factory/backlog.md`: hushållsjobben pausas
- **Inget kostar pengar.** Beslutet om egen e-posttjänst behövs innan mamma kan logga in på pailo.se, men inte för att visa klart-kriteriet lokalt

# Tasks

## 1. Plan och kö

- [x] 1.1 Dela M3 i M3 (vyer, formulär, tema) och M3b (PWA, dela-meny och bokmärkesknapp, påminnelser, bilder) i `docs/06-roadmap.md`, med samma klart-kriterium för M3; verifiera att roadmapen visar båda och att M3b ligger före M4 i läsordningen men inte blockerar den
- [x] 1.2 Flytta hushållsjobben i `factory/backlog.md` under rubriken "Pausat till efter M3", utom "ta bort en medlem" och "lämna hushållet"; verifiera att första omarkerade raden utanför pausen är "ta bort en medlem"

## 2. Fältvärden i schemat

- [x] 2.1 `recordDataSchema(collection)` i `packages/schema` med formaten i design beslut 2 (strikt objekt, okända fält, fel format, val utanför alternativen och tomma obligatoriska fält avvisas, tomma fält saknas), exporterat från `index.ts`; verifiera med Vitest-tester för varje fälttyp, med och utan `multiple`/`withTime`/`required`
- [x] 2.2 `parseFieldValue(field, value)` som läser ett enskilt värde och ger `undefined` för saknat eller trasigt; verifiera med tester för trasiga datum, okänt val och fel persontyp

## 3. Byggstenar och utvecklarverktyg

- [x] 3.1 Testbeskrivningen `packages/schema/examples/alla-byggstenar.json` enligt design beslut 1, med påhittade id:n, plus ett test som läser fälttyperna, vytyperna och åtkomstnivåerna ur schemat och kräver att exemplet täcker alla; verifiera att testet blir rött om en fälttyp tas bort ur exemplet
- [x] 3.2 `scripts/dev-app.ts` och `npm run dev:app` (`tsx` som utvecklingsberoende): validerar med `migrateAppDescription`, vägrar annat än `127.0.0.1`/`localhost`, skapar app och version 1, eller ny version om ett app-id anges, och skriver ut adressen; verifiera med tester för ogiltig beskrivning, adress i molnet och ny version, och genom att lägga in matschemat lokalt
- [x] 3.3 Beskriv i README hur man lägger in en beskrivning lokalt och provar med två konton; verifiera genom att följa stegen från början

## 4. Data och adresser i runtime

- [x] 4.1 Utöka `PailoApi`, `supabaseApi` och `fakeApi` med `listApps`, `openApp` (migrerar och validerar, eget utfall för ogiltig), `listRecords`, `createRecord`, `updateRecord`, `deleteRecord`, där 0 träffade rader räknas som nekat; verifiera med tester i `api.test.ts` för varje metod, inklusive nekad uppdatering och ogiltig beskrivning
- [x] 4.2 Router för `/`, `/app/<app>` och `/app/<app>/<vy>` ovanpå `history`, som behåller inbjudningsflödet; verifiera med tester för navigering, bakåtknapp och omladdning på en appadress

## 5. Applista och appskärm

- [x] 5.1 Applista på hushållssidan med namn och ikon, och text när det inte finns appar, utan färdiga appar att välja; verifiera med `App.test.tsx`-tester för tom lista, flera appar och att ingen knapp för att lägga till visas
- [x] 5.2 `AppScreen` som laddar app, poster och medlemmar, visar vyernas namn och byter vy via adressen, med sidor för "appen kunde inte hittas" och "appen kan inte visas just nu"; verifiera med tester för första vyn, byte av vy, okänd app och ogiltig beskrivning
- [x] 5.3 Hämta poster igen när fliken blir synlig; verifiera med ett test som utlöser `visibilitychange` och ser en post som en annan medlem lagt till i fejk-API:t

## 6. Vyer och visning av värden

- [x] 6.1 `FieldValue` per fälttyp (svenska datum, valens etiketter, personens namn, kopplad posts titel, säkra länkar enligt kravet, tomt för trasigt) och postens titel enligt design beslut 5; verifiera med tester, inklusive att `javascript:` inte blir en länk
- [x] 6.2 Datumhjälp (tolka `ÅÅÅÅ-MM-DD`, veckor från måndag, månader, svenska namn) och sortering med `localeCompare(…, 'sv')` och saknade värden sist; verifiera med tester runt årsskifte, vecka 53 och å/ä/ö
- [x] 6.3 `ListView` och `CardsView` med visade fält och sortering (standard senast skapade först); verifiera med tester mot `alla-byggstenar.json`, Drop och Rätter i matschemat
- [x] 6.4 `CalendarView` för vecka och månad, med och utan tid i datumfältet, med stegning framåt och bakåt, som börjar på dagens period och hoppar över poster utan giltigt datum; verifiera med tester med fast "idag"
- [x] 6.5 `OverviewView` med sektionernas titel, gräns och sortering; verifiera med ett test där gränsen 5 visar 5 av 12 poster

## 7. Formulär och behörighet

- [x] 7.1 `permissions(access, role, createdBy, userId)` enligt design beslut 6; verifiera med en tabelltestad matris (edit/add/read × admin/medlem × egen/annans) som motsvarar pgTAP-testerna från M2
- [x] 7.2 `RecordForm` med `FieldControl` per fälttyp (text, flerradig text, datum med och utan tid, länk, val ett/flera, person med medlemmar och personer utan konto, koppling) och texten om bilder för `image`; validerar med `recordDataSchema` innan sparande; verifiera med tester för varje kontroll, obligatoriskt fält och att bildfältet inte stoppar sparandet
- [x] 7.3 Knappar för `form`-inmatningar som skapar poster, och `RecordSheet` för att visa, ändra och ta bort med bekräftelse, där knapparna följer `permissions`; verifiera med tester för skapa, ändra, ta bort, avbruten borttagning och läsbehörighet
- [x] 7.4 Vardagliga fel när sparande, ändring eller borttagning misslyckas eller nekas, med formuläret kvar; verifiera med tester där fejk-API:t kastar fel och nekar

## 8. Tema

- [x] 8.1 `theme/tokens.ts` och `resolveTheme` enligt design beslut 7, satt som CSS-variabler på appens yttersta element, plus appens CSS som bara använder variablerna; verifiera med tester för förinställning utan tillval, tillval som ersätter och att Pailos egna sidor inte påverkas
- [x] 8.2 Kontrasttest för alla sex paletter (text, dämpad text och text på accent mot sina bakgrunder) som kräver WCAG AA; verifiera att testet går grönt och blir rött med en för ljus testfärg
- [x] 8.3 Kontrollera Drop och matschemat i alla tre förinställningar i 360 pixlars bredd utan sidledes skroll, i förhandsvisningen för PR:en; verifiera med skärmbilder i PR:en
  - Gjort lokalt i Chrome utan fönster, 360 px: alla tre förinställningar × Drop och matschemat (varje vy och ett formulär) utan sidledes skroll. Skärmbilder i `skarmbilder/83-*.png`. Hittade och rättade: länk inuti postknappen, tomma fält gav tomma rader, veckonavigeringen radbröts klumpigt.

## 9. Klart-kriteriet

- [x] 9.1 Integrationstest i runtime med fejk-API:t och två inloggade personer i samma hushåll: matschemat finns som app i hushållet, Anna skapar Lasagne och planerar den till onsdag; Bertil ser den i Veckan och ändrar vem som lagar; samma för en post i Drop; plus ett test som skapar, ändrar och tar bort en post i varje samling i `alla-byggstenar.json`; verifiera med `npm test`
- [x] 9.2 Kör klart-kriteriet för hand lokalt (`supabase start`, två konton via Mailpit, Drop och matschemat inlagda med `npm run dev:app`) och beskriv resultatet med skärmbilder i PR:en; verifiera att båda apparna fungerar för båda kontona
  - Gjort lokalt mot `supabase start` med Anna, Bertil och en utomstående, i Chrome utan fönster (inloggning via engångslänk från den lokala databasen i stället för Mailpit). Bertil ser båda apparna och Annas lasagne, lägger till en rätt som Anna ser, ser Annas drop utan att kunna ändra, ändrar sin egen men kan inte ta bort; Anna kan ta bort; den utomstående når inte appen. Skärmbilder i `skarmbilder/92-*.png`. Hittade och rättade: en planerad måltid hette "Namnlös", nu heter den som rätten.
- [x] 9.3 Uppdatera README:s status och `docs/03-arkitektur.md` med fältvärdenas format och utvecklarskriptet; verifiera att länkarna i README fungerar

## Workflow follow-up

- Arkivera ändringen med `/opsx:archive` när klart-kriteriet är visat, synka kraven till `openspec/specs/` och bocka av M3 i roadmapen.
- Uppdatera statussidan (`docs/status.html` och artefakten).
- Ta beslutet om egen e-posttjänst innan mamma ska logga in på pailo.se.

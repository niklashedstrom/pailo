# Design

## Context

`packages/schema` innehåller i dag en platshållare (v0: `schemaVersion` + `name`) och Zod 4. Paketet exporterar TypeScript-källan direkt och testas med Vitest. Kraven finns i `specs/app-description/spec.md`; motivering i proposal.md.

Beskrivningen kommer att (a) skrivas av AI:n via JSON Patch i M4, (b) sparas som jsonb i `app_versions` i M2 och (c) renderas av runtime i M3. Det styr besluten nedan: formatet ska vara lätt att patcha, strikt att validera och fritt från allt som kan tolkas som kod.

## Goals / Non-Goals

**Goals:**
- Ett format som uttrycker Drop och matschemat utan specialfall
- All validering på ett ställe (`parseAppDescription`), så att runtime, byggtjänst och tester delar exakt samma regler
- Migreringar som rena funktioner, testbara utan databas

**Non-Goals:**
- Rendering, formulär eller tema-tokens i CSS (M3)
- Validering av posternas data (records) mot fälten – formatet för records bestäms i M2/M3
- Logik/regler, utskick och delning mellan hushåll (senare byggstenar)

## Decisions

### Formatets struktur

```ts
{
  schemaVersion: 1,
  name: string,                 // "Matschema"
  description?: string,
  icon?: IconName,              // fast lista
  collections: Collection[],    // { id, name, access, fields: Field[] }
  views: View[],                // list | cards | calendar | overview
  inputs: Input[],              // form | share | bookmarklet
  people: { others: { id, name }[] },   // personer utan konto
  reminders: Reminder[],        // daily | weekly | beforeDate
  theme: { preset, palette?, font?, spacing?, radius?, density? }
}
```

Fält är en diskriminerad union på `type`: `text` (`multiline?`), `date` (`withTime?`), `image`, `link`, `person` (`multiple?`), `choice` (`options: { value, label }[]`, `multiple?`), `reference` (`collection`). Alla fält har `id`, `label`, `required?`.

### Arrayer med id i stället för objekt-nycklar
Samlingar, fält, vyer m.m. är arrayer av objekt med `id`, inte objekt nycklade på id. Ordningen spelar roll (fältordning i formulär, vyordning i menyn), och JSON Patch mot arrayer (`/collections/0/fields/-`) är enkelt för AI:n. Nackdelen – att unika id:n inte garanteras av strukturen – löses med `superRefine`. Alternativet objekt-nycklar förkastades eftersom ordning då måste lagras separat.

### Referenser via id, kontrollerade i ett andra steg
Zod-objekten kontrollerar form (strikt: `z.strictObject`, okända egenskaper avvisas). Sedan kör en `superRefine` på hela beskrivningen och kontrollerar alla korsreferenser: unika id:n, att vyer/inmatningar/påminnelser pekar på samlingar och fält som finns och har rätt typ, att `reference` pekar på en samling. Fel får en exakt `path`, t.ex. `["views", 1, "dateField"]`. Ett alternativ var att bygga referenserna in i typerna, men det går inte i Zod utan att känna till hela dokumentet.

### Fasta listor för allt visuellt
Tema, ikoner och färger är `z.enum` med namn (`"sage"`, `"rounded"`), aldrig färgkoder, typsnittsnamn eller CSS. Runtime översätter namnen till tokens i M3. Det gör att varje kombination kan testas för kontrast och att ingen användartext hamnar i CSS.

### Åtkomst per samling, inte rollsystem
`access: "edit" | "add" | "read"` för medlemmar per samling; administratörer kan alltid allt. Ett fullt rollsystem (egna roller, behörighet per fält) förkastades som för stort för v1. Det tvingas fram i databasen med RLS i M2; i M1 är det bara data i beskrivningen.

### Gränser som konstanter
`LIMITS` exporteras (t.ex. 20 samlingar, 40 fält per samling, 20 vyer, 10 inmatningar, 20 påminnelser, 50 alternativ, 80 tecken för namn/etiketter, 500 för beskrivningar). Värdena är startvärden och kan höjas utan migrering.

### Migreringar som kedja av rena funktioner
`migrations: Record<number, (input) => unknown>` där `migrations[n]` tar version n till n+1. `migrateAppDescription(input)` läser `schemaVersion`, avvisar saknad eller framtida version, kör stegen i ordning och validerar sist med aktuellt schema. Mellanversioner valideras inte (deras scheman behöver inte finnas kvar). v0 → v1 fyller i en standardsamling `anteckningar` med ett textfält, en listvy och temat `calm`, så att resultatet är giltigt.

### API
Exporteras från `@pailo/schema`:
- `appDescriptionSchema`, typen `AppDescription` (och deltyper)
- `parseAppDescription(input): { success: true, data } | { success: false, issues }`
- `migrateAppDescription(input)` med samma returform
- `appDescriptionJsonSchema()` via Zods `z.toJSONSchema`
- `CURRENT_SCHEMA_VERSION`, `LIMITS`

Kod och id:n är på engelska; namn och etiketter i exemplen är på svenska eftersom de syns för användaren.

### Exempel som JSON-filer
`packages/schema/examples/drop.json`, `matschema.json` och `invalid/*.json`. JSON i stället för TS-objekt, eftersom det är exakt det format som sparas i databasen och som AI:n producerar. Testerna läser filerna och validerar dem.

## Risks / Trade-offs

- [Formatet visar sig inte räcka när runtime byggs i M3] → Lägg till fält som valfria (ingen migrering) eller gör en v2 med migrering; det är precis vad migreringskedjan är till för.
- [`z.toJSONSchema` kan inte uttrycka korsreferenserna i `superRefine`] → JSON Schema används bara för att forma AI:ns output; varje patch valideras ändå med `parseAppDescription` i M4.
- [Gränserna är gissningar] → Exporteras som konstanter och justeras när verkliga appar finns.
- [Strikta objekt gör att en ny valfri egenskap avvisas av äldre runtime-versioner] → Runtime och schema deployas tillsammans från samma monorepo, så de är alltid i takt.

## Migration Plan

v0-platshållaren används inte av någon kod eller data, och migreringen v0 → v1 täcker den ändå. Ingen datamigrering behövs.

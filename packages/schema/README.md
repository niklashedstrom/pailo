# @pailo/schema

Appbeskrivningen: det enda formatet en användarapp finns i. Runtime renderar den, byggtjänsten ändrar den med JSON Patch och databasen sparar versioner av den. Kraven finns i OpenSpec-specen `app-description`.

## Formatet (v1)

```
schemaVersion  1
name           appens namn
description?   kort beskrivning
icon?          namn från ICONS
collections[]  { id, name, access: edit|add|read, fields[] }
views[]        list | cards | calendar | overview
inputs[]       form | share | bookmarklet
people         { others[]: { id, name } }   personer utan konto, t.ex. barn
reminders[]    daily | weekly | beforeDate
theme          { preset: calm|playful|strict, palette?, font?, spacing?, radius?, density? }
```

Fälttyper: `text`, `date`, `image`, `link`, `person`, `choice`, `reference` (koppling till en annan samling).

Regler som formen inte uttrycker kontrolleras i `src/references.ts`: unika id:n, att vyer, inmatningar och påminnelser pekar på samlingar och fält som finns och har rätt typ. Gränser finns i `LIMITS` (`src/primitives.ts`). Allt visuellt väljs ur fasta listor (`src/theme.ts`), aldrig färgkoder eller CSS.

## API

```ts
import { parseAppDescription, migrateAppDescription, appDescriptionJsonSchema } from '@pailo/schema'

parseAppDescription(input)    // { success: true, data } | { success: false, issues: { path, message }[] }
migrateAppDescription(input)  // som ovan, men uppgraderar äldre schemaVersion först
appDescriptionJsonSchema()    // JSON Schema för aktuell version (bara formen)
```

## Exempel

`examples/drop.json` och `examples/matschema.json` är handskrivna referensappar och måste alltid validera. `examples/invalid/` innehåller medvetet trasiga beskrivningar som måste avvisas. Nytt exempel: lägg JSON-filen i rätt mapp och lägg till den i `src/examples.test.ts`.

## Ny schemaversion

1. Höj `CURRENT_SCHEMA_VERSION` och ändra schemat.
2. Lägg till `migrations[n]` i `src/migrate.ts` som tar version n till n + 1 (en ren funktion över JSON).
3. Uppdatera exemplen till nya versionen och lägg till ett migreringstest från förra versionen.

Nya *valfria* egenskaper kräver ingen ny version.

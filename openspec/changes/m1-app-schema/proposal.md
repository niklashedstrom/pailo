# Proposal

## Why

Allt i Pailo vilar på appbeskrivningen: runtime (M3) renderar den, byggtjänsten (M4) patchar den och databasen (M2) sparar versioner av den. Innan något av det kan byggas måste det finnas ett exakt, validerat format som kan uttrycka de två första riktiga apparna – Drop och mammas matschema – och som tål att schemat växer utan att gamla appar går sönder.

## What Changes

- Appbeskrivning v1 i `packages/schema` (Zod) som ersätter M0:s platshållare (v0):
  - **Samlingar och fält:** text, datum, bild, länk, person, val och koppling till en annan samling
  - **Vyer:** lista, kort, kalender och översikt
  - **Inmatning:** formulär, dela-meny och bokmärkesknapp
  - **Personer:** åtkomst per samling för hushållets medlemmar, plus personer utan konto (t.ex. barn)
  - **Påminnelser:** återkommande (dagligen/veckovis) och relativt ett datumfält
  - **Tema:** förinställd stil plus fasta val för färg, typsnitt, avstånd, rundning och täthet
- Validering utöver formen: unika id:n, att vyer/inmatning/påminnelser pekar på fält som finns och har rätt typ, storleksgränser
- `schemaVersion` och en migreringsfunktion som uppgraderar äldre beskrivningar steg för steg till aktuell version; v0 → v1 är första migreringen
- JSON Schema-export av beskrivningen, för strukturerad output i byggtjänsten (M4)
- Handskrivna exempel: Drop och mammas matschema (rätter + måltider), plus ett medvetet trasigt exempel
- Enhetstester för giltiga och ogiltiga beskrivningar och för migreringen

## Capabilities

### New Capabilities

- `app-description`: formatet för en användarapp – vad en appbeskrivning får innehålla, vilka regler den måste uppfylla för att godkännas och hur äldre versioner uppgraderas.

### Modified Capabilities

(inga)

## Impact

- `packages/schema`: nytt schema, validering, migreringar, JSON Schema-export, exempel och tester. **BREAKING** mot M0:s platshållare (v0), men den används inte någonstans och hanteras av migreringen.
- `apps/runtime`: påverkas inte i M1 (renderingen kommer i M3).
- Inga nya beroenden utöver Zod, som redan finns.

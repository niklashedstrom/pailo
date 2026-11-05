# Tasks

## 1. Grundformat och fält

- [x] 1.1 Definiera id-format, `LIMITS`, ikon- och temalistor samt fälttyperna (`text`, `date`, `image`, `link`, `person`, `choice`, `reference`) som strikta Zod-objekt; tester för giltiga fält, tomt valfält, för lång etikett, ogiltigt id och okänd egenskap; verifiera med `npm test -w @pailo/schema`
- [x] 1.2 Definiera samling (`id`, `name`, `access`, `fields`) och toppnivån med `schemaVersion: 1`, `people`, `theme`; tester för okänd åtkomstnivå och fri färgkod; verifiera med `npm test -w @pailo/schema`

## 2. Vyer, inmatning och påminnelser

- [x] 2.1 Definiera vyerna `list`, `cards`, `calendar`, `overview` (med sektioner); tester för giltiga vyer; verifiera med `npm test -w @pailo/schema`
- [x] 2.2 Definiera inmatningarna `form`, `share`, `bookmarklet` med fältmappning; tester för giltiga inmatningar; verifiera med `npm test -w @pailo/schema`
- [x] 2.3 Definiera påminnelserna `daily`, `weekly`, `beforeDate` med klockslag `HH:MM`; tester för söndag 18:00 och `25:00`; verifiera med `npm test -w @pailo/schema`

## 3. Korsreferenser

- [x] 3.1 `superRefine` för unika id:n (samlingar, vyer, inmatningar, påminnelser, personer, fält per samling); tester för dubblerat fält-id med korrekt `path`; verifiera med `npm test -w @pailo/schema`
- [x] 3.2 `superRefine` för referenser och fälttyper: `reference` → samling, vyer/inmatningar/påminnelser → samling och fält, kalender/påminnelse → `date`-fält, dela-meny-adress → `link`-fält; ett test per regel med korrekt `path`; verifiera med `npm test -w @pailo/schema`
- [x] 3.3 `parseAppDescription` med returformen `{ success, data | issues }`; verifiera med test som visar att issues innehåller sökväg

## 4. Version, migrering och export

- [x] 4.1 `migrateAppDescription` med migreringskedja och v0 → v1; tester för uppgradering av `{ schemaVersion: 0, name: "Matschema" }`, saknad version och framtida version; verifiera med `npm test -w @pailo/schema`
- [x] 4.2 `appDescriptionJsonSchema()` via `z.toJSONSchema`; test som verifierar att resultatet är ett objekt med `properties.collections`; verifiera med `npm test -w @pailo/schema`

## 5. Referensappar

- [x] 5.1 Handskriv `examples/drop.json` (länkar/text, listvy, dela-meny, bokmärkesknapp); test som validerar filen; verifiera med `npm test -w @pailo/schema`
- [x] 5.2 Handskriv `examples/matschema.json` (rätter + måltider med koppling, veckokalender, rättlista, påminnelse söndag 18:00, barn som personer utan konto); test som validerar filen; verifiera med `npm test -w @pailo/schema`
- [x] 5.3 Lägg till minst ett medvetet trasigt exempel i `examples/invalid/` och test som verifierar att det avvisas med felets sökväg; verifiera med `npm test -w @pailo/schema`
- [x] 5.4 Kort README i `packages/schema` som beskriver formatet och hur exempel och migreringar läggs till; verifiera att filen finns

## 6. Klart när

- [ ] 6.1 Kör `npm run lint`, `npm run typecheck`, `npm test` och `npm run build` i hela repot, öppna pull request och verifiera att CI är grön – båda exemplen validerar och det trasiga avvisas

## Workflow follow-up

- Arkivera ändringen med `/opsx:archive` efter sammanslagning
- Bocka av M1 i `docs/06-roadmap.md`

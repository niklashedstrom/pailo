# Spec Delta

## ADDED Requirements

### Requirement: Format för text, datum och länk
En posts fältvärden SHALL lagras nycklade på fält-id med ett fast format per fälttyp: text som sträng; datum som `ÅÅÅÅ-MM-DD`, eller `ÅÅÅÅ-MM-DDTtt:mm` i svensk tid om fältet har tid; länk som en adress som börjar med `https://` eller `http://`. Ett fält utan värde SHALL saknas i posten.

#### Scenario: Datum med tid
- **WHEN** en post sparas med tiden 18:30 den 11 november 2026 i ett datumfält med tid
- **THEN** värdet sparas som `2026-11-11T18:30`

#### Scenario: Tomt fält
- **WHEN** en post i Drop sparas utan anteckning
- **THEN** posten saknar fältet `note`

### Requirement: Format för val, personer och kopplingar
Ett valfält SHALL lagra alternativets värde, och en lista av värden om fältet tillåter flera. Ett personfält SHALL peka ut antingen en hushållsmedlem eller en av beskrivningens personer utan konto, så att de två aldrig kan förväxlas, och SHALL vara en lista om fältet tillåter flera. Ett kopplingsfält SHALL lagra id för en post i den kopplade samlingen.

#### Scenario: Person utan konto
- **WHEN** Ella väljs i fältet Vem lagar
- **THEN** värdet pekar ut personen `barn-1` i beskrivningen och inte en hushållsmedlem

#### Scenario: Flera val
- **WHEN** en post i Drop får etiketterna Läs senare och Recept
- **THEN** värdet sparas som listan `["las-senare", "recept"]`

### Requirement: Fältvärden kontrolleras före sparande
Runtime MUST kontrollera en posts fältvärden mot samlingens fält i appens aktuella beskrivning innan posten sparas, och MUST inte spara fält som inte finns i samlingen, värden med fel format, val som inte finns bland alternativen eller tomma obligatoriska fält. Databasen fortsätter att kontrollera samling, åtkomst och storlek enligt kraven ovan.

#### Scenario: Okänt val
- **WHEN** en post skulle sparas med etiketten `hemlig` som inte finns bland alternativen
- **THEN** posten sparas inte

#### Scenario: Okänt fält
- **WHEN** en post skulle sparas med fältet `pris` som inte finns i samlingen
- **THEN** posten sparas inte

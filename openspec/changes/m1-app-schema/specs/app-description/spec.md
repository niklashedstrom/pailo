# Spec Delta

## Purpose

Definierar appbeskrivningen: det enda formatet en användarapp finns i. Allt som renderar, ändrar eller sparar en app utgår från att beskrivningen följer dessa regler.

## ADDED Requirements

### Requirement: Validering av appbeskrivning
Systemet SHALL erbjuda en validering som tar emot okänd indata och antingen returnerar en giltig appbeskrivning eller avvisar den. En avvisning MUST innehålla minst ett fel med sökväg till det felaktiga stället i beskrivningen. Okända egenskaper MUST avvisas, så att ingen data som inte ingår i formatet kan smygas in.

#### Scenario: Giltig beskrivning
- **WHEN** en beskrivning som följer formatet valideras
- **THEN** valideringen lyckas och returnerar beskrivningen

#### Scenario: Okänd egenskap
- **WHEN** en beskrivning innehåller en egenskap som inte ingår i formatet, t.ex. `"script": "..."` på en vy
- **THEN** valideringen avvisar beskrivningen och felet pekar på egenskapen

### Requirement: Samlingar och fält
En appbeskrivning SHALL innehålla minst en samling. Varje samling SHALL ha ett id, ett namn och minst ett fält. Varje fält SHALL ha ett id, en etikett och en av typerna `text`, `date`, `image`, `link`, `person`, `choice` eller `reference`. Ett `choice`-fält MUST ha minst ett alternativ med unika värden. Ett `reference`-fält MUST peka på en samling som finns i samma beskrivning.

#### Scenario: Valfält utan alternativ
- **WHEN** en beskrivning har ett `choice`-fält med tom alternativlista
- **THEN** valideringen avvisar beskrivningen

#### Scenario: Koppling till samling som saknas
- **WHEN** ett `reference`-fält pekar på samlingen `ratter` men ingen sådan samling finns
- **THEN** valideringen avvisar beskrivningen och felet pekar på fältet

### Requirement: Unika och stabila id:n
Id:n för samlingar, vyer, inmatningar och påminnelser MUST vara unika inom sin typ i beskrivningen, och fält-id:n MUST vara unika inom sin samling. Id:n MUST bestå av små bokstäver a–z, siffror och bindestreck och börja med en bokstav, så att de kan användas som stabila nycklar för data.

#### Scenario: Dubblerat fält-id
- **WHEN** en samling har två fält med id `datum`
- **THEN** valideringen avvisar beskrivningen

#### Scenario: Ogiltigt id
- **WHEN** en samling har id `Måltider`
- **THEN** valideringen avvisar beskrivningen

### Requirement: Vyer
En appbeskrivning SHALL innehålla minst en vy. Varje vy SHALL vara av typen `list`, `cards`, `calendar` eller `overview`. En `list`-, `cards`- eller `calendar`-vy MUST peka på en samling som finns, och alla fält vyn nämner (visade fält, sortering) MUST finnas i den samlingen. En `calendar`-vy MUST ange ett datumfält av typen `date`. En `overview`-vy SHALL bestå av sektioner som var och en pekar på en samling som finns.

#### Scenario: Kalender med fel fälttyp
- **WHEN** en kalendervy anger ett fält av typen `text` som datumfält
- **THEN** valideringen avvisar beskrivningen

#### Scenario: Vy mot samling som saknas
- **WHEN** en listvy pekar på samlingen `lankar` som inte finns
- **THEN** valideringen avvisar beskrivningen

### Requirement: Inmatning
En appbeskrivning SHALL kunna ange inmatningar av typerna `form`, `share` (mobilens dela-meny) och `bookmarklet` (bokmärkesknapp), som var och en pekar på en samling som finns. En `share`- eller `bookmarklet`-inmatning MUST ange vilka fält som tar emot inkommande adress, titel och text, och ett fält som tar emot en adress MUST vara av typen `link`.

#### Scenario: Dela-meny till fel fälttyp
- **WHEN** en `share`-inmatning skickar inkommande adress till ett fält av typen `date`
- **THEN** valideringen avvisar beskrivningen

### Requirement: Personer och åtkomst
Varje samling SHALL ange vad hushållets medlemmar får göra med dess poster: `edit` (skapa, ändra och ta bort alla), `add` (skapa och ändra egna) eller `read` (bara läsa). Hushållets administratörer MUST alltid kunna ändra allt. En appbeskrivning SHALL kunna lista personer utan konto (till exempel barn) med id och namn, så att `person`-fält kan peka på dem.

#### Scenario: Okänd åtkomstnivå
- **WHEN** en samling anger åtkomsten `admin-only`
- **THEN** valideringen avvisar beskrivningen

### Requirement: Påminnelser
En appbeskrivning SHALL kunna ange påminnelser som är antingen återkommande (`daily` eller `weekly` med veckodag, vid ett klockslag) eller relativa ett datumfält i en samling (ett antal dagar före, vid ett klockslag). En relativ påminnelse MUST peka på ett fält av typen `date`. Klockslag MUST anges som `HH:MM` i 24-timmarsformat.

#### Scenario: Veckopåminnelse
- **WHEN** en beskrivning har en påminnelse varje söndag kl. 18:00
- **THEN** valideringen lyckas

#### Scenario: Ogiltigt klockslag
- **WHEN** en påminnelse har klockslaget `25:00`
- **THEN** valideringen avvisar beskrivningen

### Requirement: Tema från fasta val
En appbeskrivning SHALL ha ett tema som består av en förinställd stil (`calm`, `playful` eller `strict`) och valfria justeringar av färg, typsnitt, avstånd, rundning och täthet. Varje värde MUST komma från en fast lista; fria färgkoder, typsnittsnamn eller CSS MUST avvisas.

#### Scenario: Fri färgkod
- **WHEN** temat anger färgen `#ff0000`
- **THEN** valideringen avvisar beskrivningen

### Requirement: Storleksgränser
En appbeskrivning MUST avvisas om den överskrider fasta gränser för antal samlingar, fält per samling, vyer, inmatningar, påminnelser, alternativ per valfält och längd på texter, så att en enskild app inte kan bli orimligt stor.

#### Scenario: För lång etikett
- **WHEN** ett fält har en etikett som är längre än gränsen
- **THEN** valideringen avvisar beskrivningen

### Requirement: Schemaversion och migrering
Varje appbeskrivning MUST ange `schemaVersion`. Systemet SHALL erbjuda en migrering som tar en beskrivning av en äldre version och uppgraderar den steg för steg till aktuell version, och sedan validerar resultatet. En beskrivning med högre version än systemet känner till, eller utan version, MUST avvisas.

#### Scenario: Uppgradering från v0
- **WHEN** en v0-beskrivning `{ "schemaVersion": 0, "name": "Matschema" }` migreras
- **THEN** resultatet är en giltig beskrivning av aktuell version med namnet `Matschema`

#### Scenario: Okänd framtida version
- **WHEN** en beskrivning med `schemaVersion` högre än aktuell version migreras
- **THEN** migreringen avvisar beskrivningen

### Requirement: Maskinläsbart format
Systemet SHALL kunna exportera formatet för aktuell version som JSON Schema, så att AI-anrop kan begränsas till strukturer som formatet tillåter.

#### Scenario: Export
- **WHEN** JSON Schema för aktuell version exporteras
- **THEN** resultatet är ett JSON Schema-objekt som beskriver appbeskrivningens egenskaper

### Requirement: Referensappar
Projektet SHALL innehålla handskrivna beskrivningar av Drop och mammas matschema som båda validerar mot aktuell version, samt minst ett medvetet trasigt exempel som avvisas. Matschemat SHALL innehålla en samling rätter och en samling måltider med koppling till rätter, en kalendervy för veckan och en återkommande påminnelse om att planera veckan.

#### Scenario: Exemplen validerar
- **WHEN** testerna validerar Drop och matschemat
- **THEN** båda godkänns

#### Scenario: Trasigt exempel
- **WHEN** testerna validerar det trasiga exemplet
- **THEN** det avvisas med minst ett fel som pekar på det trasiga stället

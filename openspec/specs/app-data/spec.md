# app-data Specification

## Purpose

Beskriver hur ett hushålls appar, appversioner, poster och önskemål lagras och vem som får läsa och ändra dem, så att alla appar delar samma generiska lagring och varje ändring av en app går att ångra.

## Requirements

### Requirement: Appar tillhör ett hushåll
Varje app SHALL tillhöra exakt ett hushåll och SHALL kunna läsas av hushållets medlemmar. En app SHALL kunna ange vilken app den kopierades från, så att delning mellan hushåll kan läggas till senare utan ny datamodell.

#### Scenario: Medlem ser hushållets appar
- **WHEN** en medlem listar appar
- **THEN** hushållets appar returneras, men inga appar från andra hushåll

### Requirement: Appbeskrivningar skrivs bara från servern
Inloggade användare MUST inte kunna skapa eller ändra appar eller appversioner direkt. Sådana ändringar SHALL bara göras av serverkod som har validerat beskrivningen mot appschemat, så att en ogiltig eller manipulerad beskrivning aldrig hamnar i databasen från klienten.

#### Scenario: Klient skriver beskrivning
- **WHEN** en inloggad administratör försöker spara en ny appversion direkt
- **THEN** det avvisas

### Requirement: Versioner kan inte ändras
Varje sparad appbeskrivning SHALL vara en ny version med ett löpnummer per app, och appens aktuella beskrivning SHALL vara den senaste versionen. En version MUST aldrig kunna ändras eller tas bort i efterhand, så att ångra alltid görs genom att spara en äldre beskrivning som en ny version.

#### Scenario: Ändra gammal version
- **WHEN** någon försöker ändra eller ta bort en befintlig appversion
- **THEN** det avvisas och versionen är oförändrad

#### Scenario: Ångra
- **WHEN** en tidigare version sparas på nytt
- **THEN** den blir en ny version med högre löpnummer och är appens aktuella beskrivning

### Requirement: Generisk lagring av poster
All data i användarnas appar SHALL lagras som poster i en och samma struktur, där varje post anger app, samling och sina fältvärden som ett JSON-objekt nycklat på fält-id. En ny app eller samling MUST aldrig kräva en ny tabell. En post MUST höra till en samling som finns i appens aktuella beskrivning.

#### Scenario: Post i okänd samling
- **WHEN** en medlem försöker skapa en post i samlingen `lankar` som inte finns i appens aktuella beskrivning
- **THEN** det avvisas

### Requirement: Åtkomst per samling
Medlemmars rätt till poster SHALL följa samlingens åtkomst i appens aktuella beskrivning: `edit` ger läsa, skapa, ändra och ta bort alla poster; `add` ger läsa alla och skapa poster samt ändra egna; `read` ger bara läsa. Administratörer MUST alltid kunna göra allt med hushållets poster.

#### Scenario: Läsbehörighet
- **WHEN** en medlem försöker skapa en post i en samling med åtkomsten `read`
- **THEN** det avvisas

#### Scenario: Ändra annans post vid add
- **WHEN** en medlem försöker ändra en annan medlems post i en samling med åtkomsten `add`
- **THEN** det avvisas

#### Scenario: Administratör
- **WHEN** en administratör ändrar en annan medlems post i en samling med åtkomsten `read`
- **THEN** ändringen sparas

### Requirement: Vem gjorde vad
Varje post SHALL spara vem som skapade den och vem som senast ändrade den och när. Dessa uppgifter MUST sättas av systemet och MUST inte kunna förfalskas av klienten.

#### Scenario: Förfalskad skapare
- **WHEN** en medlem skapar en post och anger en annan person som skapare
- **THEN** posten sparas med den inloggade personen som skapare

### Requirement: Storleksgränser för lagrad data
En enskild post MUST avvisas om dess fältvärden är större än 64 kB, och en appbeskrivning MUST avvisas om den är större än 256 kB.

#### Scenario: För stor post
- **WHEN** en medlem försöker spara en post vars fältvärden är större än 64 kB
- **THEN** det avvisas

### Requirement: Önskemål
Hushållets medlemmar SHALL kunna spara önskemål om sådant appen eller Pailo inte kan i dag, valfritt kopplade till en app, och läsa hushållets önskemål. Önskemål MUST bara vara synliga inom hushållet.

#### Scenario: Spara önskemål
- **WHEN** en medlem sparar önskemålet "skicka sms till barnen"
- **THEN** önskemålet finns med medlemmen som avsändare och kan läsas av hushållets medlemmar


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

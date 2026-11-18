## Purpose

Beskriver vem som når en app: varje person har ett eget konto, och en app delas med dem som ska använda den. Förmågan omfattar ägare och medlemmar, inbjudan per app, att ta bort och lämna, och att appar är helt isolerade från dem som inte är medlemmar.

## ADDED Requirements

### Requirement: Konto per person
Varje person SHALL ha ett eget konto. Det MUST inte finnas någon gemensam enhet över apparna, och en person SHALL nå precis de appar där hen är ägare eller medlem.

#### Scenario: Nytt konto utan appar
- **WHEN** en person loggar in för första gången utan inbjudan
- **THEN** personen är inte medlem i någon app och kan börja bygga en egen

### Requirement: Ägare och medlemmar
Varje app SHALL ha exakt en ägare och noll eller flera medlemmar. Den som bygger en app MUST bli dess ägare i samma steg, så att en app aldrig finns utan ägare. Bara ägaren MUST kunna ändra appen, bjuda in, se och återkalla inbjudningar och ta bort medlemmar. Varje medlem SHALL ha ett visningsnamn i appen som bara hen själv kan ändra.

#### Scenario: Ny app
- **WHEN** en person bygger en ny app
- **THEN** personen är appens ägare och dess enda medlem

#### Scenario: Medlem försöker bli ägare
- **WHEN** en medlem försöker ändra sin roll till ägare
- **THEN** det avvisas och rollen är oförändrad

#### Scenario: Eget visningsnamn
- **WHEN** en medlem ändrar sitt namn i appen till "Pappa"
- **THEN** ser appens övriga medlemmar namnet "Pappa", men namnet i personens andra appar är oförändrat

### Requirement: Inbjudan till en app
Ägaren SHALL kunna skapa en inbjudan till en app. Inbjudan SHALL ge en länk med en hemlighet som visas en enda gång, och systemet MUST bara spara en hash av hemligheten. En inbjudan MUST gå ut efter 3 dagar och MUST bara kunna användas en gång.

#### Scenario: Medlem försöker bjuda in
- **WHEN** en medlem som inte är ägare försöker skapa en inbjudan
- **THEN** det avvisas

#### Scenario: Hemligheten sparas inte
- **WHEN** ägaren skapar en inbjudan
- **THEN** databasen innehåller bara en hash av hemligheten

### Requirement: Ta emot inbjudan
En inloggad person som öppnar en giltig inbjudningslänk SHALL bli medlem i appen med rollen `member`. En utgången, redan använd, återkallad eller okänd inbjudan MUST avvisas utan att avslöja vilken app den gäller. Den som redan är medlem SHALL förbli medlem utan att inbjudan förbrukas.

#### Scenario: Giltig inbjudan
- **WHEN** en inloggad person tar emot en giltig inbjudan till Matschema
- **THEN** personen är medlem i Matschema och inbjudan är förbrukad

#### Scenario: Okänd inbjudan
- **WHEN** någon tar emot en inbjudan med en påhittad hemlighet
- **THEN** det avvisas och svaret säger inget om någon app

### Requirement: Återkalla inbjudan
Ägaren SHALL kunna se och återkalla appens oanvända inbjudningar. En återkallad inbjudan MUST inte gå att använda.

#### Scenario: Återkallad inbjudan
- **WHEN** ägaren återkallar en inbjudan och någon sedan försöker ta emot den
- **THEN** det avvisas

### Requirement: Ta bort och lämna
Ägaren SHALL kunna ta bort en medlem ur appen, och en medlem SHALL kunna lämna appen själv. Efteråt MUST personen sakna åtkomst till appen, dess versioner och poster. Ägaren MUST inte kunna lämna sin egen app.

#### Scenario: Medlem lämnar
- **WHEN** en medlem lämnar Matschema
- **THEN** personen ser inte längre Matschema bland sina appar och kan inte läsa dess poster

#### Scenario: Ägaren tar bort en medlem
- **WHEN** ägaren tar bort en medlem
- **THEN** personen kan inte längre läsa appen eller dess poster

#### Scenario: Ägaren försöker lämna
- **WHEN** ägaren försöker lämna sin egen app
- **THEN** det avvisas och appen har kvar sin ägare

### Requirement: Isolering mellan appar
En person MUST bara kunna läsa, skapa, ändra eller ta bort data i appar där hen är ägare eller medlem. Det MUST gälla varje tabell och varje funktion i databasen, och MUST bevisas av automatiska tester i CI med tre testkonton: en ägare, en medlem och en person utan koppling till appen.

#### Scenario: Läsa en app man inte är med i
- **WHEN** testkonto C försöker läsa appen, dess medlemmar, inbjudningar, versioner, poster, önskemål eller kostnadslogg i en app där C inte är medlem
- **THEN** inga rader returneras

#### Scenario: Skriva i en app man inte är med i
- **WHEN** testkonto C försöker skapa, ändra eller ta bort poster, medlemmar eller inbjudningar i en app där C inte är medlem
- **THEN** det avvisas och ingenting ändras

#### Scenario: Medlem i en app, inte i en annan
- **WHEN** testkonto B är medlem i Matschema men inte i ägarens app Drop och försöker läsa Drops poster
- **THEN** inga rader returneras

# households Specification

## Purpose

Hushållet är Pailos enhet för delning och behörighet. Den här förmågan beskriver hur hushåll skapas, vilka som är medlemmar och med vilken roll, hur nya medlemmar bjuds in och att hushåll är helt isolerade från varandra.

## Requirements

### Requirement: Skapa hushåll
En inloggad person SHALL kunna skapa ett hushåll med ett namn. Den som skapar hushållet MUST bli dess administratör i samma steg, så att ett hushåll aldrig finns utan administratör.

#### Scenario: Nytt hushåll
- **WHEN** en inloggad person skapar hushållet "Familjen"
- **THEN** hushållet finns och personen är dess enda medlem med rollen administratör

#### Scenario: Utloggad
- **WHEN** någon som inte är inloggad försöker skapa ett hushåll
- **THEN** det avvisas och inget hushåll skapas

### Requirement: Medlemmar och roller
Varje medlem i ett hushåll SHALL ha rollen `admin` eller `member`. Medlemmar SHALL kunna se hushållet och dess övriga medlemmar och ändra sitt eget visningsnamn. Bara administratörer MUST kunna ändra namn på hushållet, ändra roller och ta bort andra medlemmar.

#### Scenario: Medlem ändrar roll
- **WHEN** en medlem med rollen `member` försöker göra sig själv till administratör
- **THEN** ändringen avvisas

#### Scenario: Administratör tar bort medlem
- **WHEN** en administratör tar bort en annan medlem
- **THEN** personen är inte längre medlem och kan inte se hushållets data

### Requirement: Alltid minst en administratör
Ett hushåll MUST alltid ha minst en administratör. En ändring som skulle ta bort eller nedgradera den sista administratören MUST avvisas.

#### Scenario: Sista administratören lämnar
- **WHEN** hushållets enda administratör försöker lämna hushållet
- **THEN** det avvisas

### Requirement: Lämna hushåll
En medlem SHALL kunna lämna ett hushåll själv. Efteråt MUST personen sakna åtkomst till hushållets data.

#### Scenario: Medlem lämnar
- **WHEN** en medlem lämnar hushållet
- **THEN** personen kan inte längre läsa hushållets appar eller poster

### Requirement: Inbjudan med tidsbegränsad länk
En administratör SHALL kunna skapa en inbjudan till sitt hushåll. Inbjudan SHALL ge en länk med en hemlighet som visas en enda gång; systemet MUST bara spara en hash av hemligheten. En inbjudan MUST gå ut efter 3 dagar och MUST bara kunna användas en gång.

#### Scenario: Medlem bjuder in
- **WHEN** en medlem som inte är administratör försöker skapa en inbjudan
- **THEN** det avvisas

#### Scenario: Hemligheten sparas inte
- **WHEN** en inbjudan har skapats
- **THEN** hemligheten i länken går inte att läsa ut ur databasen

### Requirement: Ta emot inbjudan
En inloggad person som öppnar en giltig inbjudningslänk SHALL bli medlem i hushållet med rollen `member`. En utgången, redan använd, återkallad eller okänd inbjudan MUST avvisas utan att avslöja vilket hushåll den gäller. Den som redan är medlem SHALL förbli medlem utan att inbjudan förbrukas.

#### Scenario: Giltig inbjudan
- **WHEN** en inloggad person tar emot en giltig inbjudan
- **THEN** personen är medlem i hushållet och inbjudan är förbrukad

#### Scenario: Utgången inbjudan
- **WHEN** en inbjudan som är äldre än 3 dagar tas emot
- **THEN** det avvisas och personen blir inte medlem

#### Scenario: Använd två gånger
- **WHEN** en andra person tar emot en redan använd inbjudan
- **THEN** det avvisas

### Requirement: Återkalla inbjudan
En administratör SHALL kunna se och återkalla hushållets oanvända inbjudningar. En återkallad inbjudan MUST inte gå att använda.

#### Scenario: Återkallad inbjudan
- **WHEN** en administratör återkallar en inbjudan och någon sedan försöker ta emot den
- **THEN** det avvisas

### Requirement: Isolering mellan hushåll
En person MUST bara kunna läsa, skapa, ändra eller ta bort data i hushåll där personen är medlem. Det MUST gälla varje tabell och varje funktion i databasen, och MUST bevisas av automatiska tester som körs i CI för två testkonton i olika hushåll.

#### Scenario: Läsa annat hushåll
- **WHEN** testkonto B försöker läsa hushåll, medlemmar, inbjudningar, appar, versioner, poster eller önskemål i A:s hushåll
- **THEN** inga rader returneras

#### Scenario: Skriva i annat hushåll
- **WHEN** testkonto B försöker skapa, ändra eller ta bort något i A:s hushåll, eller lägga till sig själv som medlem där
- **THEN** det avvisas eller påverkar inga rader, och A:s data är oförändrad

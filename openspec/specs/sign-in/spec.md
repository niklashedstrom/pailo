# sign-in Specification

## Purpose

Beskriver hur en person loggar in i Pailo utan lösenord och tar sig in i ett hushåll, antingen genom att skapa ett eget eller genom en inbjudningslänk.

## Requirements

### Requirement: Inloggning med magisk länk
En person SHALL kunna logga in genom att ange sin e-postadress och klicka på en länk som skickas dit. Inga lösenord SHALL användas. Gränssnittet MUST vara på svenska och MUST inte innehålla tekniska ord.

#### Scenario: Begär länk
- **WHEN** en person anger sin e-postadress på inloggningssidan
- **THEN** sidan berättar att en länk har skickats till adressen

#### Scenario: Följer länken
- **WHEN** personen öppnar länken från mejlet
- **THEN** personen är inloggad i Pailo

### Requirement: Utloggning
En inloggad person SHALL kunna logga ut. Efteråt MUST personen inte komma åt något hushålls data förrän hen loggar in igen.

#### Scenario: Logga ut
- **WHEN** en inloggad person loggar ut
- **THEN** inloggningssidan visas

### Requirement: Första gången
En inloggad person som inte är medlem i något hushåll SHALL få skapa ett hushåll genom att ange dess namn.

#### Scenario: Nytt konto
- **WHEN** en person loggar in för första gången utan inbjudan
- **THEN** sidan ber personen namnge sitt hushåll

### Requirement: Bjuda in via länk
En administratör SHALL kunna skapa en inbjudningslänk till sitt hushåll och kopiera eller dela den. Sidan MUST berätta att länken gäller i 3 dagar och kan användas en gång.

#### Scenario: Skapa länk
- **WHEN** en administratör väljer att bjuda in någon
- **THEN** en länk visas som kan kopieras eller delas

### Requirement: Öppna inbjudningslänk
En person som öppnar en inbjudningslänk SHALL först få logga in om hen inte är inloggad och därefter bli medlem i hushållet. Om inbjudan inte går att använda SHALL sidan säga det på vanlig svenska och be personen be om en ny länk.

#### Scenario: Utloggad öppnar länk
- **WHEN** en person som inte är inloggad öppnar en giltig inbjudningslänk och loggar in
- **THEN** personen blir medlem i hushållet utan att behöva öppna länken igen

#### Scenario: Ogiltig länk
- **WHEN** en person öppnar en utgången eller redan använd inbjudningslänk
- **THEN** sidan säger att länken inte längre fungerar och att personen kan be om en ny

### Requirement: Se sitt hushåll
En inloggad medlem SHALL kunna se hushållets namn och medlemmar. Det räcker att visa ett hushåll i taget; om personen är medlem i flera SHALL hen kunna välja vilket.

#### Scenario: Medlemslista
- **WHEN** en medlem öppnar Pailo
- **THEN** hushållets namn och medlemmarnas namn visas

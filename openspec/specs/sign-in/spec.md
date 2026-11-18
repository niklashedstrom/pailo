# sign-in Specification

## Purpose

Beskriver hur en person loggar in i Pailo utan lösenord och tar sig till sina appar, eller till en app genom en inbjudningslänk.

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
En inloggad person SHALL kunna logga ut, både i verkstaden och på en apps egen adress. Efteråt MUST personen inte komma åt någon apps data förrän hen loggar in igen.

#### Scenario: Logga ut
- **WHEN** en inloggad person loggar ut
- **THEN** inloggningssidan visas

#### Scenario: Logga ut i appen
- **WHEN** en medlem loggar ut på matschemats adress
- **THEN** matschemats inloggningssida visas och inga poster syns

### Requirement: Första gången
En inloggad person som inte är medlem i någon app SHALL komma till sina appar i verkstaden, som säger att det inte finns några appar än och erbjuder att bygga en. Personen MUST inte behöva namnge något innan hen kan börja.

#### Scenario: Nytt konto
- **WHEN** en person loggar in för första gången utan inbjudan
- **THEN** verkstaden visas med en tom applista och fältet för att beskriva en ny app

### Requirement: Bjuda in via länk
Appens ägare SHALL kunna skapa en inbjudningslänk till appen i verkstaden och kopiera eller dela den. Sidan MUST berätta att länken gäller i 3 dagar, kan användas en gång och ger tillgång till just den appen.

#### Scenario: Skapa länk
- **WHEN** ägaren väljer att bjuda in någon till matschemat
- **THEN** en länk till matschemats adress visas som kan kopieras eller delas

### Requirement: Öppna inbjudningslänk
En person som öppnar en inbjudningslänk SHALL först få logga in på appens inloggningssida om hen inte är inloggad och därefter bli medlem i appen. Om inbjudan inte går att använda SHALL sidan säga det på vanlig svenska och be personen be ägaren om en ny länk.

#### Scenario: Utloggad öppnar länk
- **WHEN** en person som inte är inloggad öppnar en giltig inbjudningslänk och loggar in
- **THEN** personen blir medlem i appen utan att behöva öppna länken igen

#### Scenario: Ogiltig länk
- **WHEN** en person öppnar en utgången eller redan använd inbjudningslänk
- **THEN** sidan säger att länken inte längre fungerar och att personen kan be om en ny

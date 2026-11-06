# database-rollout Specification

## Purpose

Beskriver hur databasändringar testas och rullas ut, så att molnprojektet alltid har samma schema och behörighetsregler som har testats i CI och inget når molnet utan att ha passerat testerna.

## Requirements

### Requirement: Migreringar testas före sammanslagning
Varje pull request SHALL köra alla databasmigreringar från tom databas och alla databastester. En pull request där en migrering eller ett test misslyckas MUST inte kunna slås samman.

#### Scenario: Trasig policy
- **WHEN** en pull request innehåller en ändring som låter hushåll B läsa A:s poster
- **THEN** databastesterna misslyckas och CI är röd

### Requirement: Utrullning efter sammanslagning
När `main` ändras och databastesterna har passerat SHALL nya migreringar köras mot molnprojektet automatiskt. Utrullningen MUST bara köra migreringar som inte redan körts och MUST stoppa vid första fel.

#### Scenario: Ny migrering på main
- **WHEN** en pull request med en ny migrering slås samman
- **THEN** migreringen körs mot molnprojektet och syns i dess migreringshistorik

#### Scenario: Inget nytt
- **WHEN** `main` ändras utan nya migreringar
- **THEN** utrullningen gör ingenting och lyckas

### Requirement: Hemligheter utanför koden
Åtkomst till molnprojektet MUST ske med hemligheter som lagras i GitHub och Vercel, aldrig i repot. Runtime MUST bara få projektets adress och publika nyckel, aldrig nycklar som kringgår behörighetsreglerna.

#### Scenario: Klientens nycklar
- **WHEN** runtime byggs för produktion
- **THEN** den byggda koden innehåller bara projektets adress och publika nyckel

# Spec Delta

## Purpose

Säkerställer att varje ändring i Pailo kontrolleras automatiskt innan den når `main`, och att det som finns på `main` alltid går att köra som en app.

## ADDED Requirements

### Requirement: Automatiska kontroller på varje ändring
Varje pull request och varje push till `main` SHALL köra lint, typkontroll, enhetstester och bygge av runtime-appen. En ändring där någon kontroll misslyckas MUST NOT anses klar för sammanslagning.

#### Scenario: Grön ändring
- **WHEN** en pull request öppnas där lint, typkontroll, tester och bygge passerar
- **THEN** CI rapporterar alla kontroller som gröna

#### Scenario: Trasigt test
- **WHEN** en pull request innehåller ett test som misslyckas
- **THEN** CI rapporterar kontrollen som röd och ändringen markeras som ej klar

### Requirement: Databasmigreringar och databastester i CI
Varje pull request och push till `main` SHALL applicera alla databasmigreringar från noll mot en tom databas och köra databastesterna (pgTAP). En migrering som inte går att applicera eller ett databastest som misslyckas MUST göra CI röd.

#### Scenario: Migreringar går att applicera
- **WHEN** CI startar en tom databas och applicerar alla migreringar
- **THEN** samtliga migreringar lyckas och databastesterna passerar

#### Scenario: Trasig migrering
- **WHEN** en pull request innehåller en migrering med ogiltig SQL
- **THEN** CI rapporterar databaskontrollen som röd

### Requirement: Förhandsvisning per pull request
Varje pull request SHALL få en egen förhandsvisningsadress där runtime-appen från den grenen går att öppna.

#### Scenario: Ny pull request
- **WHEN** en pull request öppnas mot `main`
- **THEN** en förhandsvisningsadress publiceras och visar appen från den grenen

### Requirement: Deploy från main
Varje ändring som slås ihop till `main` SHALL deployas automatiskt till produktionsadressen.

#### Scenario: Sammanslagning
- **WHEN** en pull request slås ihop till `main`
- **THEN** produktionsadressen visar den nya versionen av appen

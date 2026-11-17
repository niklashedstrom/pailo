## MODIFIED Requirements

### Requirement: Personer och åtkomst
Varje samling SHALL ange vad appens medlemmar får göra med dess poster: `edit` (skapa, ändra och ta bort alla), `add` (skapa och ändra egna) eller `read` (bara läsa). Appens ägare MUST alltid kunna ändra allt. En appbeskrivning SHALL kunna lista personer utan konto (till exempel barn) med id och namn, så att `person`-fält kan peka på dem.

#### Scenario: Okänd åtkomstnivå
- **WHEN** en samling anger åtkomsten `admin-only`
- **THEN** valideringen avvisar beskrivningen

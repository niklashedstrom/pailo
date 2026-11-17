## ADDED Requirements

### Requirement: Åtkomst per samling och roll i appen
Medlemmars rätt till poster SHALL följa samlingens åtkomst i appens aktuella beskrivning: `edit` ger läsa, skapa, ändra och ta bort alla poster; `add` ger läsa alla och skapa poster samt ändra egna; `read` ger bara läsa. Appens ägare MUST alltid kunna göra allt med appens poster.

#### Scenario: Läsbehörighet
- **WHEN** en medlem försöker skapa en post i en samling med åtkomsten `read`
- **THEN** det avvisas

#### Scenario: Ändra annans post vid add
- **WHEN** en medlem försöker ändra en annan medlems post i en samling med åtkomsten `add`
- **THEN** det avvisas

#### Scenario: Ägaren
- **WHEN** appens ägare ändrar en annan medlems post i en samling med åtkomsten `read`
- **THEN** ändringen sparas

### Requirement: Appar har en ägare och medlemmar
Varje app SHALL ha en ägare och kunna läsas av sina medlemmar, och MUST inte kunna läsas av någon annan. En app SHALL kunna ange vilken app den kopierades från, så att delning som mall kan läggas till senare utan ny datamodell. Appens ägare MUST inte kunna bytas av en klient.

#### Scenario: Person listar sina appar
- **WHEN** en person listar appar
- **THEN** de appar där personen är ägare eller medlem returneras, och inga andra

#### Scenario: Ägaren flyttas inte
- **WHEN** en klient försöker ändra appens ägare
- **THEN** det avvisas

## MODIFIED Requirements

### Requirement: Appbeskrivningar skrivs bara från servern
Inloggade användare MUST inte kunna skapa eller ändra appar eller appversioner direkt. Sådana ändringar SHALL bara göras av serverkod som har validerat beskrivningen mot appschemat, så att en ogiltig eller manipulerad beskrivning aldrig hamnar i databasen från klienten.

#### Scenario: Klient skriver beskrivning
- **WHEN** appens inloggade ägare försöker spara en ny appversion direkt
- **THEN** det avvisas

### Requirement: Önskemål
Önskemål om sådant Pailo inte kan i dag SHALL sparas på personen som skrev dem, valfritt kopplade till en app där personen är medlem. En person SHALL kunna läsa sina egna önskemål, och appens ägare SHALL kunna läsa önskemål kopplade till appen. Önskemål MUST inte vara synliga för någon annan.

#### Scenario: Spara önskemål
- **WHEN** en medlem i matschemat sparar önskemålet "skicka sms till barnen"
- **THEN** önskemålet finns med medlemmen som avsändare och kan läsas av medlemmen och matschemats ägare

#### Scenario: Annan app
- **WHEN** en person försöker koppla ett önskemål till en app där hen inte är medlem
- **THEN** det avvisas

### Requirement: Format för val, personer och kopplingar
Ett valfält SHALL lagra alternativets värde, och en lista av värden om fältet tillåter flera. Ett personfält SHALL peka ut antingen en medlem i appen eller en av beskrivningens personer utan konto, så att de två aldrig kan förväxlas, och SHALL vara en lista om fältet tillåter flera. Ett kopplingsfält SHALL lagra id för en post i den kopplade samlingen.

#### Scenario: Person utan konto
- **WHEN** Ella väljs i fältet Vem lagar
- **THEN** värdet pekar ut personen `barn-1` i beskrivningen och inte en medlem i appen

#### Scenario: Flera val
- **WHEN** en post i Drop får etiketterna Läs senare och Recept
- **THEN** värdet sparas som listan `["las-senare", "recept"]`

## REMOVED Requirements

### Requirement: Appar tillhör ett hushåll
**Reason**: Hushållet är borttaget; en app har en ägare och medlemmar.
**Migration**: Se kravet "Appar har en ägare och medlemmar" och `app-sharing`.

### Requirement: Åtkomst per samling
**Reason**: Administratören i hushållet ersätts av appens ägare.
**Migration**: Se kravet "Åtkomst per samling och roll i appen".

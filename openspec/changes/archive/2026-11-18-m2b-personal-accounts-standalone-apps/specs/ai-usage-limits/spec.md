## ADDED Requirements

### Requirement: Kvot per person
Varje person SHALL ha en kvot för byggsamtal per kalendermånad, 20 om inget annat är satt för personen, som gäller alla appar personen bygger och ändrar. Varje önskemål som når AI-tjänsten SHALL räknas, även om det inte gav en ny version; ångra och återställning SHALL inte räknas. När kvoten är slut SHALL byggandet för personen pausas till nästa månad medan alla appar fungerar som vanligt.

#### Scenario: Kvoten slut
- **WHEN** en person har använt hela månadens kvot och skickar ett önskemål
- **THEN** det stoppas med beskedet att månadens ändringar är slut och när de fylls på

#### Scenario: Ångra när kvoten är slut
- **WHEN** kvoten är slut och ägaren ångrar den senaste ändringen
- **THEN** ångra fungerar

#### Scenario: Medlemmarnas appar påverkas inte
- **WHEN** ägarens kvot är slut och en medlem lägger till en post i ägarens app
- **THEN** posten sparas som vanligt

### Requirement: Loggen stannar hos personen
En person MUST bara kunna läsa loggrader för sina egna anrop, och MUST aldrig kunna läsa andras rader eller den globala kostnaden.

#### Scenario: Någon annans kostnad
- **WHEN** person A försöker läsa loggrader för person B:s anrop
- **THEN** inga rader visas

## MODIFIED Requirements

### Requirement: Kontroller före anropet
Varje kontroll av nödbroms, hastighet, längd och kvot MUST göras innan AI-tjänsten anropas. Stoppas ett önskemål av en kontroll MUST AI-tjänsten inte anropas och ingen kostnad uppstå.

#### Scenario: Stoppad före anropet
- **WHEN** ett önskemål stoppas av någon av kontrollerna
- **THEN** AI-tjänsten anropas inte och inget räknas mot personens kvot

### Requirement: Nödbromsen är på från början
I molnet SHALL nödbromsen vara på tills ägaren av Pailo aktivt slår av den. Bara serverkod och Pailos ägare via databasen MUST kunna ändra nödbroms, dygnstak och kvoter; inloggade användare MUST inte kunna det.

#### Scenario: Ny miljö
- **WHEN** databasen har rullats ut och ingen har ändrat inställningarna
- **THEN** byggandet är pausat

#### Scenario: Användare försöker slå av
- **WHEN** en inloggad person försöker ändra nödbromsen eller sin kvot
- **THEN** det avvisas

### Requirement: Samtidiga anrop kan inte passera taket
Kontrollen av tak, kvot och hastighet SHALL räkna med anrop som pågår, så att flera samtidiga önskemål inte tillsammans kan passera en gräns.

#### Scenario: Två samtidiga önskemål vid sista kvoten
- **WHEN** en person har ett byggsamtal kvar av månadens kvot och skickar två önskemål samtidigt från två flikar
- **THEN** högst ett av dem når AI-tjänsten

### Requirement: Hastighetsgräns
Varje person SHALL kunna skicka högst 10 önskemål i timmen, och varje app SHALL kunna ta emot högst 30 i timmen. Över gränsen SHALL personen få veta när det går att fortsätta.

#### Scenario: Elfte önskemålet
- **WHEN** en person skickar sitt elfte önskemål inom en timme
- **THEN** det stoppas och personen får veta ungefär när nästa går att skicka

### Requirement: Kvar av kvoten syns
En person SHALL kunna se hur många byggsamtal hen har kvar den här månaden.

#### Scenario: Se vad som är kvar
- **WHEN** ägaren öppnar fältet för att ändra en app
- **THEN** hen ser hur många ändringar hen har kvar den här månaden

### Requirement: Kostnadslogg
Varje anrop till AI-tjänsten SHALL loggas med person, app, modell, tokens in och ut (även cachade), beräknad kostnad, resultat och tid. Ett anrop som misslyckas eller avbryts SHALL också loggas. Inloggade användare MUST inte kunna ändra loggen.

#### Scenario: Ett lyckat anrop
- **WHEN** ett byggsamtal har gett en ny version
- **THEN** loggen har en rad med personen, appen, modellen, tokens, kostnaden och att det lyckades

#### Scenario: Ett anrop som avbryts
- **WHEN** AI-tjänsten slutar svara mitt i ett anrop
- **THEN** loggen har en rad för anropet med resultatet att det misslyckades

## REMOVED Requirements

### Requirement: Kvot per hushåll
**Reason**: Kvoten gäller den som bygger, inte ett hushåll.
**Migration**: Se kravet "Kvot per person". Satta hushållskvoter flyttas till hushållets äldsta administratör.

### Requirement: Loggen stannar i hushållet
**Reason**: Loggrader hör till personen som gjorde anropet.
**Migration**: Se kravet "Loggen stannar hos personen".

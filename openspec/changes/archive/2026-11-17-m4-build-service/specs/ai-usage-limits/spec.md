# Spec Delta

## Purpose

Beskriver skyddet runt varje anrop till AI-tjänsten, så att kostnaden alltid har ett tak och missbruk stoppas innan något kostar: nödbroms, hastighetsgränser, längdgräns, kvot per hushåll och kostnadslogg.

## ADDED Requirements

### Requirement: Kontroller före anropet
Varje kontroll av nödbroms, hastighet, längd och kvot MUST göras innan AI-tjänsten anropas. Stoppas ett önskemål av en kontroll MUST AI-tjänsten inte anropas och ingen kostnad uppstå.

#### Scenario: Stoppad före anropet
- **WHEN** ett önskemål stoppas av någon av kontrollerna
- **THEN** AI-tjänsten anropas inte och inget räknas mot hushållets kvot

### Requirement: Nödbroms
Det SHALL finnas en global nödbroms som pausar allt byggande i hela Pailo. Byggandet SHALL pausas automatiskt när den totala AI-kostnaden för dygnet når dygnstaket. När byggandet är pausat SHALL medlemmen få ett vänligt besked, och appar och poster SHALL fungera som vanligt.

#### Scenario: Dygnstaket nås
- **WHEN** dygnets totala AI-kostnad når taket
- **THEN** nya önskemål stoppas med beskedet att byggandet är pausat en stund, och det loggas att nödbromsen slog till

#### Scenario: Appen fungerar ändå
- **WHEN** byggandet är pausat och en medlem lägger till en post i en app
- **THEN** posten sparas som vanligt

### Requirement: Nödbromsen är på från början
I molnet SHALL nödbromsen vara på tills ägaren aktivt slår av den. Bara serverkod och ägaren via databasen MUST kunna ändra nödbroms, dygnstak och kvoter; inloggade användare MUST inte kunna det.

#### Scenario: Ny miljö
- **WHEN** databasen har rullats ut och ingen har ändrat inställningarna
- **THEN** byggandet är pausat

#### Scenario: Användare försöker slå av
- **WHEN** en inloggad administratör försöker ändra nödbromsen eller kvoten
- **THEN** det avvisas

### Requirement: Samtidiga anrop kan inte passera taket
Kontrollen av tak, kvot och hastighet SHALL räkna med anrop som pågår, så att flera samtidiga önskemål inte tillsammans kan passera en gräns.

#### Scenario: Två samtidiga önskemål vid sista kvoten
- **WHEN** ett hushåll har ett byggsamtal kvar av månadens kvot och två medlemmar skickar önskemål samtidigt
- **THEN** högst ett av dem når AI-tjänsten

### Requirement: Hastighetsgräns
Varje person SHALL kunna skicka högst 10 önskemål i timmen, och varje hushåll högst 30 i timmen. Över gränsen SHALL medlemmen få veta när det går att fortsätta.

#### Scenario: Elfte önskemålet
- **WHEN** en person skickar sitt elfte önskemål inom en timme
- **THEN** det stoppas och personen får veta ungefär när nästa går att skicka

### Requirement: Längdgräns
Ett önskemål MUST vara högst 2 000 tecken. Ett längre önskemål SHALL stoppas med beskedet att skriva kortare, och SHALL inte räknas mot kvoten.

#### Scenario: För långt
- **WHEN** en medlem skickar ett önskemål på 5 000 tecken
- **THEN** det stoppas med beskedet att skriva kortare

### Requirement: Kvot per hushåll
Varje hushåll SHALL ha en kvot för byggsamtal per kalendermånad, 20 om inget annat är satt för hushållet. Varje önskemål som når AI-tjänsten SHALL räknas, även om det inte gav en ny version; ångra och återställning SHALL inte räknas. När kvoten är slut SHALL byggandet för hushållet pausas till nästa månad medan apparna fungerar som vanligt.

#### Scenario: Kvoten slut
- **WHEN** ett hushåll har använt hela månadens kvot och en medlem skickar ett önskemål
- **THEN** det stoppas med beskedet att månadens ändringar är slut och när de fylls på

#### Scenario: Ångra när kvoten är slut
- **WHEN** kvoten är slut och en medlem ångrar den senaste ändringen
- **THEN** ångra fungerar

### Requirement: Kvar av kvoten syns
En medlem SHALL kunna se hur många byggsamtal hushållet har kvar den här månaden.

#### Scenario: Se vad som är kvar
- **WHEN** en medlem öppnar fältet för att ändra en app
- **THEN** hen ser hur många ändringar hushållet har kvar den här månaden

### Requirement: Kostnadslogg
Varje anrop till AI-tjänsten SHALL loggas med hushåll, person, app, modell, tokens in och ut (även cachade), beräknad kostnad, resultat och tid. Ett anrop som misslyckas eller avbryts SHALL också loggas. Inloggade användare MUST inte kunna ändra loggen.

#### Scenario: Ett lyckat anrop
- **WHEN** ett byggsamtal har gett en ny version
- **THEN** loggen har en rad med hushållet, personen, appen, modellen, tokens, kostnaden och att det lyckades

#### Scenario: Ett anrop som avbryts
- **WHEN** AI-tjänsten slutar svara mitt i ett anrop
- **THEN** loggen har en rad för anropet med resultatet att det misslyckades

### Requirement: Loggen stannar i hushållet
Medlemmar MUST bara kunna läsa loggrader för sitt eget hushåll, och MUST aldrig kunna läsa andra hushålls rader eller den globala kostnaden.

#### Scenario: Annat hushålls kostnad
- **WHEN** en medlem i hushåll A försöker läsa loggrader för hushåll B
- **THEN** inga rader visas

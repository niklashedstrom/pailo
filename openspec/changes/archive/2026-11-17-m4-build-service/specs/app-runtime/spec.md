# Spec Delta

## MODIFIED Requirements

### Requirement: Inga färdiga appar i produkten
Pailo MUST inte erbjuda inbyggda eller färdiga appar att välja bland. Från M4 SHALL medlemmar kunna skapa appar genom att beskriva dem med egna ord, och appen SHALL byggas av byggtjänsten från byggstenarna. Utvecklare kan fortfarande lägga in beskrivningar lokalt för att prova runtime.

#### Scenario: Tom applista
- **WHEN** en administratör öppnar ett hushåll utan appar
- **THEN** sidan visar inga färdiga appar att lägga till, men ett fält för att beskriva en ny app med egna ord

## ADDED Requirements

### Requirement: Beskriva en ny app
Hushållssidan SHALL ha ett fält där en medlem beskriver vad hen vill ha hjälp med. När byggtjänsten har skapat appen SHALL den öppnas, och sammanfattningen av vad som byggdes SHALL visas.

#### Scenario: Ny app
- **WHEN** en medlem skriver vad hen vill ha hjälp med och skickar
- **THEN** medlemmen ser att appen byggs, och sedan öppnas den nya appen med en sammanfattning

### Requirement: Ändra appen med ord
En öppen app SHALL ha ett fält "Vad vill du ändra?". När ändringen är sparad SHALL appen visas enligt den nya versionen, med sammanfattningen och en knapp för att ångra.

#### Scenario: Ändra och se resultatet
- **WHEN** en medlem skriver en ändring i appen och skickar
- **THEN** appen visas enligt den nya versionen med sammanfattningen och en ångra-knapp

#### Scenario: Ångra från beskedet
- **WHEN** medlemmen trycker på ångra efter en ändring
- **THEN** appen visas som före ändringen

### Requirement: Väntan och besked
Medan byggtjänsten arbetar SHALL runtime visa att något händer och hindra att samma önskemål skickas två gånger. Besked om gränser, kvot, paus, önskemål som inte går och fel SHALL visas i vardagliga ord vid fältet, och det personen skrev SHALL finnas kvar.

#### Scenario: Kvoten slut
- **WHEN** en medlem skickar en ändring och hushållets kvot är slut
- **THEN** beskedet visas vid fältet och texten personen skrev finns kvar

#### Scenario: Dubbeltryck
- **WHEN** en medlem trycker två gånger snabbt på skicka
- **THEN** bara ett önskemål skickas

### Requirement: Versionslista
En öppen app SHALL kunna visa sina versioner, senaste först, med tid, vem som gjorde ändringen och sammanfattningen. En medlem SHALL kunna välja "Gå tillbaka hit" på en tidigare version och då se appen enligt den.

#### Scenario: Gå tillbaka
- **WHEN** en medlem väljer "Gå tillbaka hit" på en äldre version
- **THEN** appen visas enligt den versionen och versionslistan har en ny version överst

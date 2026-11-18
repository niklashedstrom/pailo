## ADDED Requirements

### Requirement: App utan tillgång
Öppnas en app som inte finns eller där personen inte är medlem SHALL runtime visa att appen inte kunde hittas eller att personen inte har tillgång, enligt `standalone-app`. Runtime MUST inte visa något om appens innehåll eller medlemmar.

#### Scenario: Någon annans app
- **WHEN** en inloggad person öppnar adressen till en app där hen inte är medlem
- **THEN** sidan säger att personen inte har tillgång och visar inget av appens innehåll

### Requirement: Mina appar
Verkstaden SHALL lista personens appar med namn och ikon: först de personen äger, sedan de hen är medlem i med ägarens namn. Varje app SHALL kunna öppnas på sin egen adress, och för egna appar SHALL verkstaden kunna öppna appen för att ändra den. Finns inga appar SHALL sidan säga det i vardagliga ord.

#### Scenario: Öppna en app
- **WHEN** en person trycker på Matschema i sin applista
- **THEN** matschemat öppnas på sin egen adress med sin första vy

#### Scenario: Delad app
- **WHEN** Bertil har bjudits in till Annas matschema och öppnar verkstaden
- **THEN** matschemat finns i hans lista under appar han är med i, med Annas namn

#### Scenario: Inga appar
- **WHEN** en person utan appar öppnar verkstaden
- **THEN** sidan säger att det inte finns några appar än

### Requirement: Medlemmar i appen
Ägaren SHALL i verkstaden kunna se appens medlemmar, bjuda in, se och återkalla oanvända inbjudningar och ta bort en medlem. En medlem SHALL kunna ändra sitt namn i appen och lämna appen från appens adress.

#### Scenario: Ägaren ser medlemmarna
- **WHEN** ägaren öppnar medlemmarna för matschemat
- **THEN** medlemmarnas namn visas tillsammans med knappar för att bjuda in och ta bort

#### Scenario: Lämna appen
- **WHEN** en medlem väljer att lämna matschemat och bekräftar
- **THEN** matschemat försvinner från personens appar och adressen säger att personen inte har tillgång

### Requirement: Delat mellan appens medlemmar
Två medlemmar i samma app SHALL se samma poster. När en medlem kommer tillbaka till appen efter att ha varit i en annan flik eller app SHALL appens poster hämtas på nytt.

#### Scenario: Två konton
- **WHEN** Anna planerar en måltid i matschemat och Bertil, som är medlem i matschemat, sedan går tillbaka till appen
- **THEN** Bertil ser måltiden i vyn Veckan

## MODIFIED Requirements

### Requirement: Inga färdiga appar i produkten
Pailo MUST inte erbjuda inbyggda eller färdiga appar att välja bland. Personer SHALL skapa appar genom att beskriva dem med egna ord, och appen SHALL byggas av byggtjänsten från byggstenarna. Utvecklare kan fortfarande lägga in beskrivningar lokalt för att prova runtime.

#### Scenario: Tom applista
- **WHEN** en person utan appar öppnar verkstaden
- **THEN** sidan visar inga färdiga appar att lägga till, men ett fält för att beskriva en ny app med egna ord

### Requirement: Formulär efter fälttyp
Formuläret SHALL ha en kontroll per fält som passar fälttypen: textfält (flerradigt om fältet är det), datum med eller utan tid, länk, val (ett eller flera), person (appens medlemmar och beskrivningens personer utan konto) och koppling (posterna i den kopplade samlingen). Obligatoriska fält SHALL vara markerade, och formuläret MUST inte sparas förrän de är ifyllda.

#### Scenario: Obligatoriskt fält
- **WHEN** en medlem försöker spara en ny rätt utan namn
- **THEN** formuläret sparas inte och säger att namnet behövs

#### Scenario: Personval
- **WHEN** en medlem öppnar fältet Vem lagar
- **THEN** appens medlemmar och Ella och Leo går att välja

### Requirement: Knappar efter behörighet
Runtime SHALL bara visa skapa, ändra och ta bort när personen får göra det enligt samlingens åtkomst och sin roll i appen: `edit` ger allt, `add` ger skapa och ändra egna poster, `read` ger inget av det. Appens ägare SHALL se allt. Nekar databasen ändå en ändring SHALL runtime säga det i vardagliga ord och behålla det personen skrev.

#### Scenario: Läsbehörighet
- **WHEN** en medlem som inte är ägare öppnar en samling med åtkomsten `read`
- **THEN** knappar för att skapa, ändra och ta bort visas inte

#### Scenario: Annans post vid add
- **WHEN** en medlem öppnar en annan medlems post i Drop, vars samling har åtkomsten `add`
- **THEN** posten går att läsa men inte att ändra

### Requirement: Klart-kriteriet för M3
De handskrivna beskrivningarna av Drop och matschemat SHALL, när de lagts in som appar, gå att använda i runtime och delas mellan två konton som är medlemmar i appen, med alla sina vyer och formulär.

#### Scenario: Matschemat mellan två konton
- **WHEN** matschemats beskrivning finns som Annas app, Bertil är medlem, Anna lägger in rätten Lasagne och planerar den till onsdag, och Bertil sedan öppnar appen
- **THEN** Bertil ser Lasagne på onsdag i vyn Veckan och kan ändra måltiden

### Requirement: Beskriva en ny app
Verkstaden SHALL ha ett fält där en person beskriver vad hen vill ha hjälp med. När byggtjänsten har skapat appen SHALL den visas i verkstaden med sammanfattningen av vad som byggdes, och personen är appens ägare.

#### Scenario: Ny app
- **WHEN** en person skriver vad hen vill ha hjälp med och skickar
- **THEN** personen ser att appen byggs, och sedan visas den nya appen med en sammanfattning och en länk till appens egen adress

### Requirement: Ändra appen med ord
En egen app som är öppen i verkstaden SHALL ha ett fält "Vad vill du ändra?". När ändringen är sparad SHALL appen visas enligt den nya versionen, med sammanfattningen och en knapp för att ångra. Fältet MUST inte visas för medlemmar som inte är ägare och MUST inte finnas på appens egen adress.

#### Scenario: Ändra och se resultatet
- **WHEN** ägaren skriver en ändring i verkstaden och skickar
- **THEN** appen visas enligt den nya versionen med sammanfattningen och en ångra-knapp

#### Scenario: Ångra från beskedet
- **WHEN** ägaren trycker på ångra efter en ändring
- **THEN** appen visas som före ändringen

#### Scenario: Medlem ser inget byggfält
- **WHEN** en medlem som inte är ägare öppnar matschemat
- **THEN** finns inget fält för att ändra appen

### Requirement: Väntan och besked
Medan byggtjänsten arbetar SHALL runtime visa att något händer och hindra att samma önskemål skickas två gånger. Besked om gränser, kvot, paus, önskemål som inte går och fel SHALL visas i vardagliga ord vid fältet, och det personen skrev SHALL finnas kvar.

#### Scenario: Kvoten slut
- **WHEN** ägaren skickar en ändring och hens kvot för månaden är slut
- **THEN** beskedet visas vid fältet och texten personen skrev finns kvar

#### Scenario: Dubbeltryck
- **WHEN** ägaren trycker två gånger snabbt på skicka
- **THEN** bara ett önskemål skickas

### Requirement: Versionslista
En egen app i verkstaden SHALL kunna visa sina versioner, senaste först, med tid, vem som gjorde ändringen och sammanfattningen. Ägaren SHALL kunna välja "Gå tillbaka hit" på en tidigare version och då se appen enligt den.

#### Scenario: Gå tillbaka
- **WHEN** ägaren väljer "Gå tillbaka hit" på en äldre version
- **THEN** appen visas enligt den versionen och versionslistan har en ny version överst

## REMOVED Requirements

### Requirement: Hushållets appar
**Reason**: Det finns inga hushåll. Applistan finns i verkstaden och varje app har en egen adress.
**Migration**: Se kravet "Mina appar" och `standalone-app`, kravet "Egen adress per app".

### Requirement: Delat mellan hushållets medlemmar
**Reason**: Appen delas mellan sina medlemmar.
**Migration**: Se kravet "Delat mellan appens medlemmar".

### Requirement: App som personen inte når
**Reason**: Hushållet finns inte längre; appen visas på sin egen adress.
**Migration**: Se kravet "App utan tillgång" och `standalone-app`, kravet "Inte medlem i appen".

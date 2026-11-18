# app-runtime Specification

## Purpose

Beskriver hur Pailos enda runtime visar och låter appens medlemmar använda en app, i verkstaden och på appens egen adress, utifrån appens aktuella beskrivning: applistan, vyerna, formulären, temat och vad varje person får göra, utan någon kod per app.

## Requirements

### Requirement: Rendering bara från beskrivningen
Runtime SHALL visa varje app enbart utifrån appens senaste version i databasen. Ingen app MUST ha egen kod, egna adresser utöver app och vy, eller egna tabeller. En beskrivning som inte validerar mot schemat MUST inte visas; i stället SHALL sidan säga att appen inte kan visas just nu.

#### Scenario: Ny version
- **WHEN** en ny version av appen har sparats och medlemmen öppnar appen igen
- **THEN** appen visas enligt den nya versionen

#### Scenario: Ogiltig beskrivning
- **WHEN** appens senaste version inte validerar mot schemat
- **THEN** appen visas inte och sidan säger att den inte kan visas just nu

### Requirement: Varje byggsten fungerar
Runtime SHALL kunna visa och använda varje giltig beskrivning, med varje fälttyp, vytyp, inmatning av typen `form`, åtkomstnivå och temavärde som schemat tillåter, i alla kombinationer schemat tillåter. Ingen del av runtime MUST bero på namn, id eller innehåll i en viss app.

#### Scenario: Alla byggstenar
- **WHEN** en beskrivning som använder varje fälttyp med och utan sina varianter, varje vytyp och varje åtkomstnivå öppnas
- **THEN** varje vy visas och en post går att skapa, ändra och ta bort i varje samling där personen får det

#### Scenario: Okända namn
- **WHEN** en giltig beskrivning har samlingar, fält och vyer med id:n som inte finns i något exempel
- **THEN** appen visas och fungerar som vilken annan app som helst

### Requirement: Inga färdiga appar i produkten
Pailo MUST inte erbjuda inbyggda eller färdiga appar att välja bland. Personer SHALL skapa appar genom att beskriva dem med egna ord, och appen SHALL byggas av byggtjänsten från byggstenarna. Utvecklare kan fortfarande lägga in beskrivningar lokalt för att prova runtime.

#### Scenario: Tom applista
- **WHEN** en person utan appar öppnar verkstaden
- **THEN** sidan visar inga färdiga appar att lägga till, men ett fält för att beskriva en ny app med egna ord

### Requirement: Byta vy
En app med flera vyer SHALL visa vyernas namn i beskrivningens ordning så att medlemmen kan byta vy. Den första vyn SHALL visas när appen öppnas utan vald vy.

#### Scenario: Byt vy
- **WHEN** en medlem i Matschema väljer vyn Rätter
- **THEN** vyn Rätter visas och adressen pekar på den

### Requirement: Listvy
En `list`-vy SHALL visa samlingens poster som en lista med vyns visade fält i angiven ordning, eller alla fält om vyn inte anger några. Har vyn en sortering SHALL posterna sorteras efter den, annars med den senast skapade först.

#### Scenario: Drop
- **WHEN** en medlem öppnar vyn Senaste i Drop
- **THEN** posterna visas med titel, länk och etiketter, senast skapade först

### Requirement: Kortvy
En `cards`-vy SHALL visa samlingens poster som kort med vyns visade fält, och SHALL sortera som listvyn.

#### Scenario: Rätter i bokstavsordning
- **WHEN** en medlem öppnar vyn Rätter i matschemat
- **THEN** rätterna visas som kort sorterade på namn från A till Ö

### Requirement: Kalendervy
En `calendar`-vy SHALL visa samlingens poster på dagen i vyns datumfält, för en vecka (måndag till söndag) eller en månad enligt vyns `range`. Vyn SHALL börja med perioden som innehåller dagens datum och SHALL gå att stega framåt och bakåt. Poster utan giltigt datum SHALL inte visas i kalendern.

#### Scenario: Veckan
- **WHEN** en medlem öppnar vyn Veckan en onsdag
- **THEN** veckans sju dagar från måndag visas med måltiderna på sina dagar

#### Scenario: Nästa vecka
- **WHEN** medlemmen stegar framåt
- **THEN** nästa veckas måltider visas

### Requirement: Översiktsvy
En `overview`-vy SHALL visa en sektion per beskriven sektion, med sektionens titel eller samlingens namn, högst sektionens gräns av poster och sorterat som sektionen anger.

#### Scenario: Gräns per sektion
- **WHEN** en sektion har gränsen 5 och samlingen har 12 poster
- **THEN** sektionen visar 5 poster

### Requirement: Visning av fältvärden
Runtime SHALL visa varje fältvärde efter fälttypen: datum på svenska, valens etiketter i stället för deras värden, personens namn, den kopplade postens titel och länkar som klickbara länkar. Ett värde som saknas eller inte följer formatet SHALL visas som tomt, utan att resten av posten påverkas.

#### Scenario: Koppling
- **WHEN** en måltid kopplad till rätten Lasagne visas
- **THEN** texten Lasagne visas, inte postens id

#### Scenario: Trasigt värde
- **WHEN** en post har ett datum som inte går att läsa
- **THEN** datumet visas som tomt och postens övriga fält visas

### Requirement: Säkra länkar och ingen körbar text
Runtime MUST visa all text från appar och poster som vanlig text, aldrig som HTML. En länk MUST bara bli klickbar om den börjar med `https://` eller `http://`, och SHALL öppnas i en ny flik utan åtkomst till Pailo.

#### Scenario: Farlig länk
- **WHEN** en post har länken `javascript:alert(1)`
- **THEN** den visas som vanlig text och går inte att klicka på

### Requirement: Skapa post
Varje `form`-inmatning SHALL visas som en knapp med inmatningens namn i appen. Knappen SHALL öppna ett formulär med samlingens fält, och en giltig post SHALL sparas i samlingen och visas utan att sidan laddas om.

#### Scenario: Planera en måltid
- **WHEN** en medlem trycker på Planera en måltid, väljer dag, rätt och vem som lagar och sparar
- **THEN** måltiden sparas och syns på rätt dag i vyn Veckan

### Requirement: Formulär efter fälttyp
Formuläret SHALL ha en kontroll per fält som passar fälttypen: textfält (flerradigt om fältet är det), datum med eller utan tid, länk, val (ett eller flera), person (appens medlemmar och beskrivningens personer utan konto) och koppling (posterna i den kopplade samlingen). Obligatoriska fält SHALL vara markerade, och formuläret MUST inte sparas förrän de är ifyllda.

#### Scenario: Obligatoriskt fält
- **WHEN** en medlem försöker spara en ny rätt utan namn
- **THEN** formuläret sparas inte och säger att namnet behövs

#### Scenario: Personval
- **WHEN** en medlem öppnar fältet Vem lagar
- **THEN** appens medlemmar och Ella och Leo går att välja

### Requirement: Bilder kommer senare
Ett fält av typen `image` SHALL visas i formuläret med en text om att bilder inte går att lägga till än. Formuläret MUST ändå gå att spara.

#### Scenario: Ny rätt med bildfält
- **WHEN** en medlem öppnar formuläret Ny rätt
- **THEN** bildfältet säger att bilder inte går att lägga till än och rätten går att spara utan bild

### Requirement: Ändra och ta bort post
En medlem SHALL kunna öppna en post, ändra dess fält och spara, eller ta bort den efter en bekräftelse. Ändringen SHALL synas direkt i vyn.

#### Scenario: Ta bort
- **WHEN** en medlem tar bort en måltid och bekräftar
- **THEN** måltiden försvinner från vyn Veckan

#### Scenario: Ångrar sig
- **WHEN** en medlem väljer ta bort men avbryter bekräftelsen
- **THEN** posten finns kvar

### Requirement: Knappar efter behörighet
Runtime SHALL bara visa skapa, ändra och ta bort när personen får göra det enligt samlingens åtkomst och sin roll i appen: `edit` ger allt, `add` ger skapa och ändra egna poster, `read` ger inget av det. Appens ägare SHALL se allt. Nekar databasen ändå en ändring SHALL runtime säga det i vardagliga ord och behålla det personen skrev.

#### Scenario: Läsbehörighet
- **WHEN** en medlem som inte är ägare öppnar en samling med åtkomsten `read`
- **THEN** knappar för att skapa, ändra och ta bort visas inte

#### Scenario: Annans post vid add
- **WHEN** en medlem öppnar en annan medlems post i Drop, vars samling har åtkomsten `add`
- **THEN** posten går att läsa men inte att ändra

### Requirement: Fel när något inte sparas
Om en post inte går att spara, ändra eller ta bort SHALL runtime visa ett kort fel på svenska utan tekniska ord, och SHALL behålla formulärets innehåll så att personen kan försöka igen.

#### Scenario: Nätet borta
- **WHEN** sparandet misslyckas
- **THEN** formuläret står kvar med det personen skrev och ett fel som säger att det inte gick att spara

### Requirement: Tema från beskrivningen
Runtime SHALL ge varje app det utseende som beskrivningens tema anger: förinställningen `calm`, `playful` eller `strict` ger standardvärden, och palett, typsnitt, avstånd, rundning och täthet ersätter dem när de anges. Temat MUST bara påverka den öppna appen, inte Pailos egna sidor.

#### Scenario: Matschemat
- **WHEN** matschemat öppnas
- **THEN** det visas med paletten sage, rundat typsnitt och stor rundning enligt sin beskrivning

#### Scenario: Bara förinställning
- **WHEN** en app anger bara förinställningen `strict`
- **THEN** den visas med `strict`s standardvärden för alla temavärden

### Requirement: Läsbart i varje tema
Varje palett MUST ge text och knappar en kontrast som når WCAG AA (4,5:1 för brödtext, 3:1 för stor text och kontroller), och varje kombination av temavärden MUST fungera på en skärm som är 360 pixlar bred utan att sidan går att skrolla i sidled.

#### Scenario: Kontrast
- **WHEN** testerna räknar kontrasten för varje palett
- **THEN** alla par av text och bakgrund når WCAG AA

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

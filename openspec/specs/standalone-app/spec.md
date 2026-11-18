# standalone-app Specification

## Purpose
Beskriver hur varje app står på egna ben: den körs på en egen adress med eget namn, egen ikon och eget tema utan något av Pailo, kan installeras på hemskärmen som sig själv, och kan laddas ned som en fristående fil som fungerar utan nätverk och utan Pailo.

## Requirements

### Requirement: Egen adress per app
Varje app SHALL ha en egen adress av formen `/a/<kortnamn>`, där kortnamnet bildas av appens namn och en slumpmässig del så att det inte går att gissa. Kortnamnet MUST vara unikt och MUST inte ändras när appen byter namn. Adressen SHALL gå att ladda om, spara som bokmärke och dela, och SHALL kunna peka ut en vy.

#### Scenario: Öppna appen direkt
- **WHEN** en medlem öppnar matschemats adress
- **THEN** matschemat visas med sin första vy

#### Scenario: Vy i adressen
- **WHEN** en medlem laddar om sidan medan vyn Veckan är öppen
- **THEN** samma app och vy visas igen

#### Scenario: Nytt namn, samma adress
- **WHEN** ägaren byter namn på appen
- **THEN** den gamla adressen fungerar fortfarande

### Requirement: Ingen Pailo i appen
På appens adress SHALL bara appen synas: dess namn, ikon och tema. Sidan MUST inte visa Pailos namn, meny, applista, byggfält eller länkar till andra appar. Fliken i webbläsaren SHALL ha appens namn och ikon. Ägaren SHALL nå verkstaden för appen via en diskret knapp som bara ägaren ser.

#### Scenario: Medlem öppnar appen
- **WHEN** en medlem som inte är ägare öppnar matschemats adress
- **THEN** sidan visar matschemat och inget av Pailo

#### Scenario: Ägaren vill ändra
- **WHEN** ägaren öppnar matschemats adress
- **THEN** finns en knapp som öppnar appen i verkstaden

### Requirement: Inloggning i appens stil
Öppnas appens adress av någon som inte är inloggad SHALL en inloggningssida visas med appens namn, ikon och tema, och efter inloggningen SHALL personen komma tillbaka till samma adress. Inloggningssidan MUST inte visa något av appens innehåll, versioner, medlemmar eller poster.

#### Scenario: Utloggad öppnar appen
- **WHEN** en person som inte är inloggad öppnar matschemats adress
- **THEN** sidan heter Matschema, har matschemats ikon och färger och ber personen logga in

#### Scenario: Tillbaka efter inloggning
- **WHEN** personen loggar in via länken i mejlet
- **THEN** matschemat öppnas på sin egen adress

#### Scenario: Okänt kortnamn
- **WHEN** någon öppnar en adress `/a/<kortnamn>` som inte finns
- **THEN** sidan säger att appen inte kunde hittas och visar inget annat

### Requirement: Inte medlem i appen
Öppnar en inloggad person adressen till en app där hen inte är medlem SHALL sidan säga att personen inte har tillgång och att hen kan be ägaren om en inbjudan. Sidan MUST inte visa appens innehåll eller vilka som är medlemmar.

#### Scenario: Tredje person
- **WHEN** en inloggad person som inte är medlem öppnar matschemats adress
- **THEN** sidan säger att personen inte har tillgång och visar inga poster

### Requirement: Inbjudan på appens adress
En inbjudningslänk SHALL leda till appens egen adress. Den som öppnar länken SHALL se appens inloggningssida om hen inte är inloggad, och efter inloggningen bli medlem och se appen utan att öppna länken igen. Hemligheten MUST ligga i den del av adressen som inte skickas till servern.

#### Scenario: Ny medlem via länk
- **WHEN** en person som inte är inloggad öppnar en giltig inbjudan till matschemat och loggar in
- **THEN** personen är medlem och matschemat visas på sin egen adress

#### Scenario: Länken fungerar inte längre
- **WHEN** någon öppnar en utgången inbjudningslänk
- **THEN** sidan säger att länken inte längre fungerar och att personen kan be ägaren om en ny

### Requirement: Installera appen
Varje app SHALL ha ett eget manifest så att den kan installeras på hemskärmen med appens namn, ikon och färg och öppnas direkt på sin adress. Manifestet och ikonen MUST bara visa appens namn, ikon och färg och inget innehåll.

#### Scenario: Lägg till på hemskärmen
- **WHEN** en medlem installerar matschemat från webbläsaren i mobilen
- **THEN** hemskärmen visar matschemats namn och ikon, och appen öppnas på matschemats adress

### Requirement: Det som syns utan inloggning
Utan inloggning MUST bara appens namn, ikon och tema gå att hämta via kortnamnet. Beskrivningen i övrigt, versioner, poster, medlemmar och ägare MUST kräva inloggning och medlemskap.

#### Scenario: Hämta utan inloggning
- **WHEN** någon utan inloggning frågar efter matschemat via kortnamnet
- **THEN** svaret innehåller bara namn, ikon och tema

### Requirement: Ladda ned appen
Appens ägare SHALL kunna ladda ned appen som en enda fil som innehåller runtime, appens senaste beskrivning och alla appens poster. Bara ägaren MUST kunna ladda ned, eftersom filen innehåller allas poster. Varje nedladdning SHALL loggas med person, app och tid. Filen MUST inte innehålla nycklar, inloggningsuppgifter eller adresser till Pailos servrar.

#### Scenario: Ägaren laddar ned
- **WHEN** ägaren väljer att ladda ned matschemat
- **THEN** en fil sparas som innehåller matschemat och dess poster, och nedladdningen finns i loggen

#### Scenario: Medlem försöker ladda ned
- **WHEN** en medlem som inte är ägare försöker ladda ned appen
- **THEN** det avvisas och ingen fil skapas

### Requirement: Fristående fil fungerar utan nätverk
Den nedladdade filen SHALL gå att öppna i en webbläsare utan nätverk och utan Pailo, och visa appen med samma vyer, formulär och tema som på appens adress. Den SHALL användas av en person: poster SHALL kunna skapas, ändras och tas bort, och ändringarna SHALL sparas i webbläsaren så att de finns kvar nästa gång filen öppnas där. Filen MUST köra samma regler för fält, länkar och text som runtime, och MUST inte köra något från beskrivningen eller posterna.

#### Scenario: Utan nätverk
- **WHEN** filen öppnas på en dator utan nätverk
- **THEN** matschemat visas med sina poster

#### Scenario: Ändringar finns kvar
- **WHEN** personen lägger till en måltid i filen, stänger webbläsaren och öppnar filen igen
- **THEN** måltiden finns kvar

#### Scenario: Inga anrop
- **WHEN** filen används
- **THEN** inga anrop görs till Pailos servrar eller någon annan server

### Requirement: Klart-kriteriet för M2b
M2b SHALL räknas som klar när två personer med egna konton delar matschemat på dess egen adress utan att se Pailo, en tredje person inte når det (bevisat av automatiska tester), och den nedladdade filen visar matschemat och sparar en ny post utan nätverk.

#### Scenario: Klart
- **WHEN** ägaren bjuder in en andra person till matschemat, båda planerar måltider på appens adress, en tredje person försöker öppna det och ägaren öppnar den nedladdade filen utan nätverk
- **THEN** de två ser varandras måltider utan Pailo-meny, den tredje når inget, testerna i CI är gröna och filen fungerar utan nätverk

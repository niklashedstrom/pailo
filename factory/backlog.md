# Factory-backlog

Små, avgränsade förbättringar som fabriken kan bygga, en i taget med `/factory next`.
Varje rad ska rymmas i ett pass på 1–2 timmar. Hela milstolpar (M3–M5) körs som
OpenSpec-ändringar med `/opsx:propose`, inte här.

Format: `- [ ] <beskrivning i vardagsspråk>`. Fabriken bockar av raden och skriver jobb-id efter.

Exempel (utan kryssruta, så att `/factory next` aldrig tar det): "Visa hushållets medlemmar med namn i stället för e-postadress på hushållssidan".

Klart som jobb `001-edit-display-name` ([#7](https://github.com/niklashedstrom/pailo/pull/7)): varje medlem kan ändra sitt eget namn.

## Hushållet (databasen klarar det redan sedan M2, sidan saknas)

- [x] Markera ditt eget namn med "(du)" i medlemslistan på hushållssidan → 002-mark-yourself-in-members
- [ ] Låt en administratör byta namn på hushållet från hushållssidan
- [ ] Låt en administratör se hushållets öppna inbjudningar (när de skapades och när de går ut) och återkalla en av dem
- [ ] Låt en administratör ta bort en annan medlem ur hushållet, med en bekräftelse på sidan först
- [ ] Låt en administratör göra en medlem till administratör och ta tillbaka det, men aldrig så att hushållet blir utan administratör
- [ ] Låt en medlem lämna hushållet själv, med en bekräftelse först och ett tydligt besked om den är sista administratören
- [ ] Låt en medlem skicka ett önskemål ("Jag önskar att …") från hushållssidan och se hushållets tidigare önskemål

## Teknik

- [ ] Uppgradera Supabase CLI till v3 lokalt och i CI, och testa om databasen fortfarande kraschar när någon anropar en funktion utan körrätt. Om kraschen är borta: ta bort körrätten för utloggade på `create_household`, `create_invite` och `accept_invite` och uppdatera kommentarerna och designanteckningen

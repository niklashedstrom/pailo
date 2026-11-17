# Proposal

## Why

Efter M3 kan runtime visa vilken giltig appbeskrivning som helst, men bara utvecklare kan lägga in beskrivningar, och det görs lokalt med ett skript. Det som gör Pailo till Pailo saknas fortfarande: att ett hushåll skriver vad det vill ha i vardagsspråk och att appen byggs eller ändras utifrån det. Byggtjänsten är också fas 1:s största risk, både för kvaliteten (blir apparna giltiga och vettiga?) och för kostnaden (vad kostar ett byggsamtal?). Den behöver därför byggas och mätas före intervjun i M5.

## What Changes

- **Byggtjänst på servern:** en Edge Function tar emot ett önskemål i vardagsspråk ("lägg till en kolumn för vem som lagar maten") för en ny eller befintlig app. Claude svarar med strukturerad output: en kort sammanfattning på svenska och en JSON Patch mot appens beskrivning. AI:n har inga andra verktyg, och Claude-nyckeln finns bara på servern
- **Validering före sparande:** patchen tillämpas på den aktuella beskrivningen och resultatet valideras med `parseAppDescription` från `packages/schema`. Bara en giltig beskrivning sparas, som ny version i `app_versions`. Är svaret ogiltigt får Claude ett nytt försök med felen som underlag. Misslyckas även det sparas ingenting och personen får ett ärligt besked
- **Nya appar:** en medlem kan beskriva en ny app från hushållssidan. Byggtjänsten skapar appen och dess första version. **BREAKING** mot M3:s krav att användare inte kan skapa appar
- **Ångra och återställ:** varje app har en versionslista. Ångra sparar den förra versionen som en ny version, och "gå tillbaka hit" gör samma sak för en äldre. Det anropar inte AI:n och räknas inte mot kvoten. Poster tas aldrig bort när en samling eller ett fält försvinner, så en återställning tar tillbaka datan
- **Gränskontroll och önskemål:** det som byggstenarna inte klarar säger Claude ifrån om i svaret, med närmaste alternativ. Byggtjänsten sparar sådana önskemål i `wishes`, och personen ser beskedet
- **Kostnadsskydd före varje anrop:** i den här ordningen nödbroms (globalt tak per dygn för AI-kostnaden), hastighetsgräns per person och hushåll, max längd på meddelandet och kvot per hushåll och månad. Varje anrop loggas med modell, tokens, kostnad, hushåll och person. I molnet är nödbromsen **på** från början och kräver ett aktivt beslut för att slås av
- **Evals:** 20 vardagsproblem på svenska och ett skript som kör dem mot byggtjänsten och mäter andel giltiga appar, tokens och kostnad per anrop och per körning. Skriptet kostar pengar och körs bara när ägaren ger klartecken, med ett kostnadstak per körning. CI testar allt med en låtsas-Claude som inte kostar något
- **Enkelt gränssnitt:** ett textfält "Vad vill du ändra?" i appen och "Vad vill du ha hjälp med?" på hushållssidan. Därefter visas sammanfattningen, en ångra-knapp och versionslistan. Den styrda intervjun, förslagskorten och stilförhandsvisningarna kommer i M5

**Utanför M4:** intervju i flera steg, förslag, stilförhandsvisningar (M5); betalning och nivåer (fas 3; kvoten är en siffra per hushåll som ägaren kan ändra); larm via mejl (väntar på beslutet om e-posttjänst, så larmet loggas till dess).

## Capabilities

### New Capabilities

- `app-builder`: byggtjänsten: önskemål i vardagsspråk blir en validerad patch och en ny version, nya appar, ångra och återställ, gränskontroll med önskemål och evals som mäter kvalitet och kostnad
- `ai-usage-limits`: skyddet runt varje AI-anrop: nödbroms, hastighetsgränser, längdgräns, kvot per hushåll och kostnadslogg

### Modified Capabilities

- `app-runtime`: användare kan skapa och ändra appar med ord, se versionslistan och ångra. Kravet "Inga färdiga appar i produkten" ändras, eftersom användare nu kan skapa appar men fortfarande inte välja färdiga

## Impact

- `supabase/functions/`: nya Edge Functions för att bygga och återställa, med delad kod för Claude-anrop, patch och validering. Första Edge Functions i projektet
- `supabase/migrations/`: nya tabeller för AI-anrop och inställningar (nödbroms, tak, kvoter) med RLS och pgTAP-tester, och databasfunktioner som reserverar ett anrop atomiskt. **Migreringarna rullas ut till molnet vid sammanslagning, så ägaren godkänner den PR:en**
- `packages/schema`: JSON Patch-tillämpning och en kompakt beskrivning av byggstenarna för AI:n, så att servern och testerna använder samma kod
- `apps/runtime`: textfälten, sammanfattning, versionslista och ångra, utökat `PailoApi`
- `evals/`: de 20 problemen och körskriptet
- **Kostnad:** Anthropic API-nyckel som hemlighet i Supabase och betalda anrop i evals och för riktiga användare. Inget av det slås på utan ägarens klartecken; budgeten i `docs/04-affarsmodell.md` (högst 10 000 kr fram till betalande användare) gäller
- `docs/03-arkitektur.md`, `docs/05-sakerhet.md`: uppdateras med hur byggtjänsten och skydden faktiskt fungerar

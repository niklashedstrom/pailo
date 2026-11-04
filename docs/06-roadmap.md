# Faser och byggsteg

Första betalande hushåll väntas våren 2027, med 8–12 timmar i veckan (1–2 timmar på vardagar och mer på helger). Datumen är riktmärken, grindarna är det som styr. Klarar en fas inte sin grind blir nästa steg att åtgärda det, inte att gå vidare.

## Faser

| Fas | Tid | Innehåll | Grind |
|---|---|---|---|
| 1 · Kärnan | nov–dec 2026, 6–8 veckor | M0–M5 nedan | Drop och matschemat byggs från noll i verktyget utan handpåläggning. Sedan bygger mamma sitt matschema med Niklas bredvid, utan att han rör tangentbordet. |
| 2 · Fem testare | jan 2027, ca 4 veckor | Mamma + 4 icke-tekniska personer. Alla gap loggas. | Används appen fortfarande vecka 3? Bygger någon en andra app? |
| 3 · Betalning och öppning | feb–apr 2027 | Nya byggstenar från gap-loggen, provperiod + abonnemang, väntelista, öppning | Första betalande hushåll. AB bildas då. |

## Byggsteg fas 1

Fas 1 delas i sex milstolpar, var och en med ett tydligt klart-kriterium. Stegen är storleksanpassade för pass på 1–2 timmar på vardagar och längre pass på helgen. Varje milstolpe blir en OpenSpec-ändring som körs i Claude Code.

### M0 · Grunden (helg 1)

- [ ] Skapa repo som monorepo: `apps/runtime`, `packages/schema`, `supabase/`
- [ ] Initiera OpenSpec och skriv projektbeskrivningen utifrån planen
- [ ] Skapa eget Supabase-projekt i EU-region
- [ ] Koppla Vercel med förhandsvisning per pull request
- [ ] GitHub Actions: lint, typkontroll, tester och Supabase-migreringar

**Klart när:** en tom app deployas från `main` och CI är grön.

### M1 · Appschemat (vecka 1–2)

- [ ] Definiera appbeskrivning v0 i TypeScript med Zod: samlingar och fält, vyer, inmatning, personer och roller, påminnelser, tema
- [ ] Lägg till `schemaVersion` och en migreringsfunktion, så att gamla appar fungerar när schemat växer
- [ ] Handskriv Drop som JSON-beskrivning
- [ ] Handskriv mammas matschema som JSON-beskrivning
- [ ] Enhetstester för validering, både giltiga och ogiltiga beskrivningar

**Klart när:** båda exemplen validerar och ett medvetet trasigt exempel avvisas.

### M2 · Data och behörighet (vecka 2–3)

- [ ] Tabeller: `households`, `members`, `apps`, `app_versions`, `records` (jsonb), `invites`, `wishes`
- [ ] All appdata i en generisk `records`-tabell med jsonb, så att nya appar aldrig kräver nya tabeller
- [ ] RLS-policyer per hushåll på varje tabell
- [ ] pgTAP-tester i CI som bevisar att hushåll A inte kan läsa eller skriva B:s data
- [ ] Inloggning med magisk länk och inbjudan till hushållet med tidsbegränsad länk

**Klart när:** två testkonton i olika hushåll är helt isolerade, bevisat av tester.

### M3 · Runtime (vecka 3–5)

- [ ] Rendera vyerna lista, kort, kalender och översikt från en beskrivning
- [ ] Generera formulär från fälten, med skapa, ändra och ta bort mot `records`
- [ ] Tema-tokens: palett, typsnitt, avstånd, rundning, täthet, plus tre förinställda stilar
- [ ] PWA som går att installera på mobilen
- [ ] Dela-meny via Web Share Target och bokmärkesknapp med begränsad, återkallbar token
- [ ] Påminnelser: schemalagd Edge Function som skickar mejl, web push om tiden räcker

**Klart när:** Drop och matschemat körs i runtime från de handskrivna beskrivningarna och delas mellan två konton.

### M4 · Byggtjänsten (vecka 5–7)

- [ ] Edge Function som anropar Claude med strukturerad output och returnerar en patch (JSON Patch) mot beskrivningen
- [ ] Validera varje patch med Zod innan den sparas som ny version i `app_versions`
- [ ] Ångra och återställ till tidigare version
- [ ] Kvot före anrop, hastighetsgränser, kostnadslogg per hushåll och global nödbroms
- [ ] Gränskontroll: önskemål som byggstenarna inte klarar loggas i `wishes`
- [ ] Evals: 20 testproblem i vardagsspråk som körs mot byggtjänsten, med andel giltiga patchar och kostnad per körning

**Klart när:** minst 90 % av testproblemen ger en giltig app, och kostnaden per byggsamtal är uppmätt.

### M5 · Intervju och design (vecka 7–8)

- [ ] Chatt med styrda frågor utifrån vad byggstenarna behöver
- [ ] Förslag som valbara kort, 2–3 per app
- [ ] Tre stilförhandsvisningar av användarens egen app, och justering med ord
- [ ] Ändringar i samtal, med versionslista och ångra
- [ ] Ärligt besked när något inte går, med närmaste alternativ

**Klart när (grind fas 1):** du bygger Drop och matschemat från noll i verktyget utan handpåläggning. Sedan bygger mamma sitt matschema med dig bredvid, utan att du rör tangentbordet.

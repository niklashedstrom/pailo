# Säkerhet

AI:n kan bara producera en patch till appbeskrivningen, och användarna kör ingen egen kod. Det gör oss oanvändbara som gratis AI-proxy, och säkerheten i alla appar ligger i plattformen: ett hål lagas en gång för alla. Ramverket är **OWASP ASVS nivå 2 plus GDPR**.

## Skydd mot missbruk av AI:n

- **Inloggning krävs alltid**, med verifierad e-post och Cloudflare Turnstile vid registrering.
- **En provperiod per person**, kontrollerad på e-post, enhet och betalkort vid uppgradering.
- **Kvot före anrop:** Edge Function kontrollerar hushållets kvot innan Claude anropas. API-nyckeln finns aldrig i klienten.
- **Hastighetsgränser** per användare och hushåll, till exempel högst 10 ändringar i timmen, och max längd på meddelanden.
- **Global nödbroms:** tak för total AI-kostnad per dag. Överskrids det pausas byggandet och larm går.
- **Avvikelsedetektion:** flagga konton som når taket direkt, skickar ovanligt långa meddelanden eller anropar i maskinmässig takt.
- **Promptinjektion:** appinnehåll som skickas till AI:n är data. AI:n har inga verktyg utöver att föreslå en patch, som valideras och kan ångras.

## Säkerhet i användarnas appar

- **Behörighet:** RLS per hushåll på varje tabell, med tester i CI som bevisar att ett hushåll aldrig kan läsa ett annats data.
- **Ingen körbar användarkod:** allt renderas via våra React-komponenter, aldrig rå HTML. Länkar saneras.
- **Filer:** privata lagringsytor, signerade länkar med kort livstid, kontroll av filtyp och storlek.
- **Inloggning:** magisk länk eller passkeys. Inbjudningslänkar går ut efter några dagar.
- **Bokmärkesknapp och dela-meny:** egen begränsad token som bara kan lägga till i en app och kan återkallas.
- **Inga publika appar i v1.** Allt är privat för hushållet.
- **GDPR:** data i EU, personuppgiftsbiträdesavtal med Supabase, Vercel och Anthropic, integritetspolicy, export och radering på begäran. Kontrollera Anthropics hantering av API-data innan lansering.
- **Barn:** konton kräver 18 år. Barn kan finnas med i en app utan egna konton i v1.
- **Drift:** dagliga backuper med testad återställning, beroendeskanning i CI, externt penetrationstest innan fas 3.

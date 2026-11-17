# Säkerhet

AI:n kan bara producera en patch till appbeskrivningen, och användarna kör ingen egen kod. Det gör oss oanvändbara som gratis AI-proxy, och säkerheten i alla appar ligger i plattformen: ett hål lagas en gång för alla. Ramverket är **OWASP ASVS nivå 2 plus GDPR**.

## Skydd mot missbruk av AI:n

- **Inloggning krävs alltid**, med verifierad e-post och Cloudflare Turnstile vid registrering.
- **En provperiod per person**, kontrollerad på e-post, enhet och betalkort vid uppgradering.
- **Kvot före anrop:** Edge Function kontrollerar kvoten för personen som bygger innan Claude anropas. API-nyckeln finns aldrig i klienten.
- **Hastighetsgränser** per person och per app, till exempel högst 10 ändringar i timmen, och max längd på meddelanden.
- **Global nödbroms:** tak för total AI-kostnad per dag. Överskrids det pausas byggandet och larm går.
- **Avvikelsedetektion:** flagga konton som når taket direkt, skickar ovanligt långa meddelanden eller anropar i maskinmässig takt.
- **Promptinjektion:** appens beskrivning och önskemålet skickas som märkt data i användarmeddelandet, aldrig i systemprompten. AI:n har inga verktyg utöver att föreslå en patch, ser aldrig poster, och resultatet valideras och kan ångras.

## Säkerhet i användarnas appar

- **Behörighet:** RLS per appmedlemskap på varje tabell. Bara den som är medlem i en app kan läsa eller skriva dess beskrivning och poster, och bara den som får ändra kan bygga om den. Tester i CI bevisar att person A aldrig når en app där A inte är medlem.
- **Ingen körbar användarkod:** allt renderas via våra React-komponenter, aldrig rå HTML. Länkar saneras.
- **Filer:** privata lagringsytor, signerade länkar med kort livstid, kontroll av filtyp och storlek.
- **Inloggning:** magisk länk eller passkeys. Inbjudningslänkar går ut efter några dagar.
- **Bokmärkesknapp och dela-meny:** egen begränsad token som bara kan lägga till i en app och kan återkallas.
- **Inga publika appar i v1.** En app är privat för sina medlemmar, även på sin egen adress.
- **Export:** paketet innehåller appens alla poster, även andra medlemmars, så bara ägaren kan ladda ned det, och nedladdningen loggas. Paketet innehåller inga nycklar, inloggningsuppgifter eller adresser till vårt API. Det kör samma runtime med samma regler: ingen rå HTML och sanerade länkar.
- **GDPR:** data i EU, personuppgiftsbiträdesavtal med Supabase, Vercel och Anthropic, integritetspolicy, export och radering på begäran. Anthropic: arbetsytan Pailo behandlar data i USA (global behandling), eftersom EU-behandling inte går att välja än. Ägaren godkände det 17 november 2026; det ses över innan lansering. Claude får bara appbeskrivningen och önskemålet, aldrig poster.
- **Barn:** konton kräver 18 år. Barn kan finnas med i en app utan egna konton i v1.
- **Drift:** dagliga backuper med testad återställning, beroendeskanning i CI, externt penetrationstest innan fas 3.

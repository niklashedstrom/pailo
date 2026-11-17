# Resultat: evals för byggtjänsten

## Körning 1 · 17 november 2026

`npm run eval:build -- --max-usd 5`, modell `claude-opus-5-5`, `effort: medium`, arbetsytan Pailo.

| Mått | Värde |
|---|---|
| Användbara appar | **20 av 20** (krav för M4: minst 18) |
| Uppfyllda förväntningar | 24 av 24 |
| Försök | 19 problem på första försöket, 1 (recept) på andra |
| Kostnad totalt | 0,57 US$ |
| **Kostnad per byggsamtal** | **0,028 US$** (från 0,006 för en liten ändring till 0,058 för en ny app) |
| Tokens per byggsamtal | cirka 9 600, varav nästan allt läses från cachen |
| Tid per byggsamtal | 10,6 s i snitt (2,5–22,5 s) |

Fördelning av tokens för hela körningen: 8 284 in utan cache, 152 500 lästa från cachen, 7 625 skrivna till cachen och 23 167 ut. Systemprompten cachas alltså som tänkt, och kostnaden domineras av svaret.

Uppskattat per hushåll med nivåerna i `docs/04-affarsmodell.md`: 20 ändringar i månaden ≈ 0,57 US$, 100 ≈ 2,80 US$ och 300 ≈ 8,50 US$.

### Iakttagelser

- **Sammanfattningarna** är på vardaglig svenska utan tekniska ord, till exempel: "Nu kan du skriva en anteckning på varje måltid i veckans schema, och den syns i kalendern. Sms kan appen tyvärr inte skicka."
- **Gränskontrollen** fungerar: sms (19) och bankkoppling (20) blev ärliga besked, och den möjliga delen byggdes ändå.
- **Problem 15** var för lätt: matschemat har redan ett fält för vem som lagar maten. Claude sa det och gjorde fältet obligatoriskt i stället. Problemet bör bytas mot en ändring som verkligen kräver något nytt.
- **Problem 12** fick ett bildfält ("Recepten visas som kort med bild"), men bilder kommer först i M3b. Systemprompten bör säga att bildfält inte går att fylla i än.
- **Ny app tar längre tid** (9–22 s) än en liten ändring (2,5–6 s). Väntetexten "Det kan ta en halv minut" stämmer.

**Modell i produktion:** `claude-opus-5-5` med `effort: medium`, samma som mättes, tills ägaren väljer något annat (`BUILD_MODEL`, `BUILD_EFFORT`). Sonnet 5.5 och Haiku 5.5 kan jämföras med `--model` i en egen körning.

Rådata (ignoreras av git): `evals/build/results/2026-11-17T07-32-29.410Z-claude-opus-5-5-medium.json`.

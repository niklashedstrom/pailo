# Byggstenar och flöde

## Byggstenar

V1 har fem byggstenar. Det är det minsta som räcker för att bygga både Drop och mammas matschema. Resten kommer i den ordning testarna efterfrågar dem.

| Byggsten | Vad den gör | Version |
|---|---|---|
| Data | Samlingar av saker med egna fält (text, datum, bild, länk, person, val) | v1 |
| Vyer | Lista, kort, kalender, översikt | v1 |
| Inmatning | Formulär, mobilens dela-meny, bokmärkesknapp | v1 |
| Personer | Hushåll, inbjudan, vem gjorde vad, behörigheter | v1 |
| Tid | Påminnelser, återkommande saker, scheman | v1 |
| Utskick | Push-notiser, veckosammanfattning på mejl | Senare |
| Logik | Enkla regler: "om X, gör Y" | Senare |
| Inmatning, fler | Mejla in, foto som tolkas av AI | Senare |
| Delning mellan hushåll | Dela en app utan data med andra | Senare |

**Klart-kriterium för v1:** Drop och mammas matschema går att bygga helt i verktyget, utan handpåläggning.

## Intervju- och designflöde

Användaren beskriver ett problem med egna ord. Sedan leder AI:n hen genom ett styrt samtal, inte en fri prompt.

1. **Problemet:** "Vad vill du lösa?" Fritt svar.
2. **Följdfrågor:** vilka som använder appen, vad som ska sparas, när den används och på vilken enhet. AI:n frågar bara det byggstenarna behöver.
3. **Gränskontroll:** om något inte går säger AI:n det nu och föreslår närmaste lösning. Önskan loggas.
4. **Förslag:** AI:n föreslår 2–3 saker användaren inte bad om, till exempel bokmärkesknappen i Drop. Användaren väljer.
5. **Design:** användarens egen app visas i tre stilar, till exempel lugn, lekfull och stram. Användaren pekar och justerar med ord: "grönare", "luftigare", "större text".
6. **Klar:** appen fungerar direkt och kan delas med hushållet.
7. **Ändringar:** sker i samma samtalsform. Varje ändring blir en version som kan ångras.

## Designsystemet

Ett fast antal variabler: färgpalett, typsnitt, avstånd, rundning, täthet och några layoutvarianter. Naturligt språk översätts till dessa. Varje kombination är testad för mobil och kontrast, så designen kan aldrig bli trasig.

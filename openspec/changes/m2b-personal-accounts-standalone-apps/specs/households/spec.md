## REMOVED Requirements

### Requirement: Skapa hushåll
**Reason**: Hushållet är inte längre Pailos enhet (beslut 17 november 2026). Var och en har ett eget konto, och den som bygger en app blir dess ägare.
**Migration**: Se `app-sharing`, kravet "Ägare och medlemmar". Befintliga hushålls appar får en ägare och medlemmar när migrationen körs.

### Requirement: Medlemmar och roller
**Reason**: Roller sätts per app i stället för per hushåll.
**Migration**: Se `app-sharing`, kravet "Ägare och medlemmar". Administratör motsvaras av appens ägare.

### Requirement: Alltid minst en administratör
**Reason**: En app har alltid exakt en ägare, och ägaren kan inte lämna.
**Migration**: Se `app-sharing`, kraven "Ägare och medlemmar" och "Ta bort och lämna".

### Requirement: Lämna hushåll
**Reason**: Man lämnar en app i stället för ett hushåll.
**Migration**: Se `app-sharing`, kravet "Ta bort och lämna".

### Requirement: Inbjudan med tidsbegränsad länk
**Reason**: En inbjudan gäller en app.
**Migration**: Se `app-sharing`, kravet "Inbjudan till en app". Oanvända hushållsinbjudningar tas bort av migrationen.

### Requirement: Ta emot inbjudan
**Reason**: En inbjudan gör personen medlem i en app.
**Migration**: Se `app-sharing`, kravet "Ta emot inbjudan".

### Requirement: Återkalla inbjudan
**Reason**: Inbjudningar hanteras per app.
**Migration**: Se `app-sharing`, kravet "Återkalla inbjudan".

### Requirement: Isolering mellan hushåll
**Reason**: Isoleringen gäller mellan appar.
**Migration**: Se `app-sharing`, kravet "Isolering mellan appar", med pgTAP-tester för ägare, medlem och utomstående.

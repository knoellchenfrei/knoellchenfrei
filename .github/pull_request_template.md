## Was und warum

<!-- Was ändert sich, und welches Problem löst es? Der Grund ist wichtiger als
     die Beschreibung des Diffs — den sieht man ja. -->

## Geprüft

- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `cd apps/web && npx playwright test`
- [ ] Bei Änderungen an der Domänenlogik: ein Test, der ohne die Änderung fehlschlägt

## Betrifft

- [ ] Nichts, was jemandem einen falschen Preis nennen könnte
- [ ] Datenhaltung oder Aufbewahrung — dann bitte auch `SECURITY.md` anfassen

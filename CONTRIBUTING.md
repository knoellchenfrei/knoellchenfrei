# Mitmachen

## Schnellstart

```bash
cd app
pnpm install
pnpm test          # 62 Unit-Tests
pnpm typecheck
pnpm --filter @knoellchenfrei/web dev
```

## Grundsätze

**Nicht raten, wenn die Quelle schweigt.** Die Berliner Daten sind stellenweise
unvollständig oder mehrdeutig. Wo das so ist, sagt die App es — sie füllt die
Lücke nicht mit einer plausiblen Annahme. Beispiel: Vier Spandauer Zonen nennen
„Advents-Sa", ohne zu definieren, welche Samstage gemeint sind. Die App zeigt an
diesen Tagen „unsicher" statt einer Auslegung.

**Laut scheitern statt still falsch liegen.** Der Parser bricht den Datenbuild
ab, wenn er eine Fahrplanangabe nicht versteht. Eine falsch geparste Zone würde
jemandem einen Preis nennen, für den er dann ein Knöllchen bekommt.

**Kommentare erklären das Warum.** Was der Code tut, steht im Code. Warum er es
so tut — welcher Fehler dahintersteht, welche Alternative verworfen wurde —
gehört in einen Kommentar.

**Tests belegen echte Fehler.** Jeder Regressionstest in `hardening.test.ts`
scheitert ohne den zugehörigen Fix. Tests, die nur bestätigen, dass Code
existiert, helfen niemandem.

## Struktur

```
app/packages/core      Domänenlogik, framework-frei. Keine Laufzeitabhängigkeit.
app/packages/ingest    WFS → eingefrorene Web-Assets, Badges, Artifact-Bundle
app/apps/web           PWA: React 19, Vite 7, MapLibre GL 5
app/apps/api           Cloudflare Worker (optional)
ParkingZone/           Java-Original von 2012. Wird nicht gebaut und zieht
                       beim Umzug nicht mit — siehe docs/ideen-2012.md.
```

`core` darf nichts aus `apps/` importieren und kein Framework kennen.

## Vor einem Pull Request

```bash
cd app
pnpm typecheck
pnpm test
pnpm test:coverage    # Schwellwerte: 85 % Zeilen, 80 % Zweige
pnpm --filter @knoellchenfrei/web build
cd apps/web && npx playwright test
```

Die CI führt dasselbe aus.

## Daten aktualisieren

```bash
pnpm --filter @knoellchenfrei/ingest fetch
pnpm --filter @knoellchenfrei/ingest build-data
```

Schlägt `build-data` fehl, hat der Feed eine Schreibweise, die der Parser nicht
kennt. Das ist Absicht: erst den Parser erweitern und einen Test dafür
schreiben, dann neu bauen.

## Commit-Nachrichten

Erste Zeile im Imperativ, unter 72 Zeichen. Der Rumpf erklärt, warum die
Änderung nötig war — welches Verhalten falsch war und woran man das gemerkt hat.

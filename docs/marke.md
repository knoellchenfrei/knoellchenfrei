# Marke und Auftritt

Was außerhalb der App zum Projekt gehört: Bilder, Beschreibungstexte,
Namensschema. Alles Erzeugte liegt unter [brand/](brand/) und entsteht aus
einem Skript, damit es sich reproduzieren lässt statt in einem Grafikprogramm
zu verschwinden:

```bash
cd app/apps/web && node scripts/make-brand.mjs
```

| Datei | Wofür | Maß |
| --- | --- | --- |
| `brand/org-avatar-512.png` | Bild der GitHub-Organisation | 512 × 512, randlos |
| `brand/social-preview-1280x640.png` | „Social preview" des Repositories, taugt auch als `og:image` | 1280 × 640 |
| `brand/*.svg` | Die Quellen dazu | — |

## Warum das Motiv ein P bleibt

Das **P** ist das internationale Parkzeichen: Es sagt in einem Zeichen, worum
es geht. Ein „K" für den Namen sagt nichts, und es stünde im Widerspruch zu
dem Symbol, das bei den Testnutzern schon auf dem Homescreen liegt. Ein
Buchstabenwechsel wäre eine Entscheidung über die Wiedererkennung, nicht über
den Namen — und die lohnt sich nicht, solange das Symbol trägt.

**Randlos, nicht abgerundet.** `apps/web/public/icon.svg` hat runde Ecken und
außen Transparenz; auf dem Homescreen ist das richtig, weil das Betriebssystem
selbst rundet. GitHub rundet ebenfalls selbst — ein bereits gerundetes Bild
bekommt dort doppelt gerundete Ecken, und durch die transparenten Ecken
scheint der Seitenhintergrund. Im Dunkelmodus sieht das aus wie ein
Darstellungsfehler. Deshalb eine eigene Datei statt derselben.

## Was von Hand einzustellen ist — **du**

Nichts davon geht über die GitHub-App: Sie darf in dieser Organisation weder
Repositories anlegen noch Einstellungen ändern (`403 Resource not accessible
by integration`). Es sind fünf Klicks.

### 1. Bild der Organisation

`github.com/organizations/knoellchenfrei/settings/profile` → *Upload new
picture* → `docs/brand/org-avatar-512.png`.

Dort auch:

| Feld | Vorschlag |
| --- | --- |
| Display name | `knoellchenfrei` |
| Description | `Was Parken gerade kostet, und wie lange — aus amtlichen Geodaten.` |
| URL | leer lassen, bis `knoellchenfrei.de` ausliefert |
| Location | `Berlin, Deutschland` |
| Email | erst, wenn es eine Vereinsadresse gibt — eine private gehört nicht in ein öffentliches Profil |

### 2. Profilseite der Organisation

Sie entsteht aus einem Repository, das wörtlich `.github` heißt, und der Datei
`profile/README.md` darin. Anlegen:

```bash
gh repo create knoellchenfrei/.github --public --description "Profil der Organisation und gemeinsame Vorlagen"
git clone https://github.com/knoellchenfrei/.github
mkdir -p .github/profile
cp docs/org-profil.md .github/profile/README.md
cd .github && git add -A && git commit -m "Profil der Organisation" && git push
```

Der fertige Text steht in [org-profil.md](org-profil.md). Er ist bewusst kurz:
Die Profilseite ist eine Visitenkarte, nicht die README.

### 3. Repository beschreiben

`github.com/knoellchenfrei/knoellchenfrei` → Zahnrad neben *About*.

| Feld | Wert |
| --- | --- |
| Description | `Wo Parken gerade etwas kostet, wie viel und wie lange — aus amtlichen Geodaten. PWA für Berlin und Hamburg, offlinefähig, ohne Server.` |
| Website | leer, bis die Domain ausliefert |
| Topics | `parking` `open-data` `berlin` `hamburg` `pwa` `typescript` `maplibre` `geojson` `wfs` `offline-first` `civic-tech` `cloudflare-workers` |

Die Topics sind kein Schmuck: Sie sind der Weg, auf dem
`github.com/topics/open-data` und `github.com/topics/civic-tech` jemanden
hierher bringen, der nicht nach dem Namen sucht.

Als Befehl, falls dir das lieber ist:

```bash
gh repo edit knoellchenfrei/knoellchenfrei \
  --description "Wo Parken gerade etwas kostet, wie viel und wie lange — aus amtlichen Geodaten. PWA für Berlin und Hamburg, offlinefähig, ohne Server." \
  --add-topic parking --add-topic open-data --add-topic berlin --add-topic hamburg \
  --add-topic pwa --add-topic typescript --add-topic maplibre --add-topic geojson \
  --add-topic wfs --add-topic offline-first --add-topic civic-tech --add-topic cloudflare-workers
```

### 4. Vorschaubild des Repositories

`github.com/knoellchenfrei/knoellchenfrei/settings` → *Social preview* →
`docs/brand/social-preview-1280x640.png`. Ohne das zeigt jeder geteilte Link
ein automatisch erzeugtes Bild mit Commit-Zahlen — es sagt nichts und sieht
nach nichts aus.

### 5. Was du bewusst **nicht** einstellen solltest

- **Kein Sponsor-Knopf, keine `FUNDING.yml`.** Dahinter steht kein Konto und
  kein Verein; ein Spendenknopf wäre eine Behauptung. Erst nach der
  Eintragung, siehe [todo.md](todo.md#1-trägerschaft-verein-gründen--du).
- **Keine private E-Mail-Adresse** in Org-Profil oder Repository. Sie ist von
  dort nicht zurückzuholen — dieselbe Überlegung wie beim Impressum.
- **Keine GitHub-Discussions**, solange niemand moderiert. Ein leeres Forum
  wirkt verlassener als keins.
- **Kein Verifizieren der Domain**, bevor sie ausliefert.

## Namensschema für Telegram und weitere Städte

Andere Städte kommen — das Schema muss deshalb **vor** dem ersten Namen
stehen, nicht danach. FreiFahren macht es mit einem Stadtkürzel:
`@FreiFahren_BE` ist die Berliner Gruppe. Dasselbe hier:

| Name | Rolle |
| --- | --- |
| `@knoellchenfrei` | Dach: Ankündigungen, alle Städte |
| `@knoellchenfrei_BE` | Community Berlin |
| `@knoellchenfrei_HH` | Community Hamburg |
| `@knoellchenfrei_bot` | Meldebot, Stufe 1 aus [todo.md](todo.md#6-telegram--du-token-dann-ich) |

Am 6. September 2026 waren **alle vier frei** (geprüft über `t.me/<name>`: Ein
vergebener Name liefert Titel und Beschreibung, ein freier nur den Platzhalter
„Telegram: Contact @…"). Begründung, warum sie trotzdem jetzt belegt werden
sollten, in [entscheidungen.md](entscheidungen.md#telegram-und-der-name).

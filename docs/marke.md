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
| `brand/social-preview-1280x640.png` | „Social preview" des Repositories | 1280 × 640 |
| `app/apps/web/public/og.png` | Dasselbe Bild als Vorschaukarte der ausgelieferten Adresse (`og:image` der Anmeldeseite und der App). Der Riegel lässt genau diesen Pfad ohne Cookie durch — sonst zeigte iMessage oder Discord zum geteilten Link einen leeren Kasten (10. September) | 1280 × 640 |
| `brand/telegram-dach-512.png` | Gruppe `@knoellchenfrei` | 512 × 512 |
| `brand/telegram-bot-512.png` | Bot `@knoellchen_bot` | 512 × 512 |
| `brand/telegram-berlin-512.png` | Gruppe `@knoellchenfrei_B` | 512 × 512 |
| `brand/telegram-hamburg-512.png` | Gruppe `@knoellchenfrei_HH` | 512 × 512 |
| `brand/telegram-frankfurt-512.png` | Gruppe `@knoellchenfrei_F` | 512 × 512 |
| `brand/telegram-muenchen-512.png` | Gruppe `@knoellchenfrei_M` | 512 × 512 |
| `brand/*.svg` | Die Quellen dazu | — |

Die Farben **in** der App gehören nicht hierher, mit einer Ausnahme: Die
Zonenfarbe ist keine Dekoration, sondern eine Aussage. Was sie heute leistet,
woran sie krankt und welche Ersatzpaletten gemessen wurden, steht in
[farben-parkzonen.md](farben-parkzonen.md).

## Telegram: vier Bilder, und warum sie so aussehen

Telegram verlangt ein **Quadrat**, empfohlen 512 × 512 (Minimum 300 × 300),
PNG oder JPEG. Der Haken ist die doppelte Darstellung: In Chatlisten und neben
jeder Nachricht wird **rund** beschnitten, in der Profilansicht bleibt das
Quadrat stehen. Beides muss stimmen — Fläche also randlos bis in die Ecken,
Motiv aber innerhalb des einbeschriebenen Kreises. Das P steht deshalb auf
0,78 statt 1: Bei voller Größe schneidet der Kreis die Kanten an, und das sieht
nicht nach Zuschnitt aus, sondern nach einem schlecht gezeichneten Buchstaben.

| Wofür | Bild | Warum |
| --- | --- | --- |
| **Dach** `@knoellchenfrei` | blaue Fläche, weißes P | die Marke selbst |
| **Bot** `@knoellchen_bot` | dunkle Fläche, weißes P | Auf 24 Pixeln trägt nur ein Helligkeitswechsel. **Nicht weiß**, obwohl das der naheliegende Gegenpol wäre: In einer hellen Chatliste hätte ein weißes Bild keinen Rand, und das P schwebte ohne Fläche. |
| **Berlin** `@knoellchenfrei_B` | Marke plus Kennzeichen `B` | Klein verschmilzt das Kürzel zu einem Punkt und stört nicht; groß beantwortet es die Frage, in welcher Gruppe man ist. |
| **Hamburg** `@knoellchenfrei_HH` | Marke plus Kennzeichen `HH` | dasselbe |
| **Frankfurt am Main** `@knoellchenfrei_F` | Marke plus Kennzeichen `F` | dasselbe. Ein Buchstabe wie Berlin — die Stadt heißt auf dem Kennzeichen `F`, nicht `FFM` |
| **München** `@knoellchenfrei_M` | Marke plus Kennzeichen `M` | dasselbe. Wieder ein Buchstabe — `M`, nicht `MUC`; das ist der Flughafencode, nicht das Kennzeichen |

Ausgeschriebene Städtenamen wären bei dieser Größe unlesbar — ein Wort, das
niemand entziffert, ist Dekoration.

**Das Kfz-Kennzeichen, nicht der Ländercode.** Berlin ist `B`, Hamburg `HH`,
Frankfurt am Main `F`, München `M` — das, was auf jedem Auto steht, und die App
handelt von Autos. **Nicht zu verwechseln** mit `Land` in `core/holidays.ts`: Dort heißt
Berlin `BE`, weil das der ISO-Code des Bundeslands ist und der
Feiertagskalender daran hängt. Zwei Kürzel für dieselbe Stadt, und sie meinen
Verschiedenes — ein `B` im Feiertagskalender wäre ein Fehler, ein `BE` auf dem
Gruppenbild wäre falsches Deutsch für Autofahrer. Bei Frankfurt fallen die
beiden am weitesten auseinander: Das Kennzeichen ist `F`, das Bundesland `HE`,
und die Stadt heißt weder so noch so. München fällt genauso auseinander: `M`
gegen `BY`. Das Kürzel sitzt in einem Kreis mit einem
Ring in der Flächenfarbe; der erste Entwurf hatte ihn auf dem Schaft des P
sitzen, und die zwei Buchstaben liefen rechts aus ihm heraus.

**Setzen:** beim Bot über @BotFather → `/setuserpic` → Bot wählen → Bild
schicken. Bei einer Gruppe über *Gruppe → Bearbeiten → Bild*. Beides geht nur
in der App; die Bot-API kennt für das eigene Profilbild keinen Endpunkt.

## Was am Bot sonst noch eingestellt gehört

Drei Texte, und die **setzt das Skript selbst** — die Bot-API kann sie, also
tippt sie niemand ab (`./scripts/einrichten.sh botprofil`):

| Feld | Wo es erscheint | Grenze |
| --- | --- | --- |
| **About** (`setMyShortDescription`) | im Profil des Bots, unter dem Namen | 120 Zeichen |
| **Beschreibung** (`setMyDescription`) | auf dem **leeren Chat, vor dem ersten `/start`** — die einzige Chance, jemandem zu erklären, was passiert, *bevor* er etwas schickt | 512 Zeichen |
| **Befehlsmenü** (`setMyCommands`) | neben dem Eingabefeld | 100 Befehle |

Im Menü steht genau **ein** Befehl: `/hilfe`. Mehr beantwortet der Worker
nicht. Ein Menü, das einen Befehl anbietet, den der Bot nicht kennt, ist
schlimmer als keines — es verspricht etwas, und die Antwort ist eine höfliche
Absage.

Der Beschreibungstext nennt zuerst, was der Bot **nicht** speichert. Das ist
kein Beiwerk: Wer einem fremden Bot seinen Standort schickt, hat genau diese
Frage, und sie beantwortet sich hier vor dem ersten Klick statt in einer
Datenschutzerklärung, die niemand aufmacht.

### Zwei Bilder und zwei Schalter, die nur der BotFather kann

- **Profilbild** — `/setuserpic`, `brand/telegram-bot-512.png`.
- **Beschreibungsbild** — *BotFather → Edit Bot → Edit Description Picture*.
  Es steht über dem Beschreibungstext auf dem leeren Chat. Die Vorschaukarte
  taugt dafür, oder das Dach-Bild.
- **`/setjoingroups` → Disable.** Der Bot ist auf Einzelchats gebaut; Gruppen
  mitzulesen ist Stufe 2 und braucht erst einen Missbrauchsfilter. Ein Bot, den
  man in Gruppen ziehen kann, der dort aber schweigt, erzeugt nur Rückfragen.
- **`/setprivacy` → Enable** (ist die Vorgabe). Falls Gruppen je dazukommen,
  sieht er dann nur, was an ihn gerichtet ist.

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
| `@knoellchenfrei_B` | Community Berlin |
| `@knoellchenfrei_HH` | Community Hamburg |
| `@knoellchenfrei_F` | Community Frankfurt am Main |
| `@knoellchenfrei_M` | Community München |
| `@knoellchen_bot` | Meldebot, Stufe 1 aus [todo.md](todo.md#6-telegram--du-token-dann-ich) |

Am 6. September 2026 waren die ersten **vier frei**, am 7. September auch
`@knoellchenfrei_F` und `@knoellchenfrei_M` (geprüft über `t.me/<name>`: Ein
vergebener Name liefert Titel und Beschreibung, ein freier nur den Platzhalter
„Telegram: Contact @…"). Begründung, warum sie trotzdem jetzt belegt werden
sollten, in [entscheidungen.md](entscheidungen.md#telegram-und-der-name).

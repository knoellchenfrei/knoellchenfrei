# A5 — Rechtlich (Impressum, Datenschutz, Lizenzen, Drittanbieter)

Repository `knoellchenfrei/knoellchenfrei`, Branch `main`, Commit `fceadca`.
Prüfung, **keine Rechtsberatung**. Alles, was eine juristische Bewertung
braucht, ist mit **„zu klären mit Anwalt"** markiert. Read-only; keine Anfragen
an Produktivsysteme. Gesetzestexte und Lizenzen wurden am 6. September 2026 bei
gesetze-im-internet.de (DDG §§ 1, 5; TDDDG § 25), gesetze-bayern.de (MStV § 18)
und govdata.de (DL-DE/BY 2.0, DL-DE/Zero 2.0) nachgelesen, nicht aus dem
Gedächtnis zitiert.

## Zusammenfassung

1. Impressum und Datenschutzerklärung existieren nur als **Entwürfe mit Platzhaltern** (`docs/impressum.md`, `docs/datenschutz.md`); die ausgelieferte App zeigt **keinen** Link darauf, weil `VITE_IMPRINT_URL`/`VITE_PRIVACY_URL` in keinem Workflow gesetzt sind.
2. Die App ist dabei **öffentlich erreichbar** (GitHub Pages ist eingeschaltet, Cloudflare Pages deployt automatisch); der „Beta-Riegel" ist `noindex` plus `robots.txt`, kein Zugangsschutz. Ob das die Pflichten aus § 5 DDG, § 18 Abs. 1 MStV und Art. 13 DSGVO aufschiebt, ist die zentrale Anwaltsfrage — die Doku argumentiert nur mit § 5 DDG und übersieht § 18 Abs. 1 MStV, der kein Geschäftsmäßigkeits-Kriterium hat.
3. Der technische Teil der Datenschutzerklärung ist weitgehend korrekt, weicht aber an vier Stellen vom Code ab (Votes tragen einen Client-Hash, Feedback ebenfalls, acht statt drei `localStorage`-Schlüssel, Telegram-Hilfetext widerspricht der DSE).
4. Drittanbieter: heute `tile.openstreetmap.org` (dokumentiert); nach der PMTiles-Umstellung bleiben Glyphen und Sprites von `protomaps.github.io` — die DSE behauptet, der Abfluss „entfällt". Der Werkbericht lädt Google Fonts.
5. Hamburgs DL-DE/BY 2.0 wird in der Oberfläche als Bedingung benannt, aber der Quellenvermerk ist gegen den Lizenztext unvollständig: Datensatz-URI und der Hinweis „Daten geändert" (Geometrien werden vereinfacht) fehlen.
6. Keine Cookies, keine Analytics, keine externen Skripte in `index.html`, Badges selbst erzeugt, keine veralteten TMG/TTDSG/RStV-Verweise, Haftungsausschluss an drei Stellen — das ist sauber.
7. Kein DCO/CLA für Beiträge Dritter.

Findings: 0 critical, 2 high, 6 medium, 6 low, 2 info. Davon **8 „zu klären mit Anwalt"**.

---

## Findings

### High

```
ID: A5-001
Titel: App öffentlich erreichbar ohne Impressum und Datenschutzerklärung — Beta-Riegel ist kein Zugangsschutz
Severity: high
Confidence: confirmed
Evidenz:
  - .github/workflows/pages.yml:1-70 — deployt app/apps/web/dist bei jedem Push auf main und täglich um 04:17 UTC nach GitHub Pages
  - docs/todo.md:425-427 — „GitHub Pages ist eingeschaltet … Damit liegt die App unter https://knoellchenfrei.github.io/knoellchenfrei/"
  - .github/workflows/deploy.yml:40-130 — Cloudflare Pages/Worker-Deploy; grep nach VITE_IMPRINT_URL/VITE_PRIVACY_URL: kein Treffer in .github/workflows/*
  - app/apps/web/src/App.tsx:1055-1056, 1452-1466 — Links erscheinen nur, wenn beide Build-Variablen gesetzt sind
  - app/apps/web/src/components/SettingsSheet.tsx:319-329 — dasselbe im Einstellungs-Sheet; ohne Variablen bleibt nur „Lizenz" (MIT)
  - app/apps/web/vite.config.ts:89-125 — betaGuard: noindex/robots.txt; kein Passwort, keine Allowlist
  - app/apps/web/src/components/SettingsSheet.tsx:190-200 — Beta-Hinweis „Sie wird von einer Privatperson betrieben … bitte den Link nicht weiterverbreiten"
  - app/apps/api/src/worker.ts:179-189 — Worker verarbeitet CF-Connecting-IP jedes Schreibzugriffs (Art. 4 Nr. 1 DSGVO)
  - Rechtsquellen (abgerufen 2026-09-06): § 5 Abs. 1 DDG „für geschäftsmäßige, in der Regel gegen Entgelt angebotene digitale Dienste"; § 18 Abs. 1 MStV „Anbieter von Telemedien, die nicht ausschließlich persönlichen oder familiären Zwecken dienen, haben … Name und Anschrift … ständig verfügbar zu halten"
Wirkung:
  Die Doku (docs/entscheidungen.md:79-84, docs/todo.md:163-175) begründet den
  Aufschub mit „nicht beworben, für Suchmaschinen gesperrt". Lücken in dieser
  Argumentation:
  (a) Erreichbarkeit ist nicht Auffindbarkeit — die Adressen sind für jeden
      abrufbar, und pages.yml veröffentlicht bei jedem Push erneut.
  (b) § 18 Abs. 1 MStV kennt kein „geschäftsmäßig"; die Ausnahme ist nur
      „ausschließlich persönlich oder familiär". Eine App mit Melde-API für
      Fremde und Beta-Hinweis an Testnutzer fällt schwer darunter. Die Doku
      zitiert MStV nur in Abs. 2 (Impressum-Entwurf), Abs. 1 nirgends.
  (c) Art. 13 DSGVO (Informationspflicht bei Erhebung) kennt keinen
      Testbetrieb; der Worker verarbeitet IP-Adressen ab dem ersten Ping.
  Wer die Adresse kennt, kann Abmahnung oder Beschwerde anstoßen; der
  Betreiber ist eine Privatperson (docs/todo.md:104-110).
Empfehlung:
  Zu klären mit Anwalt: ob ein „geschlossener Test" ohne technische
  Zugangsbeschränkung § 5 DDG / § 18 Abs. 1 MStV / Art. 13 DSGVO aufschiebt.
  Bis dahin eine der beiden Richtungen wählen: entweder echte Zugangssperre
  (Cloudflare Access / HTTP-Auth auf Pages, GitHub-Pages-Deploy abschalten,
  Worker-Origin-Liste bleibt geschlossen) — oder Impressum und DSE (auch mit
  Impressum-Dienstleister, Fassung A) veröffentlichen und die beiden
  Build-Variablen in deploy.yml und pages.yml setzen.
Aufwand: M
```

```
ID: A5-002
Titel: Datenschutzerklärung: Auftragsverarbeitung mit Cloudflare und Drittlandtransfer nicht adressiert
Severity: high
Confidence: confirmed
Evidenz:
  - docs/datenschutz.md:148-156 — Tabelle „Empfänger": „⟨Cloudflare, Inc.⟩ … Vertrag zur Auftragsverarbeitung erforderlich"; „⟨Prüfen und ergänzen, was tatsächlich eingesetzt wird.⟩"
  - grep -rn -i "AVV|DPA|Standardvertrag|SCC|Data Processing" docs/ → nur dieser Platzhalter; kein Hinweis, dass Cloudflares DPA angenommen wurde
  - docs/datenschutz.md:1-6 — Verantwortlicher ⟨Vor- und Nachname⟩, alles Platzhalter
  - app/apps/api/wrangler.toml:1-50 — Worker (Cloudflare, Inc., USA) mit KV und D1
  - docs/hosting.md:183-185 — „--jurisdiction eu … beschränkt Ausführung und Speicherung auf die EU" (siehe A5-012: für die Worker-Ausführung stimmt das nicht)
Wirkung:
  Art. 28 DSGVO (AVV) und Kapitel V (Drittlandtransfer, Cloudflare Inc. ist
  US-Unternehmen; EU-US Data Privacy Framework / SCC) werden in der DSE weder
  benannt noch als erledigt dokumentiert. Dasselbe für Telegram (Dubai/BVI)
  und — in der Artifact-Variante — Anthropic (A5-014). Die DSE ist ohne
  diese Angaben nicht Art.-13-konform, selbst wenn der Rest stimmt.
Empfehlung:
  Cloudflare-DPA (Self-Serve, im Dashboard annehmbar) abschließen und in
  docs/entscheidungen.md mit Datum festhalten; Abschnitt 3 der DSE um
  Rechtsgrundlage des Transfers (DPF-Zertifizierung von Cloudflare prüfen,
  sonst SCC) ergänzen. Zu klären mit Anwalt: Formulierung und ob für Telegram
  ein eigener Transferhinweis genügt.
Aufwand: S
```

### Medium

```
ID: A5-003
Titel: Nach der Kachel-Umstellung fließen Nutzer-IPs weiter an Dritte (protomaps.github.io) — DSE sagt „entfällt"
Severity: medium
Confidence: confirmed
Evidenz:
  - app/apps/web/src/map-style.ts:71-72 — glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/…', sprite: 'https://protomaps.github.io/basemaps-assets/sprites/v4/dark'
  - app/apps/web/src/map-style.ts:102 — heute: tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png']
  - docs/datenschutz.md:153 — „OpenStreetMap Foundation … Entfällt, sobald die Kacheln aus dem eigenen Speicher kommen"
  - docs/oeffentlich-machen.md:176-180, docs/todo.md:285-289 — OSM-Kachelrichtlinie deckt ausgelieferte Anwendungen nicht ab
Wirkung:
  Der Vektor-Pfad (VITE_TILES_URL gesetzt) lädt Schriften und Sprites von
  GitHub Pages (Fastly-CDN, USA). Der Browser jedes Nutzers kontaktiert damit
  weiterhin einen Dritten mit IP-Adresse — die DSE wäre nach der Umstellung
  falsch. Heute gilt zusätzlich: Nutzung von tile.openstreetmap.org außerhalb
  der Tile Usage Policy ist ein Vertragsproblem mit der OSMF, nicht nur ein
  Datenschutzthema.
Empfehlung:
  Fonts und Sprites aus protomaps/basemaps-assets in den R2-Eimer spiegeln
  (Lizenz der Assets prüfen — basemaps-assets ist BSD/OFL) und die URLs über
  VITE_TILES_URL-Basis ableiten; die DSE-Zeile erst dann auf „entfällt"
  ändern. Bis dahin GitHub/Fastly als Empfänger in Abschnitt 3 aufnehmen.
Aufwand: S
```

```
ID: A5-004
Titel: Werkbericht lädt Google Fonts (fonts.googleapis.com / fonts.gstatic.com)
Severity: medium
Confidence: confirmed
Evidenz:
  - docs/bericht/index.html:2-4 — <link rel="preconnect" href="https://fonts.googleapis.com">, … fonts.gstatic.com, <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo…&family=Newsreader…&family=JetBrains+Mono…">
  - docs/neue-sitzung.md:48 — der Bericht ist als Artifact veröffentlicht (https://claude.ai/code/artifact/32d83da8-…); README.md:290-291 verlinkt die Quelle
  - .github/workflows/pages.yml — deployt nur app/apps/web/dist; docs/bericht wird NICHT auf GitHub Pages ausgeliefert
Wirkung:
  Jeder Aufruf des Berichts übermittelt die IP-Adresse des Lesers an Google
  (USA). Genau dafür hat das LG München I (Urteil vom 20.01.2022, 3 O 17493/20)
  Schadensersatz zugesprochen. Reichweite heute begrenzt: Artifact ist
  standardmäßig privat, Repo-Kopie wird nicht als Seite ausgeliefert. Wird der
  Bericht geteilt oder das Repo öffentlich mit Pages-Ausspielung, wird daraus
  ein echter Datenabfluss ohne Einwilligung und ohne DSE.
Empfehlung:
  Schriften als WOFF2 einbetten (data:-URI, alle drei sind SIL OFL) oder auf
  System-Schriftstapel zurückfallen; preconnect-Zeilen entfernen. Zu klären
  mit Anwalt nur, falls der Bericht bewusst öffentlich gemacht werden soll.
Aufwand: S
```

```
ID: A5-005
Titel: Salz für Client-Hashes wird nie rotiert und ist nicht erzwungen — Doku und Code-Kommentare versprechen mehr
Severity: medium
Confidence: confirmed
Evidenz:
  - app/apps/api/src/worker.ts:45-50 — „Set it, and rotate it daily: wrangler secret put CLIENT_SALT. Without it the hash is brute-forceable back to an IP in minutes."
  - app/apps/api/src/worker.ts:175-177 — „Rotating it daily also caps how long two actions can be linked"
  - app/apps/api/src/worker.ts:179-183 — material = [CF-Connecting-IP, env.CLIENT_SALT ?? ''] → ohne Secret läuft der Worker weiter und hasht die nackte IP
  - app/apps/api/src/worker.ts:673-676 — telegramHash: `telegram:${userId}|${env.CLIENT_SALT ?? ''}` — Telegram-IDs sind ~10-stellige Ganzzahlen, ohne Salz trivial durchprobierbar
  - scripts/einrichten.sh:429-436 — Salz wird einmalig erzeugt; grep -rn "rotier|rotat|CLIENT_SALT" über .sh/.yml/.toml/.md: kein Rotationsmechanismus, kein Cron
  - app/apps/api/src/worker.ts:828-857 — scheduled(): nullt Hashes, rotiert nichts
  - docs/datenschutz.md:136-141 — „ohne das Geheimnis ist daraus keine IP-Adresse rekonstruierbar"
Wirkung:
  Die Zusage der DSE hängt an einem Secret, dessen Fehlen der Code nicht
  bemerkt. Ist es gesetzt (einrichten.sh tut das), stimmt die Aussage — aber
  „täglich rotiert" steht als Annahme im Code und ist nirgends umgesetzt;
  die Verkettbarkeit zweier Aktionen ist damit nur durch das stündliche
  Nullen (≤ ~2 h) begrenzt, nicht durch Rotation.
Empfehlung:
  (a) Worker bei fehlendem CLIENT_SALT auf Schreibpfaden mit 503 antworten
  lassen statt zu hashen. (b) Entweder Rotation bauen (Tag in das Material
  mischen: `${salt}|${berlinDay()}` ergibt dieselbe Wirkung ohne Secret-
  Wechsel) oder den Kommentar und SECURITY.md:108-111 auf „rotierbar, nicht
  rotiert" korrigieren.
Aufwand: S
```

```
ID: A5-006
Titel: Hamburg (DL-DE/BY 2.0): Quellenvermerk ohne Datensatz-URI und ohne Änderungshinweis
Severity: medium
Confidence: confirmed
Evidenz:
  - Lizenztext govdata.de/dl-de/by-2-0 (abgerufen 2026-09-06), § 2: Quellenvermerk muss enthalten „Bezeichnung des Bereitstellers …, der Vermerk ‚Datenlizenz Deutschland – Namensnennung – Version 2.0' … mit Verweis auf den Lizenztext … sowie einen Verweis auf den Datensatz (URI)"; § 3: „Veränderungen, Bearbeitungen … sind im Quellenvermerk mit dem Hinweis zu versehen, dass die Daten geändert wurden."
  - app/apps/web/src/components/SettingsSheet.tsx:298-317 — zeigt {source} · Lizenz-Link · „Die Lizenz dieser Stadt verlangt die Nennung der Quelle. Wer die Daten weiterverwendet, muss … nennen." — kein Datensatz-URI, kein Änderungshinweis
  - app/apps/web/public/data/hamburg/meta.json — source, licence, licenceUrl, attributionRequired; kein Feld für Datensatz-URI oder „modified"
  - app/packages/ingest/src/build-data-hamburg.ts:170, 236 — simplifyGeometry(geometry, 1e-4|1e-5, 5): Geometrien werden vereinfacht (Ramer-Douglas-Peucker, app/packages/ingest/src/simplify.ts:1-11); Achsen werden getauscht (docs/data-sources.md:72-77)
  - app/apps/web/e2e/app.spec.ts:573-584 — Test prüft nur Lizenzname und das Wort „verlangt"
  - app/packages/core/test/fixtures/hh-bewohnerparkgebiete-2026-09-06.json — Hamburger Rohdaten liegen im Repo (Weitergabe unter BY 2.0; Quellenvermerk nur in docs/data-sources.md:51-61)
Wirkung:
  Die Lizenzbedingung wird sichtbar benannt (das ist besser als bei den
  meisten Projekten), aber zwei der vier Pflichtangaben fehlen. Der
  Änderungshinweis ist kein Detail: Vereinfachte Polygone sind nicht mehr die
  amtlichen Grenzen, und wer sie als solche weiterverwendet, wird in die Irre
  geführt. Berlin (DL-DE/Zero) ist davon nicht betroffen — Zero kennt keine
  Bedingungen (Lizenztext abgerufen).
Empfehlung:
  meta.json um `datasetUrl` (WFS-Endpunkt/Metadatensatz-URI) und
  `modified: true` erweitern; SettingsSheet und Provenance-Fußzeile um
  „Datensatz: ⟨URI⟩ · Daten geändert (Geometrien vereinfacht)" ergänzen;
  E2E-Test entsprechend schärfen. Fixture-Datei mit Kopfkommentar oder
  Begleit-README versehen.
Aufwand: S
```

```
ID: A5-007
Titel: Datenschutzerklärung weicht an vier Stellen vom tatsächlichen Datenfluss ab
Severity: medium
Confidence: confirmed
Evidenz:
  (a) Votes tragen einen Client-Hash mit Millisekunden-Zeitstempel:
      - app/apps/api/migrations/0001_schema.sql:56-64 — votes(sighting_id, client_hash NOT NULL, voted_at)
      - app/apps/api/src/worker.ts:618-621 — INSERT … VALUES (?, ?, ?) .bind(id, hash, Date.now()) — voted_at nicht gebucketet
      - app/apps/api/src/worker.ts:830-840 — Cron nullt client_hash nur in sightings und feedback; votes werden erst mit der Sichtung gelöscht (≤ 90 min + Cron-Versatz)
      - docs/datenschutz.md:44-48 — nennt bei „Bestätigungen und Widersprüche" nur „Zähler"
  (b) Feedback speichert einen Client-Hash:
      - app/apps/api/src/worker.ts:493-497 — INSERT INTO feedback (…, client_hash)
      - docs/datenschutz.md:64-67 — „überträgt den Text, die gewählte Kategorie und den Zeitpunkt auf die Stunde gerundet — sonst nichts"
      - app/apps/web/src/components/FeedbackSheet.tsx:128-131 — „Gespeichert wird nur, was hier steht, plus die Stunde"
  (c) localStorage: DSE nennt drei Inhalte, Code hat acht Schlüssel:
      - docs/datenschutz.md:30-36 — Parkplatz, eigene Meldungen, Tages-Zufallskennung
      - app/apps/web/src/storage.ts:41-46 — session, sightings, marks.v1, locationAsked.v1, visits.v1, installHidden.v1; app/apps/web/src/presence.ts:54 — visit.v1; app/apps/web/src/city.ts:27 — knoellchenfrei:city
  (d) Telegram-Hilfetext widerspricht der DSE:
      - app/apps/api/src/worker.ts:646 — „Weder dein Name noch deine Telegram-Kennung landen in der Datenbank."
      - app/apps/api/src/worker.ts:673-676, 748-761 — gesalzener Hash der Kennung wird mit der Sichtung gespeichert
      - docs/datenschutz.md:105-111 — sagt es richtig („ausschließlich als gesalzener Hashwert")
Wirkung:
  Die DSE behauptet Vollständigkeit („technisch vollständig und korrekt",
  docs/datenschutz.md:3-6). Art. 13 DSGVO verlangt Richtigkeit; ein
  Hilfetext, der weniger sagt als die DSE, ist eine irreführende
  Information gegenüber dem Betroffenen. Sachlich sind alle vier Punkte
  klein — der Hash ist salted und kurzlebig —, aber es sind genau die
  Stellen, an denen eine Aufsichtsbehörde die Sorgfalt des Rests misst.
Empfehlung:
  DSE 2.3 um „je Stimme ein gesalzener Hash bis zum Verfall der Meldung",
  2.5 um den Hash (≤ 1 h), 2.2 um die vollständige Schlüsselliste ergänzen;
  Telegram-Hilfetext auf „nur als gesalzener Hash, für eine Stunde" ändern;
  voted_at wie reported_at auf 5 Minuten bucketen und votes.client_hash im
  Cron mitnullen (nach 1 h braucht das Rate-Limit ihn nicht mehr; die
  Einmaligkeit je Sichtung ließe sich über einen zweiten, salzfreien
  Schlüssel halten — zu entwerfen).
Aufwand: S
```

```
ID: A5-008
Titel: § 25 TDDDG: Tages-Zufallskennung im localStorage dient der Besuchszählung, nicht dem gewünschten Dienst
Severity: medium
Confidence: likely
Evidenz:
  - § 25 Abs. 1 TDDDG (abgerufen 2026-09-06): Speicherung/Zugriff nur mit Einwilligung; Abs. 2 Nr. 2: Ausnahme, wenn „unbedingt erforderlich, damit der Anbieter … einen vom Nutzer ausdrücklich gewünschten digitalen Dienst zur Verfügung stellen kann"
  - app/apps/web/src/presence.ts:54, 77-90, 112-126 — visit.v1 (Tag + Zufalls-ID) wird gespeichert und alle zwei Minuten an /visits gesendet; Zweck laut Kommentar: „how many distinct devices today"
  - app/apps/api/src/worker.ts:407-445 — Server zählt daraus „today"/„online"
  - docs/datenschutz.md:30-36 — stützt alle localStorage-Inhalte auf § 25 Abs. 2 Nr. 2 („technisch erforderlich, damit die Parkuhr einen Neuladen übersteht")
  - grep -rn -i cookie app/apps/web/src app/apps/api/src → keine Cookies
Wirkung:
  Parkuhr, eigene Meldungen, Stadt und die Standort-/Install-Merker sind gut
  als „unbedingt erforderlich" vertretbar. Die Besuchskennung ist es nicht:
  Sie dient einer Statistik des Betreibers („heute geöffnet"), nicht einer
  Funktion, die der Nutzer angefordert hat. Reichweitenmessung ist der
  klassische Streitfall der DSK-Orientierungshilfe zu § 25 TDDDG; die
  Datensparsamkeit (tagesfrisch, keine Verkettung) hilft bei Art. 6 DSGVO,
  ändert aber nichts an der Frage nach der Ausnahme in § 25 Abs. 2.
Empfehlung:
  Zu klären mit Anwalt. Technisch ohne Rechtsfrage lösbar: Kennung nur im
  Speicher der Seite halten (sessionStorage oder Variable) — dann gibt es
  keinen Zugriff auf die Endeinrichtung über die Sitzung hinaus; die Zahl
  „heute" wird etwas höher (ein Gerät, das die App zweimal öffnet, zählt
  zweimal), die Rechtsfrage entfällt.
Aufwand: S
```

### Low

```
ID: A5-009
Titel: Kein DCO oder CLA für Beiträge Dritter
Severity: low
Confidence: confirmed
Evidenz:
  - CONTRIBUTING.md:1-73 — kein Abschnitt zu Lizenzierung der Beiträge, kein Sign-off, kein DCO-Verweis
  - LICENSE:1-3 — „Copyright (c) 2012-2026 Thomas Kamann and contributors"
  - .github/pull_request_template.md, .github/workflows/ci.yml — kein DCO-Check
Wirkung:
  Beiträge Dritter stehen nur implizit (inbound = outbound) unter MIT. Für
  ein MIT-Projekt reicht das meist; bei einem späteren Lizenzwechsel oder
  Streit über eine Einreichung fehlt der Beleg.
Empfehlung:
  Einen Satz in CONTRIBUTING.md („Mit einem Pull Request stellst du deinen
  Beitrag unter die MIT-Lizenz des Projekts") oder DCO 1.1 mit
  `Signed-off-by`; keine CLA nötig.
Aufwand: S
```

```
ID: A5-010
Titel: Impressum-Entwurf zitiert § 18 Abs. 2 MStV (journalistisch-redaktionell) statt § 18 Abs. 1 MStV
Severity: low
Confidence: likely
Evidenz:
  - docs/impressum.md:27, 43 — „Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV"
  - § 18 Abs. 2 MStV (abgerufen 2026-09-06): gilt für „journalistisch-redaktionell gestaltete[…] Angebote[…], in denen insbesondere … Inhalte periodischer Druckerzeugnisse … wiedergegeben werden"
  - § 18 Abs. 1 MStV: Name und Anschrift für alle Telemedien, die „nicht ausschließlich persönlichen oder familiären Zwecken dienen" — in keiner Datei erwähnt (grep -rn "MStV" docs/ → nur Abs. 2)
  - grep -rn -E "\bTMG\b|TTDSG|RStV" (ohne audit/) → 3 Treffer, alle als „früher § 5 TMG"/„alten § 5 TMG" — korrekt historisch, kein veralteter Verweis
Wirkung:
  Die Angabe schadet nicht (Übererfüllung), aber sie zeigt, dass die
  einschlägige Norm für nicht-kommerzielle Angebote — Abs. 1 — nicht
  geprüft wurde; genau die trägt das Argument in A5-001.
Empfehlung:
  Zu klären mit Anwalt, ob die App journalistisch-redaktionell ist (nach
  Lesart des Prüfers: nein — amtliche Daten plus Nutzermeldungen, keine
  redaktionelle Auswahl). Abs.-2-Zeile streichen oder als optional
  markieren; § 18 Abs. 1 MStV in die Begründung der Impressumspflicht
  aufnehmen.
Aufwand: S
```

```
ID: A5-011
Titel: Betroffenenrechte bei Freitext-Feedback ohne Lesepfad und ohne Kontaktweg
Severity: low
Confidence: confirmed
Evidenz:
  - docs/datenschutz.md:170-178 — Art.-11-Argument nur für „Meldungen noch Strichlisten"; Feedback nicht genannt
  - docs/datenschutz.md:64-79 — Feedback kann personenbezogene Daten enthalten („weil Menschen sie in ein offenes Feld schreiben"); „kein Lesezugriff für andere Nutzende"
  - app/apps/api/src/worker.ts:770-826 — kein GET-Endpunkt für feedback; Lesen nur über `wrangler d1 execute` durch den Betreiber
  - app/apps/api/src/worker.ts:493-497, 848-857 — client_hash ≤ 1 h, Text 90 Tage
  - docs/datenschutz.md:1-6 — Kontakt nur als ⟨Adresse⟩-Platzhalter; SECURITY.md:3-6 — Meldeweg nur GitHub Security Advisories (setzt GitHub-Konto voraus)
Wirkung:
  „Kein Lesepfad" heißt nicht „keine Verarbeitung": Der Betreiber kann
  lesen und muss auf ein Auskunfts- oder Löschersuchen (Art. 15/17) reagieren
  können. Da kein Identifikator gespeichert wird, greift Art. 11 DSGVO — der
  Betroffene müsste den Text selbst benennen. Das ist vertretbar, steht aber
  nicht in der DSE. Ein Kontaktweg außerhalb GitHubs fehlt bis das Impressum
  steht.
Empfehlung:
  Art.-11-Absatz um Feedback erweitern („wer seinen Text benennt, bekommt
  ihn gelöscht"); Löschverfahren als Befehl in docs/hosting.md festhalten;
  E-Mail-Kontakt in SECURITY.md ergänzen, sobald das Impressum eine hat.
  Zu klären mit Anwalt: ob Art. 11 hier trägt.
Aufwand: S
```

```
ID: A5-012
Titel: EU-Jurisdiktion gilt nur für D1, nicht für KV und Worker-Ausführung — Doku überzeichnet
Severity: low
Confidence: likely
Evidenz:
  - scripts/einrichten.sh:158, 350-352 — `--jurisdiction ${D1_JURISDIKTION:-eu}` nur beim `d1 create`; wrangler.toml:13-17 enthält keinen nachprüfbaren Jurisdiktionswert
  - app/apps/api/wrangler.toml:10-12 — KV-Namespace CACHE ohne Jurisdiktion (Cloudflare KV bietet keine)
  - docs/hosting.md:183-185 — „--jurisdiction eu … beschränkt Ausführung und Speicherung auf die EU"
  - docs/datenschutz.md:152 — „Datenbank per --jurisdiction eu auf die EU beschränken"
Wirkung:
  Der Worker läuft an dem Cloudflare-Standort, der dem Nutzer am nächsten
  ist — für Nutzer in Berlin praktisch EU, aber nicht garantiert; die IP im
  Request und der KV-Cache (nur öffentliche WFS-Antworten, unkritisch)
  sind davon nicht erfasst. Die DSE sollte „Datenbank in der EU" sagen,
  nicht „Verarbeitung in der EU". (Unverified: ob Cloudflares
  D1-Jurisdiktion auch die Worker-Ausführung einschränkt — Cloudflare-Doku
  aus dieser Umgebung nicht abgerufen.)
Empfehlung:
  Formulierung in hosting.md und DSE präzisieren; die tatsächlich gesetzte
  Jurisdiktion nach dem Anlegen mit `wrangler d1 info` in
  entscheidungen.md protokollieren.
Aufwand: S
```

```
ID: A5-013
Titel: Workers Observability (Logs bei Cloudflare) eingeschaltet, in der DSE nicht erwähnt
Severity: low
Confidence: unverified
Evidenz:
  - app/apps/api/wrangler.toml:27-28 — [observability] enabled = true
  - grep -rn -i "observab|Workers Logs|Logpush" docs/ → kein Treffer
  - docs/datenschutz.md:130-141 — Abschnitt 2.9 nennt nur „Verbindungsdaten" des Infrastrukturbetreibers, keine vom Worker selbst erzeugten Logs
Wirkung:
  Workers Logs speichern Aufruf-Metadaten (Standard 3 bzw. 7 Tage bei
  Cloudflare) und alle console.*-Ausgaben; ob CF-Connecting-IP darin
  landet, ließ sich aus dieser Umgebung nicht prüfen. Der Worker loggt
  selbst nichts Personenbezogenes (grep console. in worker.ts: keine
  Treffer mit Hash/IP), aber die Plattform-Logs sind eine Verarbeitung,
  die die DSE nicht nennt.
Empfehlung:
  Im Cloudflare-Dashboard prüfen, welche Felder Workers Logs erfasst;
  entweder abschalten (Free Tier, geschlossener Test) oder als
  „Fehlerprotokolle beim Infrastrukturbetreiber, x Tage" in 2.9 aufnehmen.
Aufwand: S
```

```
ID: A5-014
Titel: Artifact-Variante: Anthropic als Empfänger (db/room) fehlt in der Datenschutzerklärung
Severity: low
Confidence: confirmed
Evidenz:
  - app/apps/web/src/presence.ts:164-200 — window.claude.use('room') / use('db'): Präsenz und Tageszähler laufen über die Artifact-Laufzeit
  - app/apps/web/src/sighting-backend.ts:336-338 — Sichtungen im Artifact liegen in der db-Capability
  - docs/datenschutz.md:76-86 — beschreibt den „Artifact-Speicher" technisch, nennt aber keinen Anbieter, keinen Sitz, keine Rechtsgrundlage
  - docs/neue-sitzung.md:47 — Artifact-URL der App
Wirkung:
  Wer die Artifact-Fassung benutzt, verarbeitet Sichtungen und Präsenz bei
  Anthropic (USA) — ein Empfänger im Sinne von Art. 13 Abs. 1 lit. e, der
  nicht genannt ist. Solange das Artifact privat ist, sind die Betroffenen
  Betreiber und eingeladene Tester.
Empfehlung:
  Eigene Zeile in Abschnitt 3 („Anthropic PBC — nur in der Artifact-Fassung,
  Sichtungen und Anwesenheit") oder die Artifact-Fassung ausdrücklich als
  Entwicklungsvorschau ohne Fremdnutzer kennzeichnen.
Aufwand: S
```

### Info

```
ID: A5-015
Titel: Was in Ordnung ist — belegt, damit es nicht erneut geprüft werden muss
Severity: info
Confidence: confirmed
Evidenz:
  - Keine externen Skripte/Stylesheets/Analytics in app/apps/web/index.html:1-27; Manifest ohne Fremdadressen (public/manifest.webmanifest)
  - Keine Cookies: grep -rn -i cookie app/apps/web/src app/apps/api/src → 0 Treffer
  - Externe Adressen im Web-Code vollständig: SettingsSheet.tsx:21-22 (GitHub, freifahren.org — reine Links), TowInfo.tsx:12 (berlin.de — Link), map-style.ts:71-72, 102 (siehe A5-003)
  - Badges selbst erzeugt: app/packages/ingest/src/build-badges.ts:1-9 („Deliberately not shields.io"); README.md:219-220
  - Haftungsausschluss „Verbindlich ist die Beschilderung vor Ort": App.tsx:1431-1434, SettingsSheet.tsx:168-173, ZonePanel.tsx:126, docs/impressum.md:66-73
  - OSM-Attribution (ODbL): map-style.ts:79, 105 (MapLibre-Attribution-Control, App.tsx:288), SettingsSheet.tsx:305 als Text
  - Berlin DL-DE/Zero 2.0: Lizenztext bestätigt „Jede Nutzung ist ohne Einschränkungen oder Bedingungen zulässig" — attributionRequired:false (core/city.ts:95) ist korrekt
  - Assets Eigenwerk: docs/brand/*.svg und Icons aus make-brand.mjs/make-icons.mjs; Schriftname „Archivo" (SIL OFL) nur als font-family-Referenz, nicht eingebettet
  - Gesetzesverweise aktuell: DDG statt TMG, TDDDG statt TTDSG, MStV statt RStV; TMG nur als „früher" (docs/impressum.md:6, entscheidungen.md:90-91, todo.md:183-184)
  - Standortabfrage: nur auf Nutzeraktion, mit Vorschaltdialog und Alternative (App.tsx:765-772, LocationPrompt.tsx:22-49); Position wird nicht übertragen, außer bei bewusster Meldung, dann gerundet
  - Beta-Riegel ist getestet: e2e/pwa.spec.ts:257-265 prüft noindex und robots.txt
Wirkung: keine
Empfehlung: keine
Aufwand: –
```

```
ID: A5-016
Titel: Bewegungsprofil-Analyse: Gegenmaßnahmen im Code stimmen mit der Doku überein — mit einer Ausnahme (Votes)
Severity: info
Confidence: confirmed
Evidenz:
  Stellen, an denen Ort + Zeit + Kennung zusammenkommen, und was der Code tut:
  | Tabelle   | Ort                         | Zeit                                    | Kennung                        | Löschung (Cron `7 * * * *`, wrangler.toml:23) |
  | sightings | lon/lat auf 1e-4° (~7–11 m), worker.ts:213-215, 568-570; Client ebenso sighting-backend.ts:119-120 | 5-min-Raster, worker.ts:571 | client_hash (IP+Salz oder Telegram-ID+Salz) | Hash NULL nach 1 h (833-836), Zeile nach 90 min (837) |
  | votes     | über sighting_id            | **Millisekunden**, worker.ts:621        | client_hash                    | mit der Sichtung (838-840); Hash wird nicht genullt |
  | marks     | 250-m-Zelle, heatmap.ts:29, 137-144 | Tag + Stunde, keine Minute       | keine (schema 72-79)           | nach 28 Tagen (842-844) |
  | visits    | keine                       | seen_at ms, aber je Gerät/Tag überschrieben (433-435) | tagesfrischer Client-Nonce | nach 2 Tagen (845-847) |
  | feedback  | keine                       | Stunde (497)                            | client_hash ≤ 1 h (851-854)    | 90 Tage (855-857) |
  - Leseendpunkt gibt keinen Hash heraus: worker.ts:318 (SELECT id, lon, lat, reported_at, confirmations, disputes)
  - Lokale Heatmap-Strichliste (storage.ts:43, MARKS_KEY) bleibt auf dem Gerät
Wirkung:
  Rundung, Bucketing und Löschjob sind so umgesetzt wie in docs/datenschutz.md
  und SECURITY.md beschrieben. Der einzige Ausreißer ist votes.voted_at in
  Millisekunden plus ungenullter Hash — innerhalb von 90 Minuten lässt sich
  daraus „dieser Hash war zu genau dieser Sekunde an dieser 10-m-Position"
  ableiten; das ist in A5-007 als Empfehlung enthalten. Der Cron läuft
  stündlich, also leben Hashes bis ~2 h und Sichtungszeilen bis ~2,5 h in
  der Datenbank (der Lesefilter versteckt sie ab 90 min); die DSE sagt
  „nach 90 Minuten gelöscht" — Ergänzung „spätestens innerhalb einer Stunde
  danach" wäre exakter.
Empfehlung: siehe A5-007
Aufwand: –
```

---

## Zu klären mit Anwalt — Sammelliste

| Finding | Frage |
| --- | --- |
| A5-001 | Schiebt ein „geschlossener Test" ohne Zugangsschutz § 5 DDG / § 18 Abs. 1 MStV / Art. 13 DSGVO auf? |
| A5-002 | Formulierung AVV/Drittlandtransfer für Cloudflare und Telegram |
| A5-004 | Nur falls der Werkbericht öffentlich werden soll |
| A5-008 | Fällt die Tages-Besuchskennung unter § 25 Abs. 2 Nr. 2 TDDDG? |
| A5-010 | Ist die App journalistisch-redaktionell (§ 18 Abs. 2 MStV)? |
| A5-011 | Trägt Art. 11 DSGVO für Freitext-Feedback? |
| docs/impressum.md:75-80 | § 23 Abs. 1c StVO / Zulässigkeit der Meldefunktion — in der Doku selbst bereits als anwaltlich zu klären markiert |
| docs/entscheidungen.md:68-72 | Gemeinnützigkeit (§ 52 AO) mit Kontroll-Heatmap — Steuerberatung, in der Doku markiert |

---

## Coverage

Grundgesamtheit `audit/inventory.json`: 176 Dateien, Commit `fceadca5…`.

| Klasse | Gesamt | Geprüft | Übersprungen (Grund) | Nicht erreicht |
| --- | ---: | ---: | ---: | ---: |
| legal | 5 | 5 | 0 | 0 |
| doc | 16 | 13 | 3 (`staedte.md`, `org-profil.md`, `ideen-2012.md` — Datenanalyse/Historie, keine Rechtstexte) | 0 |
| other | 2 | 2 | 0 | 0 |
| iac | 3 | 3 | 0 | 0 |
| ci | 9 | 2 (`pages.yml`, `deploy.yml`) | 7 (`ci.yml`, `lint-workflows.yml`, `dependabot.yml`, 3 Issue-Vorlagen, PR-Vorlage — keine Datenverarbeitung, keine Rechtstexte; Issue-Vorlagen laufen über GitHub, dessen DSE gilt) | 0 |
| config | 20 | 2 (`meta.json` Berlin/Hamburg) | 18 (Build-/TS-/Paket-Konfiguration, Lockfile, Test-Fixtures — Fixtures unter A5-006 nur als Lizenzfrage erfasst) | 0 |
| code | 82 | 32 | 50 (Parser, Tarif, Feiertage, Format, Tests, Ingest-Fetch — kein Umgang mit personenbezogenen Daten, keine Rechtstexte, keine Fremdadressen laut Grep über `app/apps/web/src`) | 0 |
| asset | 39 | 6 (alle `docs/brand/*.svg` auf Schriften/Fremdinhalte) | 33 (PNG, GeoJSON, Badges, Screenshots — binär bzw. aus geprüften Skripten erzeugt) | 0 |
| **Summe** | **176** | **65** | **111** | **0** |

Geprüfte Code-Dateien (32): `apps/api/src/worker.ts`, `packages/core/src/{telegram,city,heatmap,sighting}.ts`, `apps/web/src/{App.tsx,map-style.ts,sw-template.js,presence.ts,storage.ts,feedback.ts,sighting-backend.ts,city.ts,pwa.ts}`, `apps/web/src/components/{SettingsSheet,LocationPrompt,FeedbackSheet,ReportSheet,BetaBadge,ZonePanel,TowInfo}.tsx`, `apps/web/vite.config.ts`, `apps/web/e2e/{app,pwa}.spec.ts`, `packages/ingest/src/{simplify,build-data,build-data-hamburg,build-badges,build-artifact}.ts`, `apps/web/scripts/{make-brand,make-icons}.mjs`, `scripts/einrichten.sh`.

Nicht geprüft, weil außerhalb des Auftrags/der Umgebung: die ausgelieferten Adressen selbst (keine Requests gegen Produktivsysteme), Cloudflare-Dashboard (DPA-Status, Jurisdiktion, Log-Felder), GitHub-Repository-Sichtbarkeit.

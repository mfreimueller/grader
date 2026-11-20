# Gradeflow

Gradeflow beurteilt Abgaben (Hand-ins) einer Aufgabe mit Claude Code und schlägt für jede Schülerin und jeden Schüler
ein Ergebnis samt kurzem Kommentar vor. Gespeichert wird erst, nachdem die Lehrperson die Vorschläge geprüft hat:
Gradeflow trifft keine Entscheidung allein (DSGVO Art. 22).

Gestartet wird im Kurs über „Werkzeuge“ → „Gradeflow“. Die Leistung, die beurteilt wird, ist eine Spalte des Kurses
(Symbole oder Punkte).

Die Abgaben kommen aus einer von zwei Quellen: aus einem **Moodle**-Abgabenordner (Standard, siehe unten) oder aus
**J;DE**, dem Java-Lernprogramm der Schule (siehe „Quelle J;DE“).

## Ablauf

1. **Einrichten:** Leistung, Aufgabenstellung (Datei **oder Ordner**), Ordner mit den Abgaben, optional eine
   Musterlösung (Datei **oder Ordner**) und das Bewertungs-Skill wählen. Ein Ordner eignet sich für Angabe samt
   Vorlageprojekt; der Agent liest dann alle Dateien darin und weiß, dass Vorlagecode nicht zur eigenen Leistung der
   Schüler/innen zählt.
2. **Zuordnen:** Grader ordnet die Abgabeordner den Schülerinnen und Schülern des Kurses zu. Die Zuordnung lässt sich
   korrigieren; nicht erkannte Ordner werden aufgelistet und übersprungen.
3. **Prüfung vor dem Start:** Grader baut den Arbeitsbereich und meldet, was sich nicht sicher von Namen befreien lässt
   (siehe unten). Einzelne Dateien können ausgeschlossen werden.
4. **Lauf:** Claude Code beurteilt alle Abgaben in einem einzigen Lauf. Der Fortschritt ist in Grader sichtbar; der Lauf
   lässt sich abbrechen.
5. **Prüfen:** Eine Tabelle zeigt pro Schüler Vorschlag, bisheriges Ergebnis und Kommentar. Kommentare sind
   editierbar, Zeilen lassen sich abwählen. Zeilen, die ein vorhandenes Ergebnis überschreiben würden, sind markiert;
   beim Speichern fragt Grader einmal nach, wie viele Ergebnisse ersetzt werden.
6. **Speichern:** Ergebnisse werden in die Leistung eingetragen, die Kommentare als Notizen gespeichert. Ein erneuter
   Lauf ersetzt die Notiz, statt eine weitere anzuhängen. Nach dem Speichern oder Verwerfen wird der Arbeitsbereich
   gelöscht; einen Verlauf früherer Läufe gibt es nicht.

## Datenschutz

- **Pseudonyme pro Lauf:** Jede Abgabe erhält für den Lauf ein zufälliges Kürzel (8 Zeichen). Das Kürzel gilt nur für
  diesen Lauf; die Zuordnung zu Schülerinnen und Schülern bleibt im Speicher von Grader und wird nie als Datei in den
  Arbeitsbereich geschrieben. Interne Grader-Kennungen werden nicht verwendet.
- **Namen werden ersetzt:** Vollständige Namen in Textdateien (Vorname Nachname, Nachname Vorname, „Nachname, Vorname“;
  Groß-/Kleinschreibung egal) werden durch `STUDENT` ersetzt, ebenso zusammengesetzte Formen wie `max_mustermann`,
  `Max.Mustermann` oder `MaxMustermann`, auch innerhalb längerer Bezeichner.
- **Einzelne Namen werden gemeldet:** Ein alleinstehender Vor- oder Nachname wird nicht ersetzt (er kann ein
  Codewort wie `max` sein), sondern in der Prüfung vor dem Start aufgelistet. Dasselbe gilt für Dateien, die nicht als
  Text lesbar sind (Binärdateien, PDFs, Bilder). Die Lehrperson entscheidet: Datei ausschließen, fortfahren oder
  abbrechen. Weitere personenbezogene Angaben (E-Mail-Adressen, Matrikelnummern) werden nicht erkannt.
- **Kopie im temporären Ordner:** Die Abgaben werden in einen temporären Ordner kopiert; die Originale bleiben
  unverändert. Der Ordner wird nach dem Lauf gelöscht.
- **Ordner der Lehrperson werden nicht anonymisiert:** Dateien aus einem Aufgaben- oder Musterlösungsordner werden
  unverändert übernommen (wie eine einzelne Datei auch). Keine Schülerdaten in diese Ordner legen.
- **Isolierter Agent:** Claude Code läuft ohne MCP-Server und ohne Benutzereinstellungen und darf nur mit den
  Werkzeugen Read, Glob und Grep innerhalb des Arbeitsbereichs lesen. Code wird nie ausgeführt, Dateien werden nicht
  geschrieben.
- **Kommentare ohne Namen:** Anweisungen und Ausgabeformat verbieten Namen und Kürzel in Kommentaren; kommt trotzdem
  eines vor, wird es entfernt und die Zeile markiert.

Bei der Quelle J;DE kommen die Abgaben vom J;DE-Server (verschlüsselte Verbindung, Authentifizierung mit dem API-Schlüssel)
und werden nur im Speicher gehalten, bis sie in den temporären Arbeitsbereich geschrieben werden; die Bewertung wird erst nach
der Prüfung an J;DE gesendet.

Zur Beurteilung werden die (von Namen befreiten) Abgaben an Anthropic übertragen. Ob das an der eigenen Schule zulässig
ist, ist vorab zu klären.

## Voraussetzungen

- Eine Anmeldung bei Claude Code auf dem Rechner (`claude` einmal im Terminal starten und anmelden). OAuth-Anmeldungen
  laufen ab; schlägt ein Lauf wegen der Anmeldung fehl, ist sie zu erneuern.
- Quelle Moodle: ein Moodle-Abgabenordner (siehe unten).
- Quelle J;DE: ein API-Schlüssel und die Adresse des J;DE-Servers (siehe „Quelle J;DE“).

## Grenzen und Einstellungen

Ein Lauf endet, wenn eine Grenze erreicht ist; dann wird nichts vorgeschlagen. Beide Grenzen sind in den Einstellungen
unter „Gradeflow“ einstellbar:

| Einstellung | Standard | Bereich |
|---|---|---|
| Höchstkosten pro Lauf | 3 USD | 0,10 bis 50 USD |
| Zeitlimit pro Lauf | 15 Minuten | 1 bis 120 Minuten |

Das Standardmodell ist Sonnet; ein Skill kann ein anderes festlegen (siehe `model` unten). Alle Abgaben werden in einem
Lauf beurteilt; sehr große Stapel können an Kontextgrenzen stoßen und sind dann in mehreren Läufen zu beurteilen.

## Abgabeordner (Moodle)

Erwartet wird der Ordner, den Moodle beim Herunterladen aller Abgaben erzeugt, mit einem Unterordner je Abgabe:

```
<Vorname Nachname>_<Moodle-ID>_assignsubmission_file
<Vorname Nachname>_<Moodle-ID>_assignsubmission_onlinetext
```

- Ein abschließender Unterstrich wird toleriert. Die Ordner `file` und `onlinetext` derselben Moodle-ID gehören zu
  einer Abgabe.
- Andere Ordnernamen werden als „nicht erkannt“ aufgelistet und übersprungen.
- ZIP-Dateien in einer Abgabe werden eine Ebene tief entpackt. Andere Archive (.rar, .7z, .tar, .gz …) werden
  gemeldet, aber nicht entpackt.
- Nicht kopiert werden: `.git`, `.svn`, `.idea`, `.vscode`, `.vs`, `__MACOSX`, `.DS_Store`, `node_modules`, `target`,
  `bin`, `obj`, `build`, `out`, `.gradle`, `__pycache__`, `*.class`, `*.pyc`.

## Quelle J;DE

J;DE-Abgaben werden direkt vom J;DE-Server geholt. Der Ablauf ist derselbe wie bei Moodle (Pseudonyme, Namen ersetzen,
Prüfung vor dem Start, ein Lauf, Prüfen, Speichern), mit diesen Unterschieden:

### Verbindung (Einstellungen)

In den Einstellungen unter „J;DE“ stehen **Adresse** des Servers (muss mit `https://` beginnen; nur für den eigenen
Rechner ist `http://localhost` erlaubt) und der **API-Schlüssel** (`jide_…`). Den Schlüssel erstellt die Lehrperson in der
J;DE-Lehrer-Webapp unter „API-Schlüssel“; er wird dort nur einmal angezeigt und gilt für alle Kurse der Lehrperson.

- „Verbindung testen“ probiert die eingegebenen Werte aus (ohne zu speichern) und nennt die Zahl der sichtbaren Kurse.
  Bleibt das Schlüsselfeld leer, wird der gespeicherte Schlüssel verwendet.
- Der Schlüssel wird mit dem Schlüsselbund des Betriebssystems verschlüsselt in der Datenbank gespeichert (wie die
  Zugangsdaten der Plugins), nie angezeigt und nie protokolliert. Bietet das System keine sichere Ablage, wird er nicht
  gespeichert. Nach einer Wiederherstellung der Datenbank auf einem anderen Rechner ist der Schlüssel neu einzugeben.
- „Verbindung entfernen“ löscht Adresse und Schlüssel; die Verknüpfungen bleiben erhalten.

### Verknüpfungen

Grader-Kurs und J;DE-Kurs sowie Schüler/innen und J;DE-Personen werden **einmal** verknüpft und danach bei jedem Lauf
wiederverwendet. Die Verknüpfung steht in der Einrichtung von Gradeflow, sobald die Quelle „J;DE“ gewählt ist
(„J;DE-Verknüpfung“):

- Vorgeschlagen wird anhand der Namen (Groß-/Kleinschreibung, Umlaute und Reihenfolge von Vor- und Nachname spielen keine
  Rolle) und für den Kurs anhand der Klasse. Es wird nur vorgeschlagen, wenn der Treffer eindeutig ist.
- Vorschläge gelten erst nach „Verknüpfung speichern“. Jede Zuordnung lässt sich ändern oder entfernen; dieselbe
  J;DE-Person kann nicht zwei Schüler/innen zugeordnet werden.
- Die Verknüpfungen liegen in der Datenbank von Grader (Migration 016) und werden mit dem Kurs bzw. der Schülerin oder dem
  Schüler gelöscht.

### Einrichtung und Zuordnung

- **Leistung:** Zur Wahl stehen nur Spalten mit Symbolen, denn J;DE bewertet mit `+`, `+~`, `~`, `−~`, `−`.
- **J;DE-Aufgabe:** Eine durchsuchbare Liste der freigeschalteten Aufgaben des verknüpften J;DE-Kurses (Titel und Kennung).
- Es gibt keine Aufgabenstellung, keinen Abgabenordner und keine Musterlösung zu wählen: Grader holt das **Aufgabenpaket** von
  J;DE (`aufgabe.md`, Vorlagedateien, `tests.yaml`, `exercise.yaml`) und legt es als `assignment/` in den Arbeitsbereich,
  wie einen Aufgabenordner (also unverändert und nicht anonymisiert; `.claude/`, `CLAUDE.md` und Build-Ordner werden nicht
  übernommen).
- Geholt wird die **letzte Abgabe jeder Person**. Wer nicht abgegeben hat, fehlt einfach.
- Die **Zuordnung** läuft über die gespeicherten Verknüpfungen, nicht über Namen. Abgaben von J;DE-Personen ohne
  Verknüpfung stehen als „nicht verknüpft“ in der Liste und werden übersprungen (wie nicht erkannte Moodle-Ordner). Die
  Zuordnung lässt sich hier nicht von Hand ändern; sie wird in der Verknüpfung korrigiert.
- Pseudonyme, Namen ersetzen (auch in Dateinamen), Dateiregeln (übersprungene Ordner, Größen) und die Prüfung vor dem
  Start gelten wie bei Moodle.

### Prüfen

Das Skill `java-jide` liefert pro Abgabe die Beurteilung, einen **Gesamtkommentar** und **Zeilenkommentare** (Datei, Zeile,
Text). Die Kommentare sprechen die Schülerin bzw. den Schüler mit „du“ an, denn sie lesen sie direkt in J;DE; Namen und
Kürzel bleiben verboten und werden entfernt (die Zeile wird markiert).

- Pro Schüler/in zeigt die Tabelle wie bisher Vorschlag, bisheriges Ergebnis und Gesamtkommentar. Unter „Code und
  Zeilenkommentare“ steht der Code der Abgabe (im Original, nicht anonymisiert; die Namen werden nur für die KI ersetzt)
  mit den Zeilenkommentaren an ihrer Zeile. Sie sind **editierbar und löschbar**; neue Zeilenkommentare lassen sich nicht
  hinzufügen.
- Zeilenkommentare auf Dateien oder Zeilen, die es nicht gibt, sowie leere werden verworfen; die Zeile ist dann markiert.
  Höchstens 200 Zeilenkommentare je Abgabe, je höchstens 1000 Zeichen; der Gesamtkommentar höchstens 2000 Zeichen.
- Angezeigt werden außerdem Abgabedatum, Verspätung, Testergebnis und ob J;DE die Abgabe schon bewertet hat (die Bewertung
  wird dann ersetzt).

### Speichern

Speichern führt zwei voneinander unabhängige Schritte aus, die getrennt gemeldet werden:

1. **In Grader:** Symbol in die gewählte Spalte, Gesamtkommentar als Notiz (ein erneuter Lauf ersetzt die Notiz). Vorher fragt
   Grader einmal, wie viele Ergebnisse ersetzt werden; solange nicht bestätigt ist, wird nichts gespeichert und nichts
   gesendet.
2. **An J;DE:** Symbol, Gesamtkommentar und Zeilenkommentare gehen je Abgabe an J;DE. Die Schüler/innen sehen die Bewertung
   sofort; eine erneute Bewertung ersetzt Beurteilung und Kommentare. Die Aufgabe ist für die Person danach gesperrt.

Schlägt ein Schritt fehl, geht nichts still verloren: Gespeichertes bleibt in Grader, und die Zeile zeigt, was nicht
gesendet wurde.

- **„neue Abgabe seit dem Laden“:** Hat die Person nach dem Laden erneut abgegeben, lehnt J;DE die Bewertung ab
  (`NEWER_HANDIN`). Die Zeile wird markiert und **nicht** an J;DE gesendet; das Ergebnis steht trotzdem in Grader. Um die neue
  Abgabe zu bewerten, ist Gradeflow erneut zu starten.
- **Andere Fehler** (Server nicht erreichbar, Aufgabe gesperrt …) zeigt die Zeile mit der Meldung von J;DE. Solche Zeilen
  bleiben angehakt; „Erneut speichern und senden“ sendet nur, was noch offen ist (ohne Rückfrage zum Ersetzen).
- Der Arbeitsbereich mit den Abgaben wird schon nach dem ersten Speichern gelöscht. „Fertig“ beendet die Prüfung, wenn nichts
  mehr zu wiederholen ist.

## Mitgelieferte Skills

| Skill | Inhalt |
|---|---|
| `java-einsteiger` | Java, milde Beurteilung: Lauffähigkeit, erfüllte Anforderungen, Kontrollstrukturen; Stil zählt nicht |
| `java-fortgeschritten` | Java: zusätzlich Struktur, Namenskonventionen, Randfälle, Ausnahmen, Collections |
| `java-profi` | Java, hoher Qualitätsanspruch: Clean Code, OOP-Design, Ausnahmebehandlung, try-with-resources; läuft mit Opus |
| `java-jide` | Java in J;DE, Einsteigerniveau wie `java-einsteiger`; Gesamtkommentar und Zeilenkommentare an die Schülerin bzw. den Schüler mit „du“, mit Hinweisen statt fertiger Lösungen |
| `sql-mysql` | SQL (mittleres Niveau), beurteilt gegen MySQL |
| `sql-mssql` | SQL (mittleres Niveau), beurteilt gegen Microsoft SQL Server (T-SQL) |
| `sql-postgresql` | SQL (mittleres Niveau), beurteilt gegen PostgreSQL |

Der SQL-Dialekt wird durch die Wahl des Skills bestimmt. Syntax, die auf dem gewählten DBMS fehlschlägt, zählt als
Fehler; Standard-SQL, das dort läuft, ist in Ordnung.

## Eigene Skills schreiben

Ein Skill ist ein Ordner mit einer Datei `SKILL.md`. Eigene Skills liegen im Benutzerdatenordner von Grader unter
`gradeflow/skills/<kennung>/SKILL.md` (z. B. `~/Library/Application Support/Grader/gradeflow/skills/` auf macOS,
`%APPDATA%\Grader\gradeflow\skills\` auf Windows). Der Ordnername ist die Kennung: Kleinbuchstaben, Ziffern und `-`,
höchstens 64 Zeichen. Ein eigener Skill mit der Kennung eines mitgelieferten ersetzt diesen. Fehlerhafte Skills werden
in der Auswahl mit dem Grund aufgeführt, ohne andere zu verdecken.

```
---
name: Python Einsteiger
description: Python, Einsteigerniveau: bewertet werden Lauffähigkeit und erfüllte Anforderungen.
model: opus
---

# Python Einsteiger

… Anweisungen an den Beurteilungs-Agenten …
```

| Feld | Bedeutung |
|---|---|
| `name` | Anzeigename in der Auswahl (Pflicht). |
| `description` | Eine Zeile: Niveau und was beurteilt wird (Pflicht). |
| `model` | Optional: `sonnet` (Standard) oder `opus`. |

Der Text nach dem Kopfbereich richtet sich an den Agenten. Sinnvoll sind: Maßstab (was zählt, was nicht), wie sich die
Stufen bzw. Punkte begründen, und der Umgang mit Sonderfällen (leere, themenfremde oder nicht lauffähige Abgaben,
Kopien der Musterlösung).

**Was Grader bereits vorgibt** und ein Skill nicht wiederholen muss:

- Das Ausgabeformat (JSON, erlaubte Symbole bzw. Punktebereich, genau ein Ergebnis je Abgabe) steht in
  `OUTPUT_SCHEMA.md` im Arbeitsbereich und wird als strukturierte Ausgabe erzwungen.
- Der Kommentarstil: Deutsch, unpersönlich (keine direkte Anrede wie „du“ oder „Sie“), kurze sachliche Aussagen über
  die Arbeit, zum Beispiel „Eingabeprüfung fehlt; Schleife endet einen Schritt zu früh.“ Namen und Kürzel sind
  verboten. **Bei Läufen mit der Quelle J;DE gilt stattdessen die Anrede mit „du“** (die Schüler/innen lesen die Kommentare
  selbst) samt Zeilenkommentaren; Namen und Kürzel bleiben auch dort verboten. Ein Skill darf bei J;DE-Läufen nichts anderes
  verlangen als `OUTPUT_SCHEMA.md`; `java-jide` verweist darauf.
- Der Arbeitsbereich: Aufgabenstellung, optional Musterlösung, `handins/<Kürzel>/`; der Agent darf nur dort lesen. Bei J;DE
  steht das Aufgabenpaket in `assignment/`, es gibt keine Musterlösung, und die Pfade der Zeilenkommentare sind relativ zu
  `handins/<Kürzel>/`.
  Eine Datei liegt als `ASSIGNMENT.<Endung>` bzw. `SOLUTION.<Endung>` im Arbeitsbereich, ein Ordner als
  `assignment/` bzw. `solution/`. Aus Ordnern werden `.claude/`, `CLAUDE.md` und `CLAUDE.local.md` (damit keine
  Einstellungen oder Anweisungen eingeschleust werden), Build- und Versionsverwaltungsordner (`.git`, `node_modules`,
  `build` …), Symlinks und Dateien über 2 MB nicht übernommen. Höchstens 2000 Dateien und 50 MB je Ordner; ist ein
  Ordner größer, bricht Grader die Vorbereitung ab.

Die mitgelieferten Skills wiederholen die Kommentarregeln trotzdem kurz; ein eigener Skill kann darauf verzichten.

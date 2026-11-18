# Gradeflow

Gradeflow beurteilt Abgaben (Hand-ins) einer Aufgabe mit Claude Code und schlägt für jede Schülerin und jeden Schüler
ein Ergebnis samt kurzem Kommentar vor. Gespeichert wird erst, nachdem die Lehrperson die Vorschläge geprüft hat:
Gradeflow trifft keine Entscheidung allein (DSGVO Art. 22).

Gestartet wird im Kurs über „Werkzeuge“ → „Gradeflow“. Die Leistung, die beurteilt wird, ist eine Spalte des Kurses
(Symbole oder Punkte).

## Ablauf

1. **Einrichten:** Leistung, Aufgabenstellung (Datei), Ordner mit den Abgaben, optional eine Musterlösung (Datei) und
   das Bewertungs-Skill wählen.
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
- **Isolierter Agent:** Claude Code läuft ohne MCP-Server und ohne Benutzereinstellungen und darf nur mit den
  Werkzeugen Read, Glob und Grep innerhalb des Arbeitsbereichs lesen. Code wird nie ausgeführt, Dateien werden nicht
  geschrieben.
- **Kommentare ohne Namen:** Anweisungen und Ausgabeformat verbieten Namen und Kürzel in Kommentaren; kommt trotzdem
  eines vor, wird es entfernt und die Zeile markiert.

Zur Beurteilung werden die (von Namen befreiten) Abgaben an Anthropic übertragen. Ob das an der eigenen Schule zulässig
ist, ist vorab zu klären.

## Voraussetzungen

- Eine Anmeldung bei Claude Code auf dem Rechner (`claude` einmal im Terminal starten und anmelden). OAuth-Anmeldungen
  laufen ab; schlägt ein Lauf wegen der Anmeldung fehl, ist sie zu erneuern.
- Moodle-Abgabeordner (siehe unten).

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

## Mitgelieferte Skills

| Skill | Inhalt |
|---|---|
| `java-einsteiger` | Java, milde Beurteilung: Lauffähigkeit, erfüllte Anforderungen, Kontrollstrukturen; Stil zählt nicht |
| `java-fortgeschritten` | Java: zusätzlich Struktur, Namenskonventionen, Randfälle, Ausnahmen, Collections |
| `java-profi` | Java, streng: Clean Code, OOP-Design, Ausnahmebehandlung, try-with-resources; läuft mit Opus |
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
  verboten.
- Der Arbeitsbereich: Aufgabenstellung, optional Musterlösung, `handins/<Kürzel>/`; der Agent darf nur dort lesen.

Die mitgelieferten Skills wiederholen die Kommentarregeln trotzdem kurz; ein eigener Skill kann darauf verzichten.

# Grader

Eine lokale Notenverwaltung für das österreichische Schulsystem. Grader unterstützt Lehrerinnen
und Lehrer bei der Leistungsbeurteilung gemäß der **Leistungsbeurteilungsverordnung (LBVO)** –
komplett offline, alle Daten bleiben auf dem eigenen Rechner.

## Funktionen

- **Schüler, Klassen und Kurse verwalten** – über mehrere Schuljahre hinweg, inklusive Zusatzinformationen
  pro Schüler und dem Klonen von Kursprofilen für ein neues Schuljahr.
- **Kurs-Workspace** – Sitzungen anlegen, Leistungen pro Schüler erfassen und Beurteilungsarten
  (z. B. „Mitarbeit", „Schularbeit") mit eigener Gewichtung konfigurieren.
- **Beurteilungslogik nach LBVO** – gewichtete, rezenzbasierte Berechnung der Gesamtnote je Kurs.
  Die berechnete Note dient als Orientierung; die Endnote wird von der Lehrperson manuell vergeben.
- **Berichte** – PDF-Berichte (Voll- oder Kurzversion), AsciiDoc-Ausgabe sowie CSV-Export.
- **Papierkorb** – Soft-Delete statt hartem Löschen: versehentlich gelöschte Einträge sind
  wiederherstellbar.
- **CSV-Import** – Schülerlisten lassen sich bequem aus CSV-Dateien importieren.
- **Kurs-Teilnehmer** – Wird eine Klasse in Gruppen geteilt, legt der Tab „Schüler“ fest, wen die Lehrperson im
  Kurs unterrichtet. Nicht ausgewählte Schüler verschwinden aus Beurteilung, Sitzungen, Schülerauswahl und
  Berichten; bereits erfasste Leistungen bleiben erhalten.
- **Schülerauswahl** – zufällige Auswahl per Farbrad mit Fair-Modus (wer am seltesten aufgerufen wurde,
  kommt zuerst), eigenen Schülerfarben, Aufrufzählern und direktem Eintragen der Mitarbeit (+ / ~ / −).
- **Schuljahreswechsel** – alle Klassen auf einmal ins neue Schuljahr übernehmen (z. B. 4EHIF → 5EHIF),
  Abgänger entfernen und auf Wunsch alle Kurse archivieren.
- **digigrade-Import** – Daten aus der Webanwendung digigrade (JSON-Export) übernehmen.
- **MCP-Server** – optionaler, lokaler Server, der KI-Agenten einen gelesenen Zugriff auf die
  Notendaten ermöglicht.

## Technologien

| Bereich | Technologie |
|---|---|
| Desktop-Framework | [Electron](https://www.electronjs.org/) |
| UI | [Vue 3](https://vuejs.org/), [Vue Router](https://router.vuejs.org/), [Vite](https://vitejs.dev/) |
| Sprache | TypeScript (strenger Modus) |
| Datenbank | SQLite ([better-sqlite3](https://github.com/WiseLibs/better-sqlite3)), lokal & offline |
| Berichte | [PDFKit](https://pdfkit.org/), AsciiDoc |
| Updates | electron-updater |

## Lokale Daten & Datenschutz

Grader ist eine **Local-First**-Anwendung: Alle Schüler-, Noten- und Kursdaten liegen ausschließlich
in einer lokalen SQLite-Datenbank auf Ihrem Rechner. Es gibt keine Konten, keine Cloud-Synchronisation
und keine Serverkommunikation (ausgenommen die optionale Update-Prüfung). Damit eignet sich Grader
auch für personenbezogene Schülerdaten ohne Abhängigkeit von Drittanbietern.

## Datenbank & Schuljahr

**Datenbank öffnen:** Unter *Datei → Datenbank öffnen…* (Cmd/Strg+O) oder in den Einstellungen lässt sich
eine vorhandene Datenbankdatei auswählen. Grader prüft die Datei, merkt sich den Pfad und startet neu.
„Neue Datenbank…“ in den Einstellungen legt an einem frei wählbaren Ort eine neue Datei an.
Die Reihenfolge, in der der Datenbankpfad ermittelt wird: Einstellungen (`settings.json`) →
`--db-path=…` → Umgebungsvariable `GRDR_DB_PATH` → Standardpfad im Benutzerdatenordner. Sobald in den
Einstellungen ein Pfad gespeichert ist, hat er Vorrang vor Kommandozeile und Umgebungsvariable.

**Empfohlener Ablauf zum Schuljahresbeginn:** Datenbankdatei des alten Jahres kopieren, die Kopie in Grader
öffnen und unter *Klassen → Schuljahreswechsel* die Klassen umbenennen bzw. Abgänger entfernen. Mit der
Option „Alle Kurse archivieren“ beginnt das neue Jahr ohne Kurse und Noten, die Schüler bleiben erhalten.
Das alte Jahr bleibt unverändert in der ursprünglichen Datei (z. B. für Einsprüche).

**Klassen löschen:** Eine gelöschte Klasse wandert samt ihrer Schüler und Kurse in den Papierkorb und wird
von dort auch gemeinsam wiederhergestellt.

## digigrade-Import

In digigrade unter *Mein Profil → Daten exportieren* eine JSON-Datei herunterladen und in Grader unter
*Klassen → digigrade-Import* (oder *Datei → digigrade-Import…*) auswählen. Der Import ergänzt vorhandene Daten:

- Klassen werden über Name und Schuljahr, Schüler über Name innerhalb der Klasse und Kurse über Titel
  innerhalb der Klasse zugeordnet. Bereits Vorhandenes wird nie überschrieben; ein vorhandener Kurs wird
  komplett übersprungen. Ein erneuter Import derselben Datei ändert daher nichts.
- Übernommen werden Klassen, Schüler (inkl. Farbe), Kurse mit Kategorien und Gewichtungen, Sitzungen,
  Leistungen, Notizen und Links, manuelle Noten sowie Aufrufzähler. Dezimale Gewichtungen werden gerundet.
- Dokumente (Dateien auf dem digigrade-Server) werden nicht übernommen.
- Der Import läuft in einer Transaktion: Bei einem Fehler bleibt die Datenbank unverändert.

## Entwicklung

### Voraussetzungen

- [Node.js](https://nodejs.org/) 20 oder neuer
- npm

### Erste Schritte

```bash
npm install     # installiert Abhängigkeiten (führt patch-package aus)
npm run dev     # baut und startet Grader im Entwicklungsmodus
```

Optional können Sie die Datenbank mit Beispieldaten füllen:

```bash
npm run seed
```

### Skripte

| Befehl | Beschreibung |
|---|---|
| `npm run dev` | Anwendung bauen und im Entwicklungsmodus starten |
| `npm run build` | TypeScript und Renderer bauen |
| `npm run start` | Gebauten Build starten |
| `npm test` | Unit- und Integrationstests (Jest) ausführen |
| `npm run test:watch` | Tests im Watch-Modus |
| `npm run test:e2e` | End-to-End-Tests (Playwright) |
| `npm run lint` | ESLint ausführen |
| `npm run typecheck` | TypeScript-Typen für Main- und Renderer-Prozess prüfen |
| `npm run package` | Installierbares Paket bauen (electron-builder) |
| `npm run build:win` | Windows-Installer (NSIS) via Docker bauen (kein Wine nötig) |
| `npm run deploy` | Versionierung und Veröffentlichung (siehe `scripts/deploy.sh`) |

### Tests

Das Projekt folgt Test-Driven-Development. Die Testsuite deckt ab:

- **Unit-Tests** für die Domänenlogik (Notenberechnung, Wertobjekte, Entitäten)
- **Integrationstests** für die Infrastruktur (SQLite-Repositories) und Anwendungsdienste
- **E2E-Tests** für zentrale Benutzerabläufe

## MCP-Server

Grader kann einen lokalen [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)-Server
starten, über den KI-Assistenten auf die Notendaten zugreifen können. Der Server ist standardmäßig
deaktiviert und wird über die Einstellungen aktiviert (Port konfigurierbar). Er läuft ausschließlich
lokal und gewährt schreibgeschützten Zugriff.

## Lizenz

[MIT](LICENSE.md) © 2026 Michael Freimüller

## Rechtlicher Hinweis

Grader unterstützt die Leistungsbeurteilung gemäß LBVO, ersetzt jedoch nicht die fachliche und
rechtliche Verantwortung der Lehrperson. Berechnete Noten sind als Orientierung zu verstehen; die
Endbeurteilung liegt in der Verantwortung der unterrichtenden Lehrperson.

# Plugins

Plugins sind kleine Web-Anwendungen (HTML, CSS, JavaScript), die Grader aus einem Kurs heraus in einem eigenen
Fenster startet. Sie lesen Daten des Kurses, speichern eigene Daten in der Grader-Datenbank und können spontane
Leistungen eintragen – alles über eine kleine, versionierte Schnittstelle (`window.grader`). Mehr dürfen sie nicht:
Sie laufen in einer Sandbox, ohne Zugriff auf Dateien oder die übrige Grader-Oberfläche; ins Netzwerk dürfen sie nur
zu Servern, die sie im Manifest nennen und die Sie beim Einschalten erlaubt haben.

Mitgeliefert wird die **Zufallsauswahl** (`plugins/studentpicker`), die zufällige Schülerauswahl am Spielautomaten oder
Glücksrad.

## Für Lehrpersonen

- **Starten:** im Kurs oben rechts auf „Werkzeuge“ klicken und das Plugin wählen.
- **Verwalten:** Einstellungen → Plugins. Dort steht, welche Plugins installiert sind, ob sie aktiv sind und – bei
  fehlerhaften – woran es liegt.
- **Eigene Plugins:** Ordner des Plugins in den Plugin-Ordner kopieren (Einstellungen → Plugins →
  „Plugin-Ordner öffnen“), dann „Neu laden“. Ein eigenes Plugin ist zunächst **ausgeschaltet**. Beim Einschalten
  zeigt Grader in Klartext, was das Plugin darf – auch, mit welchen Servern es sich verbindet („Verbindet sich mit
  api.github.com“); erst nach „Erlauben und einschalten“ läuft es. Verlangt eine neue Version des Plugins mehr
  Berechtigungen oder einen weiteren Server, fragt Grader erneut.
- **Mitgelieferte Plugins** sind eingeschaltet, lassen sich aber ausschalten. Ein eigenes Plugin mit derselben
  Kennung ersetzt die mitgelieferte Version (und beginnt dann ausgeschaltet).
- **Daten:** Was ein Plugin speichert, liegt in derselben Datenbankdatei wie alles andere und ist damit in jeder
  Sicherung enthalten. Es gehört zum Kurs: Kommt der Kurs in den Papierkorb und wieder heraus, ist es wieder da; wird
  er endgültig gelöscht, verschwindet es mit ihm.

## Aufbau eines Plugins

```
<Plugin-Ordner>/
  plugin.json
  index.html
  assets/…          (beliebige statische Dateien)
```

### plugin.json

```json
{
  "id": "at.example.mein-plugin",
  "name": "Mein Plugin",
  "version": "1.0.0",
  "description": "Kurze Beschreibung",
  "apiVersion": 1,
  "entry": "index.html",
  "launch": ["course"],
  "permissions": ["course:read", "storage", "assessment:impromptu", "secrets"],
  "network": ["https://api.github.com"],
  "window": { "width": 1000, "height": 700 }
}
```

| Feld | Bedeutung |
|---|---|
| `id` | Eindeutige Kennung in umgekehrter Domain-Schreibweise, nur Kleinbuchstaben, Ziffern, `.` und `-` (mindestens zwei Teile, höchstens 100 Zeichen). Sie ist zugleich der Name der Plugin-Adresse und der Schlüssel für die gespeicherten Daten. |
| `name`, `description` | Anzeige in den Einstellungen und im Menü „Werkzeuge“. |
| `version` | Semantische Version, z. B. `1.2.0`. |
| `apiVersion` | Version der Schnittstelle. Zurzeit `1`. Verlangt ein Plugin eine andere, zeigt Grader es als fehlerhaft an. |
| `entry` | Startseite, relativ zum Plugin-Ordner. Muss innerhalb des Ordners liegen (auch über Symlinks). |
| `launch` | Wo das Plugin gestartet werden kann. Zurzeit nur `course`. |
| `permissions` | Siehe unten. Unbekannte Berechtigungen machen das Plugin fehlerhaft. |
| `network` | Server, zu denen sich das Plugin verbinden darf (siehe „Netzwerk“). Standard: keine. |
| `window` | Optionale Fenstergröße (Breite 400–2400, Höhe 300–1600). |

Ein fehlerhaftes Plugin erscheint in den Einstellungen mit der Fehlermeldung; die übrigen Plugins sind nicht betroffen.

### Berechtigungen

| Berechtigung | Erlaubt | Text für die Lehrperson |
|---|---|---|
| `course:read` | `context()` | Kurs, Klasse und Namen der anwesenden Schüler/innen lesen |
| `storage` | `storage.*` | Eigene Daten in der Grader-Datenbank speichern |
| `assessment:impromptu` | `assessment.*` | Spontane Beurteilungen anlegen und eigene wieder löschen |
| `secrets` | `secrets.*` | Zugangsdaten (z. B. ein Zugriffstoken) verschlüsselt auf diesem Computer speichern |

Die Berechtigung `course:read` liefert Kurs, Klasse und Namen der Schüler/innen des Kurses (`students`: die
anwesenden, `courseStudents`: alle).

### Netzwerk

`network` ist eine Liste von Ursprüngen der Form `https://<host>[:port]`, zum Beispiel `https://api.github.com`.
Erlaubt ist nur das: kein Pfad, kein Platzhalter (`*`), kein `http`, keine IP-Adresse und kein `localhost`. Grader
schreibt die Einträge klein, entfernt den Standardport 443 und doppelte Einträge; höchstens 10 sind erlaubt, sonst ist
das Plugin fehlerhaft.

- Das Plugin ruft die Server mit dem normalen `fetch` seiner Seite auf (auch mit `Authorization`-Kopfzeile). Die
  Content-Security-Policy erlaubt `connect-src` genau für die Adresse des Plugins und die erlaubten Ursprünge; jede
  andere Anfrage wird abgebrochen. Schema, Host und Port müssen exakt übereinstimmen (`api.github.com` erlaubt weder
  Unter-Domains noch `http` noch einen anderen Port).
- Erlaubt ist, was das Manifest nennt **und** was die Lehrperson beim Einschalten akzeptiert hat. Ein von Hand
  ergänztes Feld in `settings.json` weitet das nicht aus; eine neue Version mit einem weiteren Server fragt erneut.
- Mitgelieferte Plugins sind Teil von Grader und bekommen ihre Server ohne Rückfrage.

## Die Schnittstelle `window.grader`

Alle Aufrufe sind asynchron und antworten mit `{ ok: true, value }` oder
`{ ok: false, error: { code, message } }`. Fehlercodes: `PERMISSION_DENIED`, `NOT_FOUND`, `VALIDATION`,
`NOT_IN_COURSE`, `INTERNAL`. Die Typen stehen in `src/shared/plugin-api.ts`.

Welches Plugin aufruft und zu welchem Kurs es gehört, weiß Grader vom Fenster – ein Plugin gibt weder seine Kennung
noch eine Kurs-Id an, und eine mitgeschickte wird ignoriert.

### `context()`

Liefert, was das Plugin über den Kurs wissen darf:

```ts
{
  apiVersion: 1,
  plugin: { id, version },
  course: { id, title },
  schoolClass: { id, name },
  schoolYear: '2026/27',
  today: '2026-10-12',          // lokaler Kalendertag
  students: [{ id, firstName, lastName, color }],   // nur die ANWESENDEN Schüler/innen
  courseStudents: [{ id, firstName, lastName, color }],   // ALLE im Kurs unterrichteten Schüler/innen
  categories: [{ id, title, gradingType, isMitarbeit, isHidden }],
  sessions: [{ id, date, notes }]                   // neueste zuerst
}
```

`students` enthält die im Kurs unterrichteten Schüler/innen ohne diejenigen, die in der heutigen Sitzung als
abwesend markiert sind (gibt es heute keine Sitzung, alle). `courseStudents` enthält dagegen alle im Kurs
unterrichteten Schüler/innen, ob heute anwesend oder nicht – gedacht für Plugins, die etwas über den ganzen Kurs
auswerten, z. B. Teamprojekte. Reihenfolge und Form sind in beiden Listen gleich. Der Aufruf liest jedes Mal neu; ein Plugin sollte ihn
wiederholen, wenn sein Fenster wieder den Fokus bekommt.

### `storage`

Ein einfacher Schlüssel-Wert-Speicher pro Plugin. `storage.get/set/delete/keys` gelten für den **Kurs**, in dem das
Plugin gestartet wurde; `storage.global.*` gilt für das Plugin über alle Kurse hinweg.

```ts
await grader.storage.set('pickCounts', { 'student-1': 2 });
const counts = (await grader.storage.get('pickCounts')).value;   // null, wenn nichts gespeichert ist
await grader.storage.keys('pick');                               // Schlüssel mit diesem Präfix
```

- Schlüssel: 1–128 Zeichen aus `A-Z a-z 0-9 _ . : -`.
- Werte: alles, was sich als JSON darstellen lässt, höchstens 256 KiB. `undefined` und Funktionen werden abgelehnt.
- Ein Plugin sieht nur seine eigenen Daten. Gespeichert wird in der Tabelle `plugin_data`
  (`plugin_id`, `course_id`, `key`, `value`); `course_id` ist leer für `storage.global`.
- Vue-Objekte und andere Proxies lassen sich nicht übertragen – vor dem Speichern eine einfache Kopie anlegen.

### `secrets`

Für Zugangsdaten wie ein GitHub-Token; braucht die Berechtigung `secrets`. Die Werte gelten für das **Plugin**, nicht
für einen Kurs.

```ts
await grader.secrets.set('github-token', 'ghp_…');      // nicht-leerer Text, höchstens 16 KiB
const token = (await grader.secrets.get('github-token')).value;   // null, wenn nichts gespeichert ist
await grader.secrets.delete('github-token');
```

- Schlüssel wie bei `storage`: 1–128 Zeichen aus `A-Z a-z 0-9 _ . : -`.
- Gespeichert wird verschlüsselt mit dem Schlüsselbund des Betriebssystems (Electron `safeStorage`) in der Tabelle
  `plugin_secrets` (`plugin_id`, `key`, `value` als BLOB). Kann das System nicht verschlüsseln, lehnt `set` mit
  `VALIDATION` ab – Grader legt nie Klartext ab.
- **Sicherung:** Die Tabelle gehört zur Datenbankdatei und ist damit in jeder Sicherung enthalten, die verschlüsselten
  Werte lassen sich aber nur auf demselben Computer und mit demselben Benutzerkonto lesen. Wird eine Sicherung auf einem
  anderen Computer wiederhergestellt, antwortet `get` mit `VALIDATION` („kann auf diesem Computer nicht gelesen
  werden“); das Plugin muss das Geheimnis dann neu setzen lassen.
- Ein Plugin sieht nur seine eigenen Geheimnisse; sie erscheinen nie in einer Antwort an Grader oder in Protokollen.

### `assessment`

```ts
const result = await grader.assessment.createImpromptu({
  studentId: 'student-1',
  categoryId: 'category-1',
  symbol: 'PLUS',                         // PLUS | WELLE | MINUS
  title: 'Mitarbeit',                     // optional, Standard: Titel der Kategorie
  session: { kind: 'today' },             // optional
});
// result.value: { assessmentId, performanceId, sessionId }

await grader.assessment.deleteImpromptu(result.value.assessmentId);
```

`session` bestimmt, in welche Sitzung die Leistung kommt. Gibt es sie noch nicht, legt Grader sie an:

| `session` | Bedeutung |
|---|---|
| `{ kind: 'today' }` (Standard) | die Sitzung von heute |
| `{ kind: 'date', date: '2026-09-30' }` | die Sitzung an einem früheren Tag; Zukunft wird abgelehnt |
| `{ kind: 'session', sessionId }` | eine vorhandene Sitzung dieses Kurses, z. B. aus `context().sessions` |

Statt eines Symbols lassen sich Punkte eintragen: `score` und `maxPoints` (beide ganze Zahlen, `0 ≤ score ≤ maxPoints`).

Grader prüft vor dem Anlegen, ob Person und Kategorie zum Kurs gehören und ob die Werte stimmen; bei einer
Ablehnung entsteht nichts – auch keine leere Sitzung. Löschen kann ein Plugin nur Leistungen, die es selbst in
diesem Kurs angelegt hat.

Nach jeder erfolgreichen Änderung lädt der geöffnete Kurs in Grader seine Daten neu.

## Sicherheit

- Jedes Plugin läuft in einem Fenster mit `sandbox`, `contextIsolation` und ohne Node.js, auf einer eigenen Adresse
  `grdr-plugin://<id>/` und mit eigenem Speicherbereich. Es sieht weder `window.grdr` noch andere Plugins.
- Die Content-Security-Policy erlaubt nur Dateien der eigenen Adresse und Verbindungen zur eigenen Adresse und zu den
  erlaubten `network`-Ursprüngen. Es gibt **keine** Inline-Skripte und kein `eval`; das Plugin muss seine Skripte als
  Dateien ausliefern. Jedes andere Netzwerkziel, `file://` und Navigation weg vom Plugin sind gesperrt, ebenso Kamera,
  Mikrofon und andere Geräteberechtigungen.
- Dateien werden nur aus dem Plugin-Ordner ausgeliefert; Pfade, die ihn verlassen (auch über Symlinks oder
  kodierte Trennzeichen), ergeben 404.
- Alles, was ein Plugin sendet, wird geprüft; unerwartete Fehler erscheinen für das Plugin nur als „Internal error“.

Ein Plugin mit `assessment:impromptu` kann Noten verändern, eines mit `course:read` und `network` Schülernamen an die
erlaubten Server senden. Eigene Plugins daher nur aus Quellen einschalten, denen Sie vertrauen.

## Ein Plugin entwickeln

Ein Plugin ist eine statische Web-Seite. Ein Minimalbeispiel:

```html
<!-- index.html -->
<!doctype html>
<meta charset="utf-8">
<title>Hallo</title>
<pre id="out"></pre>
<script src="hallo.js"></script>
```

```js
// hallo.js
(async () => {
  const context = (await window.grader.context()).value;
  document.getElementById('out').textContent = `${context.course.title}: ${context.students.length} anwesend`;
})();
```

Dazu eine `plugin.json` (siehe oben) in einen Ordner im Plugin-Ordner legen, in den Einstellungen „Neu laden“ und
das Plugin einschalten. Für größere Plugins eignet sich jeder Bundler; wichtig sind relative URLs (`base: './'`)
und Skripte als eigene Dateien.

`tests/fixtures/plugins/echo` ist ein Plugin, das jede Schnittstellenfunktion aufruft und seine Sandbox prüft; es ist
die Grundlage der End-to-End-Tests in `tests/e2e/plugins.test.ts`.

## Die Zufallsauswahl

Quelltext: `plugins/studentpicker` (Vue 3). `npm run build:plugins` baut es nach `build/plugins/at.mfreimueller.studentpicker/`;
`npm run build` tut das mit. Beim Paketieren landet es als `plugins/` neben der Anwendung.

Jeder Kurs wählt oben unter „Aussehen“, ob die Schüler am Spielautomaten oder am Glücksrad gezogen werden; wer
gewinnt, entscheidet in beiden Fällen dieselbe Logik. Endet ein Dreh auf einem Schüler, regnet es Konfetti (nicht,
wenn das System weniger Bewegung wünscht).

Es speichert im Kurs drei Schlüssel: `pickCounts` (Aufrufe pro Schüler), `specials` (Spezialfelder wie „Nochmal
drehen“) und `skin` (`slotmachine` oder `wheel`). Ein Aufruf mit `+`, `~` oder `−` wird als spontane Leistung „Mitarbeit“ in der Sitzung von heute eingetragen.

## Noch nicht möglich

Das Schreiben von Anwesenheit und Ereignisse von Grader an das Plugin. Die Schnittstelle ist so angelegt, dass sich das
später ergänzen lässt. Netzwerk, `secrets` und `courseStudents` sind additive Erweiterungen der Schnittstelle Version 1;
ältere Plugins laufen unverändert weiter.

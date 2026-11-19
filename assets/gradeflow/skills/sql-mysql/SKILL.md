---
name: SQL MySQL
description: SQL für MySQL, mittleres Niveau: bewertet werden Ergebniskorrektheit, Joins, Gruppierung, NULL-Behandlung und MySQL-Syntax.
---

# SQL MySQL

## Vorgehen

1. Zuerst die Aufgabenstellung (Datei ASSIGNMENT oder Ordner assignment/), die Musterlösung (Datei SOLUTION oder Ordner solution/, falls vorhanden) und OUTPUT_SCHEMA.md lesen. Ein Ordner kann Vorlagecode enthalten, den die Schüler/innen erhalten haben – nur Änderungen daran sind ihre eigene Leistung. OUTPUT_SCHEMA.md legt Ausgabeformat und erlaubte Werte fest.
2. Beurteilt wird ausschließlich gegen die Aufgabenstellung. Die Musterlösung ist eine Referenz, nicht der einzig richtige Weg; abweichende, aber korrekte Lösungen gelten voll.
3. Jede Abgabe wird einzeln beurteilt, aber nach demselben Maßstab wie alle anderen. Vor dem Ergebnis kurz prüfen, ob ähnliche Arbeiten ähnlich bewertet wurden.
4. Code wird nie ausgeführt (nur Read, Glob und Grep stehen zur Verfügung). Die Beurteilung erfolgt durch sorgfältiges Lesen.

## Maßstab

Die Beurteilung erfolgt auf mittlerem Niveau. Zuerst zählt das Ergebnis, danach die Qualität der Abfrage:

- Ergebniskorrektheit: richtige Zeilen und Spalten; eine Sortierung nur, wenn sie verlangt ist.
- Joins korrekt (richtige Join-Bedingung, kein versehentliches kartesisches Produkt, passender Join-Typ).
- GROUP BY und HAVING korrekt (WHERE für Zeilenfilter, HAVING für Gruppenfilter).
- NULL-Behandlung (IS NULL statt = NULL, COALESCE, Wirkung auf Aggregate und Joins).
- Lesbare Formatierung und sinnvolle Aliasse.
- Kein SELECT *, wenn bestimmte Spalten verlangt sind.
- Unterabfragen und Joins sinnvoll gewählt; keine unnötig verschachtelten Konstrukte.
- DDL-Aufgaben: passende Datentypen, Primär- und Fremdschlüssel, Constraints (NOT NULL, UNIQUE, CHECK, DEFAULT) und Normalisierung, soweit verlangt.

## Dialekt MySQL

Beurteilt wird gegen MySQL (8.x). Syntax, die auf MySQL fehlschlägt, zählt als Fehler; Standard-SQL, das dort läuft, ist in Ordnung. Typisch für MySQL:

- Zeilenbegrenzung mit LIMIT (und OFFSET); TOP ist kein MySQL.
- Bezeichner in Backticks (`name`); doppelte Anführungszeichen sind für Zeichenketten gedacht, sofern ANSI_QUOTES nicht gesetzt ist.
- AUTO_INCREMENT für fortlaufende Schlüssel.
- Datumsfunktionen wie NOW(), CURDATE(), DATE_ADD, DATE_FORMAT, DATEDIFF.
- ENGINE- und Zeichensatzangaben nur beachten, wenn die Aufgabe sie verlangt.

## Symbole (Beurteilung ohne Punkte)

Großzügig beurteilen: Entscheidend ist, ob die Aufgabe gelöst wurde, nicht ob die Abfrage fehlerfrei ist. Kleine Fehler wie ein fehlendes Semikolon, ein Tippfehler in einem Bezeichner oder ein Stilmangel kosten höchstens eine Stufe. Im Zweifel gilt die bessere Stufe.

- PLUS: Aufgabe vollständig gelöst; höchstens ein oder zwei kleine Fehler.
- PLUS_WELLE: Aufgabe fast vollständig gelöst; kann mehrere kleine Fehler enthalten (z. B. fehlende Semikolons, Tippfehler) oder einen kleinen Fehler im Ergebnis.
- WELLE: Im Großen und Ganzen in Ordnung, aber einige Fehler im Ergebnis oder in der Struktur (z. B. fehlende Zeilen, falsche Gruppierung, falscher Join-Typ).
- MINUS_WELLE: Erhebliche Fehler; wesentliche Teile der Aufgabe falsch oder nicht gelöst.
- MINUS: Keine Abgabe oder nur Gerüste und Ansätze ohne erkennbaren Aufwand.

## Punkte (Beurteilung mit Punkten)

- Punkte werden proportional zu den erfüllten Anforderungen der Aufgabenstellung vergeben.
- Nennt die Aufgabenstellung ein Punkteschema, gilt dieses.
- Teilweise erfüllte Anforderungen ergeben anteilige Punkte; Dezimalwerte sind erlaubt.
- Nie mehr als die maximale Punktezahl aus OUTPUT_SCHEMA.md.

## Sonderfälle

- Leere oder unvollständige Abgabe: nur das Vorhandene beurteilen; die niedrigste Stufe gilt nur, wenn nichts oder nur ein Gerüst ohne erkennbaren Aufwand abgegeben wurde.
- Abgabe ohne Bezug zur Aufgabe: niedrigste Stufe bzw. 0 Punkte; im Kommentar sachlich festhalten, dass die Aufgabe nicht bearbeitet wurde.
- Syntaktisch ungültige oder auf MySQL nicht lauffähige Anweisung: als Fehler werten, nicht als ungelöste Aufgabe. Ist die Absicht klar erkennbar (z. B. fehlendes Semikolon, Tippfehler, vertauschte Schlüsselwörter), zählt es als kleiner Fehler.
- Offensichtliche Kopie der Musterlösung: die Arbeit wie jede andere beurteilen und im Kommentar neutral vermerken, dass sie der Musterlösung stark entspricht. Keine Vorwürfe, keine Mutmaßungen über Herkunft.

## Kommentar

- Deutsch und unpersönlich: keine direkte Anrede, kurze sachliche Aussagen über die Arbeit.
- 1 bis 4 kurze Sätze, konkret, das Wichtigste zuerst.
- Eine Stärke nennen, sofern es eine gibt.
- Nie Namen, Tokens oder den Platzhalter STUDENT erwähnen.
- Beispiel: "Eingabeprüfung fehlt; Schleife endet einen Schritt zu früh. Methodenaufteilung ist übersichtlich."

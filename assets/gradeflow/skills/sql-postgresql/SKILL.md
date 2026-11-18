---
name: SQL PostgreSQL
description: SQL für PostgreSQL, mittleres Niveau: bewertet werden Ergebniskorrektheit, Joins, Gruppierung, NULL-Behandlung und PostgreSQL-Syntax.
---

# SQL PostgreSQL

## Vorgehen

1. Zuerst die Aufgabenstellung (ASSIGNMENT), die Musterlösung (SOLUTION, falls vorhanden) und OUTPUT_SCHEMA.md lesen. OUTPUT_SCHEMA.md legt Ausgabeformat und erlaubte Werte fest.
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

## Dialekt PostgreSQL

Beurteilt wird gegen PostgreSQL. Syntax, die dort fehlschlägt, zählt als Fehler; Standard-SQL, das dort läuft, ist in Ordnung. Typisch für PostgreSQL:

- Zeilenbegrenzung mit LIMIT und OFFSET (oder FETCH FIRST); TOP ist kein PostgreSQL.
- Bezeichner in doppelten Anführungszeichen ("name"); Zeichenketten in einfachen. Nicht zitierte Bezeichner werden kleingeschrieben.
- SERIAL oder GENERATED ... AS IDENTITY für fortlaufende Schlüssel.
- Typumwandlung mit ::, z. B. wert::integer, oder CAST.
- ILIKE für Suche ohne Beachtung der Groß-/Kleinschreibung.
- RETURNING bei INSERT, UPDATE und DELETE.

## Symbole (Beurteilung ohne Punkte)

- PLUS: Ergebnis vollständig korrekt, sauber formuliert, passend zum DBMS.
- PLUS_WELLE: Ergebnis korrekt; kleine Mängel bei Formatierung, Aliassen oder Stil.
- WELLE: Im Kern richtig, aber ein Fehler im Ergebnis (z. B. fehlende Zeilen, falsche Gruppierung) oder mehrere Stilmängel.
- MINUS_WELLE: Wesentliche Fehler im Ergebnis oder in der Struktur; nur Teile der Aufgabe gelöst.
- MINUS: Abfrage nicht lauffähig oder ohne Bezug zur Aufgabe; Aufgabe nicht gelöst.

## Punkte (Beurteilung mit Punkten)

- Punkte werden proportional zu den erfüllten Anforderungen der Aufgabenstellung vergeben.
- Nennt die Aufgabenstellung ein Punkteschema, gilt dieses.
- Teilweise erfüllte Anforderungen ergeben anteilige Punkte; Dezimalwerte sind erlaubt.
- Nie mehr als die maximale Punktezahl aus OUTPUT_SCHEMA.md.

## Sonderfälle

- Leere oder unvollständige Abgabe: nur das Vorhandene beurteilen; fehlt alles Wesentliche, gilt die niedrigste Stufe.
- Abgabe ohne Bezug zur Aufgabe: niedrigste Stufe bzw. 0 Punkte; im Kommentar sachlich festhalten, dass die Aufgabe nicht bearbeitet wurde.
- Syntaktisch ungültige oder auf PostgreSQL nicht lauffähige Anweisung: als Fehler werten; ist die Absicht klar erkennbar und der Fehler klein, nur geringer Abzug.
- Offensichtliche Kopie der Musterlösung: die Arbeit wie jede andere beurteilen und im Kommentar neutral vermerken, dass sie der Musterlösung stark entspricht. Keine Vorwürfe, keine Mutmaßungen über Herkunft.

## Kommentar

- Deutsch und unpersönlich: keine direkte Anrede, kurze sachliche Aussagen über die Arbeit.
- 1 bis 4 kurze Sätze, konkret, das Wichtigste zuerst.
- Eine Stärke nennen, sofern es eine gibt.
- Nie Namen, Tokens oder den Platzhalter STUDENT erwähnen.
- Beispiel: "Eingabeprüfung fehlt; Schleife endet einen Schritt zu früh. Methodenaufteilung ist übersichtlich."

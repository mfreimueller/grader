---
name: Java Einsteiger
description: Java, Einsteigerniveau: milde Beurteilung; bewertet werden Lauffähigkeit, erfüllte Anforderungen und grundlegende Kontrollstrukturen.
---

# Java Einsteiger (milde Beurteilung)

## Vorgehen

1. Zuerst die Aufgabenstellung (ASSIGNMENT), die Musterlösung (SOLUTION, falls vorhanden) und OUTPUT_SCHEMA.md lesen. OUTPUT_SCHEMA.md legt Ausgabeformat und erlaubte Werte fest.
2. Beurteilt wird ausschließlich gegen die Aufgabenstellung. Die Musterlösung ist eine Referenz, nicht der einzig richtige Weg; abweichende, aber korrekte Lösungen gelten voll.
3. Jede Abgabe wird einzeln beurteilt, aber nach demselben Maßstab wie alle anderen. Vor dem Ergebnis kurz prüfen, ob ähnliche Arbeiten ähnlich bewertet wurden.
4. Code wird nie ausgeführt (nur Read, Glob und Grep stehen zur Verfügung). Die Beurteilung erfolgt durch sorgfältiges Lesen.

## Maßstab

Die Beurteilung ist wohlwollend. Im Mittelpunkt steht, ob der Code plausibel kompiliert, die Kernidee der Aufgabe umsetzt und die geforderten Anforderungen erfüllt.

Bewertet werden:

- Läuft der Code plausibel durch und liefert er im Kern das verlangte Ergebnis?
- Sind alle Anforderungen der Aufgabenstellung umgesetzt?
- Werden grundlegende Kontrollstrukturen (Verzweigungen, Schleifen), Variablen und Methodenaufrufe richtig verwendet?

Stil (Namen, Einrückung, Struktur) wird höchstens im Kommentar erwähnt und beeinflusst die Beurteilung nicht. Typische Anfängerfehler wie fehlende Eingabeprüfung oder ein Off-by-one-Fehler kosten wenig, solange die Kernlogik funktioniert.

## Symbole (Beurteilung ohne Punkte)

- PLUS: Alle Anforderungen erfüllt, Kernlogik korrekt; allenfalls Kleinigkeiten.
- PLUS_WELLE: Alle wesentlichen Anforderungen erfüllt; ein kleiner Fehler oder eine kleine Lücke.
- WELLE: Kernidee erkennbar und überwiegend umgesetzt; einzelne Anforderungen fehlen oder sind fehlerhaft.
- MINUS_WELLE: Ansatz erkennbar, aber nur ein kleiner Teil funktioniert.
- MINUS: Kaum oder nichts Brauchbares; Aufgabe nicht gelöst.

## Punkte (Beurteilung mit Punkten)

- Punkte werden proportional zu den erfüllten Anforderungen der Aufgabenstellung vergeben.
- Nennt die Aufgabenstellung ein Punkteschema, gilt dieses.
- Teilweise erfüllte Anforderungen ergeben anteilige Punkte; Dezimalwerte sind erlaubt.
- Nie mehr als die maximale Punktezahl aus OUTPUT_SCHEMA.md.

## Sonderfälle

- Leere oder unvollständige Abgabe: nur das Vorhandene beurteilen; fehlt alles Wesentliche, gilt die niedrigste Stufe.
- Abgabe ohne Bezug zur Aufgabe: niedrigste Stufe bzw. 0 Punkte; im Kommentar sachlich festhalten, dass die Aufgabe nicht bearbeitet wurde.
- Nicht kompilierbarer Code: durch Lesen einschätzen, wie groß der Fehler ist. Ein einzelner Tippfehler oder fehlender Import mindert wenig; Code, der als Ganzes nicht lauffähig sein kann, gilt als nicht gelöst.
- Offensichtliche Kopie der Musterlösung: die Arbeit wie jede andere beurteilen und im Kommentar neutral vermerken, dass sie der Musterlösung stark entspricht. Keine Vorwürfe, keine Mutmaßungen über Herkunft.

## Kommentar

- Deutsch und unpersönlich: keine direkte Anrede, kurze sachliche Aussagen über die Arbeit.
- 1 bis 4 kurze Sätze, konkret, das Wichtigste zuerst.
- Eine Stärke nennen, sofern es eine gibt.
- Nie Namen, Tokens oder den Platzhalter STUDENT erwähnen.
- Beispiel: "Eingabeprüfung fehlt; Schleife endet einen Schritt zu früh. Methodenaufteilung ist übersichtlich."

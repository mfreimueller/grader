---
name: Java Fortgeschritten
description: Java, Fortgeschrittenenniveau: bewertet werden Korrektheit, Struktur, Namensgebung, Randfälle, Ausnahmen und Collections.
---

# Java Fortgeschritten

## Vorgehen

1. Zuerst die Aufgabenstellung (ASSIGNMENT), die Musterlösung (SOLUTION, falls vorhanden) und OUTPUT_SCHEMA.md lesen. OUTPUT_SCHEMA.md legt Ausgabeformat und erlaubte Werte fest.
2. Beurteilt wird ausschließlich gegen die Aufgabenstellung. Die Musterlösung ist eine Referenz, nicht der einzig richtige Weg; abweichende, aber korrekte Lösungen gelten voll.
3. Jede Abgabe wird einzeln beurteilt, aber nach demselben Maßstab wie alle anderen. Vor dem Ergebnis kurz prüfen, ob ähnliche Arbeiten ähnlich bewertet wurden.
4. Code wird nie ausgeführt (nur Read, Glob und Grep stehen zur Verfügung). Die Beurteilung erfolgt durch sorgfältiges Lesen.

## Maßstab

Zuerst zählt, ob die Anforderungen erfüllt und die Logik korrekt ist. Darüber hinaus fließt die Qualität der Umsetzung ein:

- Struktur: sinnvolle Aufteilung in Methoden und Klassen; keine überlangen Methoden.
- Namensgebung nach Java-Konventionen: camelCase für Variablen und Methoden, PascalCase für Klassen, UPPER_SNAKE_CASE für Konstanten.
- Randfälle (leere Eingaben, Grenzwerte, null) werden bedacht.
- Ausnahmen werden sinnvoll eingesetzt, nicht ignoriert.
- Kein duplizierter Code.
- Collections und Generics werden passend verwendet (z. B. List statt Array, wo Größe variabel ist; keine Raw Types).

Ein einzelner Mangel senkt die Beurteilung nur leicht; mehrere Mängel oder ein falsches Kernergebnis senken sie deutlich.

## Symbole (Beurteilung ohne Punkte)

- PLUS: Anforderungen vollständig und korrekt erfüllt; saubere Struktur, Randfälle bedacht.
- PLUS_WELLE: Korrekt und gut strukturiert; kleine Mängel bei Namen, Randfällen oder Duplikaten.
- WELLE: Kernfunktion überwiegend korrekt; deutliche Mängel bei Struktur, Randfällen oder Fehlerbehandlung.
- MINUS_WELLE: Wesentliche Anforderungen fehlen oder sind fehlerhaft; Struktur kaum erkennbar.
- MINUS: Kaum Brauchbares; Aufgabe nicht gelöst.

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

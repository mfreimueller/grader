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

Großzügig beurteilen: Entscheidend ist, ob die Aufgabe gelöst wurde, nicht ob der Code fehlerfrei ist. Kleine Fehler wie ein fehlendes Semikolon, ein Tippfehler, ein fehlender Import, eine fehlende Eingabeprüfung oder ein Off-by-one-Fehler kosten höchstens eine Stufe. Im Zweifel gilt die bessere Stufe.

- PLUS: Aufgabe vollständig gelöst; höchstens ein oder zwei kleine Fehler.
- PLUS_WELLE: Aufgabe fast vollständig gelöst; kann mehrere kleine Fehler enthalten (z. B. fehlende Semikolons, Tippfehler) oder einen kleinen Fehler in der Logik.
- WELLE: Im Großen und Ganzen in Ordnung, aber einige Fehler in Logik oder Struktur (z. B. einzelne Anforderungen fehlerhaft, Randfälle falsch behandelt).
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
- Nicht kompilierbarer Code: als Fehler werten, nicht als ungelöste Aufgabe. Durch Lesen einschätzen, wie groß der Fehler ist: Tippfehler, fehlende Semikolons oder Imports zählen als kleine Fehler; ist die Logik trotz größerer Compilerfehler erkennbar, nach der Logik beurteilen und die Fehler als erhebliche Mängel werten.
- Offensichtliche Kopie der Musterlösung: die Arbeit wie jede andere beurteilen und im Kommentar neutral vermerken, dass sie der Musterlösung stark entspricht. Keine Vorwürfe, keine Mutmaßungen über Herkunft.

## Kommentar

- Deutsch und unpersönlich: keine direkte Anrede, kurze sachliche Aussagen über die Arbeit.
- 1 bis 4 kurze Sätze, konkret, das Wichtigste zuerst.
- Eine Stärke nennen, sofern es eine gibt.
- Nie Namen, Tokens oder den Platzhalter STUDENT erwähnen.
- Beispiel: "Eingabeprüfung fehlt; Schleife endet einen Schritt zu früh. Methodenaufteilung ist übersichtlich."

# 🧪 Testplan

Was getestet wird und mit welchem Ergebnis. Die Spalte «Status» wird nach jedem Testdurchlauf nachgeführt.

**Status-Legende:** ⬜ offen · ✅ bestanden · ❌ fehlgeschlagen

## Unit-Tests (Vitest)

| Bereich | Was wird geprüft | Status |
|---|---|---|
| Mapper | Google ↔ Graph: Titel, Ort, Beschreibung | ⬜ |
| Mapper | Zeitzonen | ⬜ |
| Mapper | Ganztägige Termine | ⬜ |
| Mapper | RRULE-Fälle (täglich, wöchentlich, monatlich, jährlich, mit Ende oder Anzahl) | ⬜ |
| Sync-Engine | Hash und Loop-Schutz | ⬜ |
| Sync-Engine | Konfliktlösung mit gemockten Providern | ⬜ |

## Manuelle Tests

**Voraussetzung:** Je ein separater Kalender «Sync-Test» in Google und in Outlook, die als Paar gekoppelt sind. So bleiben die echten Kalender beim Testen unberührt.

| Nr. | Schritt | Erwartetes Ergebnis | Status |
|---|---|---|---|
| M-1 | Termin in Google erstellen | Nach dem Sync in Outlook vorhanden | ⬜ |
| M-2 | Diesen Termin in Outlook ändern | Änderung in Google sichtbar, kein Ping-Pong im Log | ⬜ |
| M-3 | Termin in Google löschen | In Outlook gelöscht | ⬜ |
| M-4 | Wöchentliche Serie erstellen und eine Einzelinstanz verschieben | Serie und Ausnahme korrekt gespiegelt | ⬜ |
| M-5 | Beide Seiten offline ändern, dann syncen | Neuere Änderung gewinnt, Eintrag im Log | ⬜ |
| M-6 | App neu starten | Keine Duplikate | ⬜ |

## Testprotokoll

Hier kommt pro Testdurchlauf ein Eintrag mit Datum, getesteter Version und Auffälligkeiten dazu.

*Noch keine Durchläufe.*

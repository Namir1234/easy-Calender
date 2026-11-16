# 🧪 Testplan

Was getestet wird und mit welchem Ergebnis. Die Spalte «Status» wird nach jedem Testdurchlauf nachgeführt.

**Status-Legende:** ⬜ offen · ✅ bestanden · ❌ fehlgeschlagen

## Unit-Tests (Vitest)

Ausführen mit `npm test`.

| Bereich       | Was wird geprüft                                                               | Status |
| ------------- | ------------------------------------------------------------------------------ | ------ |
| Konfiguration | Supabase-Zugangsdaten lesen, ungültige URLs und geheime Schlüssel ablehnen     | ✅     |
| Zeiträume     | Datum umwandeln, ungültige oder zu lange Zeiträume vom Renderer ablehnen       | ✅     |
| Demo-Provider | Wochentage, Zwei-Wochen-Rhythmus, ganztägige Termine, eindeutige IDs           | ✅     |
| Datenschicht  | Arbeitsspeicher-Variante: Demo-Daten anlegen, Sichtbarkeit merken, Fehlerfälle | ✅     |
| Datenschicht  | Supabase-Variante gegen eine echte Datenbank                                   | ⬜     |
| Mapper        | Google ↔ Graph: Titel, Ort, Beschreibung                                       | ⬜     |
| Mapper        | Zeitzonen                                                                      | ⬜     |
| Mapper        | Ganztägige Termine                                                             | ⬜     |
| Mapper        | RRULE-Fälle (täglich, wöchentlich, monatlich, jährlich, mit Ende oder Anzahl)  | ⬜     |
| Sync-Engine   | Hash und Loop-Schutz                                                           | ⬜     |
| Sync-Engine   | Konfliktlösung mit gemockten Providern                                         | ⬜     |

## Tests an der laufenden App

Diese Fälle werden an der gestarteten App geprüft, ohne echte Konten.

| Nr. | Schritt                                        | Erwartetes Ergebnis                                                  | Status |
| --- | ---------------------------------------------- | -------------------------------------------------------------------- | ------ |
| A-1 | App starten ohne `.env`                        | Vier Demo-Kalender, Status «Demo-Daten», keine Fehler in der Konsole | ✅     |
| A-2 | Kalender in der Seitenleiste abwählen          | Seine Termine verschwinden, die Einstellung bleibt nach Neuladen     | ✅     |
| A-3 | Zwischen Monat, Woche und Tag wechseln         | Termine werden für den neuen Zeitraum geladen                        | ✅     |
| A-4 | Termin anklicken, dann Escape                  | Popover mit Details öffnet neben dem Termin und schliesst wieder     | ✅     |
| A-5 | Windows auf hell bzw. dunkel stellen           | Die App folgt der Einstellung                                        | ✅     |
| A-6 | Ungültige Eingaben über die IPC-API schicken   | Der Main-Prozess lehnt sie mit einer Fehlermeldung ab                | ✅     |
| A-7 | In der Oberfläche auf Node zugreifen           | Nicht möglich, nur `window.api` ist vorhanden                        | ✅     |
| A-8 | App mit Supabase-Zugangsdaten starten          | Status «Supabase verbunden», Demo-Daten liegen in der Datenbank      | ✅     |
| A-9 | Installer bauen und die paketierte App starten | `dist/easy-calender-0.1.0-setup.exe` entsteht, die App läuft         | ✅     |

## Manuelle Sync-Tests (ab Etappe 5)

**Voraussetzung:** Je ein separater Kalender «Sync-Test» in Google und in Outlook, die als Paar gekoppelt sind. So bleiben die echten Kalender beim Testen unberührt.

| Nr. | Schritt                                                         | Erwartetes Ergebnis                                | Status |
| --- | --------------------------------------------------------------- | -------------------------------------------------- | ------ |
| M-1 | Termin in Google erstellen                                      | Nach dem Sync in Outlook vorhanden                 | ⬜     |
| M-2 | Diesen Termin in Outlook ändern                                 | Änderung in Google sichtbar, kein Ping-Pong im Log | ⬜     |
| M-3 | Termin in Google löschen                                        | In Outlook gelöscht                                | ⬜     |
| M-4 | Wöchentliche Serie erstellen und eine Einzelinstanz verschieben | Serie und Ausnahme korrekt gespiegelt              | ⬜     |
| M-5 | Beide Seiten offline ändern, dann syncen                        | Neuere Änderung gewinnt, Eintrag im Log            | ⬜     |
| M-6 | App neu starten                                                 | Keine Duplikate                                    | ⬜     |

## Testprotokoll

### 2026-11-16 · Version 0.1.0 (Etappe 1)

- `npm test`: 26 von 26 Tests bestanden. `npm run typecheck` und `npm run lint` ohne Befund.
- A-1 bis A-7 an der gebauten App geprüft, automatisiert über das Chrome DevTools Protocol. A-5 wurde über die simulierte Systemeinstellung geprüft, nicht über den Windows-Schalter selbst.
- A-9: Installer gebaut (rund 121 MB, unsigniert). Die paketierte App aus `dist/win-unpacked` gestartet und geprüft. Der Installer selbst wurde nicht ausgeführt.
- A-8 am selben Tag nachgeholt, nachdem das Supabase-Projekt eingerichtet war: Status «Supabase verbunden», Lesen, Schreiben und Zurücklesen funktionieren, nach einem Neustart keine Duplikate. Ohne Anmeldung liefert die Datenbank keine Zeilen und lehnt Schreiben mit 401 ab.
- **Noch offen:** Für die Supabase-Variante der Datenschicht gibt es keinen automatischen Test. Sie ist nur von Hand an der laufenden App geprüft.

# 🧪 Testplan

Was getestet wird und mit welchem Ergebnis. Die Spalte «Status» wird nach jedem Testdurchlauf nachgeführt.

**Status-Legende:** ⬜ offen · ✅ bestanden · ❌ fehlgeschlagen

## Unit-Tests (Vitest)

Ausführen mit `npm test`.

| Bereich        | Was wird geprüft                                                                                                                                 | Status |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| Konfiguration  | Supabase-Zugangsdaten lesen, ungültige URLs und geheime Schlüssel ablehnen                                                                       | ✅     |
| Zeiträume      | Datum umwandeln, ungültige oder zu lange Zeiträume vom Renderer ablehnen                                                                         | ✅     |
| Demo-Provider  | Wochentage, Zwei-Wochen-Rhythmus, ganztägige Termine, eindeutige IDs                                                                             | ✅     |
| Datenschicht   | Arbeitsspeicher-Variante: Demo-Daten anlegen, Sichtbarkeit merken, Fehlerfälle                                                                   | ✅     |
| Datenschicht   | Supabase-Variante gegen eine echte Datenbank                                                                                                     | ⬜     |
| Datenschicht   | Konto speichern mit Kalender-Abgleich, Konto entfernen, Demo-Konten entfernen                                                                    | ✅     |
| Konfiguration  | Google-Zugangsdaten lesen und prüfen                                                                                                             | ✅     |
| Anmeldung      | Rückweg vom Browser: richtiger und falscher `state`, Abbruch im Browser und in der App, Zeitüberschreitung                                       | ✅     |
| Google-Mapper  | Termine mit Uhrzeit, ganztägig, Zeitzone, Serie, Status, unvollständige Termine                                                                  | ✅     |
| Eingabeprüfung | Termine von der Oberfläche: Zeiten, Zeitzone, Längen, Wiederholung, Unsinn                                                                       | ✅     |
| Sync-Engine    | Neu, geändert, gelöscht in beide Richtungen, Konflikt, Wiederherstellen, kein Ping-Pong, Sicherheitsstopp, Fehler bei einzelnen Terminen, Serien | ✅     |
| Graph-Mapper   | Outlook-Termine lesen und schreiben, Uhrzeit in der Zeitzone des Termins                                                                         | ✅     |
| Serien         | RRULE ↔ Graph-Format hin und zurück, Ablehnen nicht abbildbarer Regeln                                                                           | ✅     |
| Mapper         | Google ↔ Graph: Titel, Ort, Beschreibung                                                                                                         | ⬜     |
| Mapper         | Zeitzonen                                                                                                                                        | ⬜     |
| Mapper         | Ganztägige Termine                                                                                                                               | ⬜     |
| Mapper         | RRULE-Fälle (täglich, wöchentlich, monatlich, jährlich, mit Ende oder Anzahl)                                                                    | ⬜     |
| Sync-Engine    | Hash und Loop-Schutz                                                                                                                             | ⬜     |
| Sync-Engine    | Konfliktlösung mit gemockten Providern                                                                                                           | ⬜     |

## Tests an der laufenden App

Diese Fälle werden an der gestarteten App geprüft, ohne echte Konten.

| Nr.  | Schritt                                               | Erwartetes Ergebnis                                                                              | Status             |
| ---- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------ |
| A-1  | App starten ohne `.env`                               | Vier Demo-Kalender, Status «Demo-Daten», keine Fehler in der Konsole                             | ✅                 |
| A-2  | Kalender in der Seitenleiste abwählen                 | Seine Termine verschwinden, die Einstellung bleibt nach Neuladen                                 | ✅                 |
| A-3  | Zwischen Monat, Woche und Tag wechseln                | Termine werden für den neuen Zeitraum geladen                                                    | ✅                 |
| A-4  | Termin anklicken, dann Escape                         | Popover mit Details öffnet neben dem Termin und schliesst wieder                                 | ✅                 |
| A-5  | Windows auf hell bzw. dunkel stellen                  | Die App folgt der Einstellung                                                                    | ✅                 |
| A-6  | Ungültige Eingaben über die IPC-API schicken          | Der Main-Prozess lehnt sie mit einer Fehlermeldung ab                                            | ✅                 |
| A-7  | In der Oberfläche auf Node zugreifen                  | Nicht möglich, nur `window.api` ist vorhanden                                                    | ✅                 |
| A-8  | App mit Supabase-Zugangsdaten starten                 | Status «Supabase verbunden», Demo-Daten liegen in der Datenbank                                  | ✅                 |
| A-9  | Installer bauen und die paketierte App starten        | `dist/easy-calender-0.1.0-setup.exe` entsteht, die App läuft                                     | ✅                 |
| A-10 | «Google-Konto verbinden» ohne Zugangsdaten in `.env`  | Verständliche Fehlermeldung, die App läuft weiter                                                | ✅                 |
| A-11 | Google-Konto verbinden                                | Browser öffnet die Anmeldung, danach erscheinen die Google-Kalender, die Demo-Daten verschwinden | ✅                 |
| A-12 | Termine eines Google-Kalenders anzeigen               | Termine stehen zur richtigen Zeit im Kalender, ganztägige oben                                   | ✅                 |
| A-13 | App neu starten mit verbundenem Google-Konto          | Kalender und Termine sind ohne neue Anmeldung da                                                 | ✅                 |
| A-14 | Google-Konto entfernen                                | Kalender verschwinden, bleibt kein Konto, kommen die Demo-Daten zurück                           | ⬜                 |
| A-15 | Installer ausführen                                   | App ist installiert, Verknüpfungen auf Desktop und im Startmenü, App startet                     | ✅                 |
| A-16 | Während der Anmeldung «Link kopieren» und «Abbrechen» | Link liegt in der Zwischenablage, nach dem Abbruch ist der Knopf wieder frei                     | ✅                 |
| A-17 | Termin erstellen über «Neuer Termin»                  | Formular öffnet sich, nach dem Speichern steht der Termin im Kalender                            | ✅ (Beispieldaten) |
| A-18 | Im Formular das Ende vor den Beginn setzen            | Meldung im Formular, nichts wird gespeichert                                                     | ✅                 |
| A-19 | Termin anklicken, «Bearbeiten», Titel ändern          | Der Termin trägt den neuen Titel                                                                 | ✅ (Beispieldaten) |
| A-20 | Termin anklicken, «Löschen»                           | Nach der Rückfrage ist der Termin weg                                                            | ⬜                 |
| A-21 | Microsoft-Konto verbinden                             | Browser öffnet die Anmeldung, danach erscheinen die Outlook-Kalender                             | ⬜                 |
| A-22 | Fenster schliessen mit «im Hintergrund weiterlaufen»  | Die App bleibt im Infobereich, ein Klick auf das Symbol öffnet sie wieder                        | ⬜                 |
| A-23 | «Mit Windows starten» einschalten, neu anmelden       | Die App startet ohne Fenster im Infobereich                                                      | ⬜                 |

### 2026-11-17 · Version 0.9.0 mit echtem Google-Konto

- A-11 bis A-13 bestanden: Konto verbunden, sechs Kalender, 35 Termine geladen, nach einem Neustart ohne neue Anmeldung wieder da.
- **Nicht geprüft:** A-14, A-20 bis A-23, Schreiben in einen Google-Kalender, M-1 bis M-6.

### 2026-11-16 · Version 0.9.0

- `npm test`: 80 von 80 Tests bestanden. `npm run typecheck` und `npm run lint` ohne Befund.
- A-17 bis A-19 an der gebauten App mit Beispieldaten geprüft.
- **Nicht geprüft:** A-11 bis A-14 und A-20 bis A-23 sowie alle manuellen Sync-Tests M-1 bis M-6. Dafür braucht es ein verbundenes Google-Konto und eine Azure-Registrierung.

### 2026-11-16 · Version 0.2.1

- `npm test`: 48 von 48 Tests bestanden. `npm run typecheck` und `npm run lint` ohne Befund.
- A-16 an der installierten App geprüft. Dabei bestätigt: Firefox öffnet die Google-Anmeldeseite.
- **Nicht geprüft:** A-11 bis A-14.

### 2026-11-16 · Version 0.2.0 (Etappe 2, Code)

- `npm test`: 47 von 47 Tests bestanden. `npm run typecheck` und `npm run lint` ohne Befund.
- A-10 an der gebauten App geprüft. A-15: Installer still ausgeführt, die installierte App gestartet, sie verbindet sich mit Supabase.
- **Nicht geprüft:** A-11 bis A-14. Dafür braucht es die Zugangsdaten eines Google-OAuth-Clients.

## Manuelle Sync-Tests

**Voraussetzung:** Je ein separater Kalender «Sync-Test» in Google und in Outlook, die als Paar gekoppelt sind. So bleiben die echten Kalender beim Testen unberührt.

| Nr. | Schritt                                                         | Erwartetes Ergebnis                                                           | Status |
| --- | --------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------ |
| M-1 | Termin in Google erstellen                                      | Nach dem Sync in Outlook vorhanden                                            | ⬜     |
| M-2 | Diesen Termin in Outlook ändern                                 | Änderung in Google sichtbar, kein Ping-Pong im Log                            | ⬜     |
| M-3 | Termin in Google löschen                                        | In Outlook gelöscht                                                           | ⬜     |
| M-4 | Wöchentliche Serie erstellen und eine Einzelinstanz verschieben | Serie gespiegelt. Die verschobene Einzelinstanz wird nicht übertragen (E-015) | ⬜     |
| M-5 | Beide Seiten offline ändern, dann syncen                        | Neuere Änderung gewinnt, Eintrag im Log                                       | ⬜     |
| M-6 | App neu starten                                                 | Keine Duplikate                                                               | ⬜     |

## Testprotokoll

### 2026-11-16 · Version 0.1.0 (Etappe 1)

- `npm test`: 26 von 26 Tests bestanden. `npm run typecheck` und `npm run lint` ohne Befund.
- A-1 bis A-7 an der gebauten App geprüft, automatisiert über das Chrome DevTools Protocol. A-5 wurde über die simulierte Systemeinstellung geprüft, nicht über den Windows-Schalter selbst.
- A-9: Installer gebaut (rund 121 MB, unsigniert). Die paketierte App aus `dist/win-unpacked` gestartet und geprüft. Der Installer selbst wurde nicht ausgeführt.
- A-8 am selben Tag nachgeholt, nachdem das Supabase-Projekt eingerichtet war: Status «Supabase verbunden», Lesen, Schreiben und Zurücklesen funktionieren, nach einem Neustart keine Duplikate. Ohne Anmeldung liefert die Datenbank keine Zeilen und lehnt Schreiben mit 401 ab.
- **Noch offen:** Für die Supabase-Variante der Datenschicht gibt es keinen automatischen Test. Sie ist nur von Hand an der laufenden App geprüft.

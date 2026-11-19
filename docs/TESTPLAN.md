# 🧪 Testplan

Was getestet wird und mit welchem Ergebnis. Die Spalte «Status» wird nach jedem Testdurchlauf nachgeführt.

**Status-Legende:** ⬜ offen · ✅ bestanden · ❌ fehlgeschlagen

## Unit-Tests (Vitest)

Ausführen mit `npm test`.

| Bereich         | Was wird geprüft                                                                                                                                 | Status |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| Konfiguration   | Supabase-Zugangsdaten lesen, ungültige URLs und geheime Schlüssel ablehnen                                                                       | ✅     |
| Zeiträume       | Datum umwandeln, ungültige oder zu lange Zeiträume vom Renderer ablehnen                                                                         | ✅     |
| Demo-Provider   | Wochentage, Zwei-Wochen-Rhythmus, ganztägige Termine, eindeutige IDs                                                                             | ✅     |
| Datenschicht    | Arbeitsspeicher-Variante: Demo-Daten anlegen, Sichtbarkeit merken, Fehlerfälle                                                                   | ✅     |
| Datenschicht    | Supabase-Variante gegen eine echte Datenbank                                                                                                     | ⬜     |
| Datenschicht    | Konto speichern mit Kalender-Abgleich, Konto entfernen, Demo-Konten entfernen                                                                    | ✅     |
| Konfiguration   | Google-Zugangsdaten lesen und prüfen                                                                                                             | ✅     |
| Anmeldung       | Rückweg vom Browser: richtiger und falscher `state`, Abbruch im Browser und in der App, Zeitüberschreitung                                       | ✅     |
| Google-Mapper   | Termine mit Uhrzeit, ganztägig, Zeitzone, Serie, Status, unvollständige Termine                                                                  | ✅     |
| Eingabeprüfung  | Termine von der Oberfläche: Zeiten, Zeitzone, Längen, Wiederholung, Unsinn                                                                       | ✅     |
| Sync-Engine     | Neu, geändert, gelöscht in beide Richtungen, Konflikt, Wiederherstellen, kein Ping-Pong, Sicherheitsstopp, Fehler bei einzelnen Terminen, Serien | ✅     |
| Graph-Mapper    | Outlook-Termine lesen und schreiben, Uhrzeit in der Zeitzone des Termins                                                                         | ✅     |
| Serien          | RRULE ↔ Graph-Format hin und zurück, Ablehnen nicht abbildbarer Regeln                                                                           | ✅     |
| Lokales Outlook | Mapper, Serien ↔ Outlook-Muster, Brücke zum PowerShell-Skript (mit Attrappe)                                                                     | ✅     |
| Umschrift       | Notizen nach ASCII, Umlaute bleiben beim Abgleich auf der anderen Seite erhalten                                                                 | ✅     |
| Einstellungen   | Vorgaben, gültige und ungültige Werte, Einstellungen pro Kalender                                                                                | ✅     |
| Assistent       | Kalenderblatt, Antwort des Modells prüfen und umwandeln, Rückfragen, Wahl des Modells, Gespräch mit nachgebautem Ollama                          | ✅     |
| Handy-Version   | Anmeldung speichern und ablaufen lassen, Einstellungen, Kalender umwandeln, Termine seitenweise laden, abgelaufene Anmeldung, Anlegen und Ändern | ✅     |
| Mapper          | Google ↔ Graph: Titel, Ort, Beschreibung                                                                                                         | ⬜     |
| Mapper          | Zeitzonen                                                                                                                                        | ⬜     |
| Mapper          | Ganztägige Termine                                                                                                                               | ⬜     |
| Mapper          | RRULE-Fälle (täglich, wöchentlich, monatlich, jährlich, mit Ende oder Anzahl)                                                                    | ⬜     |
| Sync-Engine     | Hash und Loop-Schutz                                                                                                                             | ⬜     |
| Sync-Engine     | Konfliktlösung mit gemockten Providern                                                                                                           | ⬜     |

## Tests an der laufenden App

Diese Fälle werden an der gestarteten App geprüft, ohne echte Konten.

| Nr.  | Schritt                                                                     | Erwartetes Ergebnis                                                                                | Status                                           |
| ---- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| A-1  | App starten ohne `.env`                                                     | Vier Demo-Kalender, Status «Demo-Daten», keine Fehler in der Konsole                               | ✅                                               |
| A-2  | Kalender in der Seitenleiste abwählen                                       | Seine Termine verschwinden, die Einstellung bleibt nach Neuladen                                   | ✅                                               |
| A-3  | Zwischen Monat, Woche und Tag wechseln                                      | Termine werden für den neuen Zeitraum geladen                                                      | ✅                                               |
| A-4  | Termin anklicken, dann Escape                                               | Popover mit Details öffnet neben dem Termin und schliesst wieder                                   | ✅                                               |
| A-5  | Windows auf hell bzw. dunkel stellen                                        | Die App folgt der Einstellung                                                                      | ✅                                               |
| A-6  | Ungültige Eingaben über die IPC-API schicken                                | Der Main-Prozess lehnt sie mit einer Fehlermeldung ab                                              | ✅                                               |
| A-7  | In der Oberfläche auf Node zugreifen                                        | Nicht möglich, nur `window.api` ist vorhanden                                                      | ✅                                               |
| A-8  | App mit Supabase-Zugangsdaten starten                                       | Status «Supabase verbunden», Demo-Daten liegen in der Datenbank                                    | ✅                                               |
| A-9  | Installer bauen und die paketierte App starten                              | `dist/easy-calender-0.1.0-setup.exe` entsteht, die App läuft                                       | ✅                                               |
| A-10 | «Google-Konto verbinden» ohne Zugangsdaten in `.env`                        | Verständliche Fehlermeldung, die App läuft weiter                                                  | ✅                                               |
| A-11 | Google-Konto verbinden                                                      | Browser öffnet die Anmeldung, danach erscheinen die Google-Kalender, die Demo-Daten verschwinden   | ✅                                               |
| A-12 | Termine eines Google-Kalenders anzeigen                                     | Termine stehen zur richtigen Zeit im Kalender, ganztägige oben                                     | ✅                                               |
| A-13 | App neu starten mit verbundenem Google-Konto                                | Kalender und Termine sind ohne neue Anmeldung da                                                   | ✅                                               |
| A-14 | Google-Konto entfernen                                                      | Kalender verschwinden, bleibt kein Konto, kommen die Demo-Daten zurück                             | ⬜                                               |
| A-15 | Installer ausführen                                                         | App ist installiert, Verknüpfungen auf Desktop und im Startmenü, App startet                       | ✅                                               |
| A-16 | Während der Anmeldung «Link kopieren» und «Abbrechen»                       | Link liegt in der Zwischenablage, nach dem Abbruch ist der Knopf wieder frei                       | ✅                                               |
| A-17 | Termin erstellen über «Neuer Termin»                                        | Formular öffnet sich, nach dem Speichern steht der Termin im Kalender                              | ✅ (Beispieldaten)                               |
| A-18 | Im Formular das Ende vor den Beginn setzen                                  | Meldung im Formular, nichts wird gespeichert                                                       | ✅                                               |
| A-19 | Termin anklicken, «Bearbeiten», Titel ändern                                | Der Termin trägt den neuen Titel                                                                   | ✅ (Beispieldaten)                               |
| A-20 | Termin anklicken, «Löschen»                                                 | Nach der Rückfrage ist der Termin weg                                                              | ⬜                                               |
| A-21 | «Outlook verbinden»                                                         | Ohne Anmeldung erscheinen die Konten und Kalender aus Outlook (classic)                            | ✅                                               |
| A-24 | Brückenskript lesend gegen das lokale Outlook                               | Konten, Kalender und Termine kommen richtig an                                                     | ✅                                               |
| A-25 | Kalender «Aus der App entfernen» und unter «Entfernte Kalender» zurückholen | Kalender und seine Termine verschwinden bzw. kommen zurück, beim Anbieter ändert sich nichts       | ✅ (entfernen), ⬜ (zurückholen)                 |
| A-26 | «Nur ganztägige Termine zeigen»                                             | Termine mit Uhrzeit dieses Kalenders verschwinden                                                  | ✅                                               |
| A-27 | Farbe eines Kalenders ändern                                                | Häkchen und Termine tragen die neue Farbe, auch nach einem Neustart                                | ⬜                                               |
| A-28 | «Neuer Kalender» in einem Outlook-Konto                                     | Der Kalender erscheint in der App und in Outlook                                                   | ⬜                                               |
| A-29 | «Assistent» ohne Ollama                                                     | Spalte zeigt eine Anleitung, Senden ist gesperrt                                                   | ✅                                               |
| A-30 | Assistent: «morgen 14 Uhr Zahnarzt»                                         | Vorschlag mit richtigem Tag, Zeit und Kalender                                                     | ✅ Vorschlag geprüft, «Eintragen» nicht gedrückt |
| A-31 | Assistent: unklare Nachricht («Kino mit Lea»)                               | Rückfrage statt Eintrag, die Antwort darauf ergibt den Vorschlag                                   | ✅                                               |
| A-32 | Monatsansicht: Mausrad und Touchpad nach unten und oben                     | Je Raste bzw. Wisch ein Monat weiter oder zurück, in Woche und Tag scrollt das Rad die Stunden     | ⬜                                               |
| A-33 | Kalender «Im Hintergrund zeigen», Termin während einer Lektion              | Lektion als Fläche, der Termin liegt in voller Breite darüber. Klick auf die Lektion zeigt Details | ✅ (Testseite im Browser)                        |
| H-1  | Handy-Version mit `?demo` in Handygrösse                                    | Liste, Tag und Monat, Details als Blatt, Ändern und Neu im Vollbild-Formular, Kalender ausblenden  | ✅                                               |
| H-2  | Fertiger Build                                                              | Content-Security-Policy aktiv, Service Worker registriert, Manifest lesbar                         | ✅                                               |
| H-3  | Anmeldung mit echtem Google-Konto auf dem Handy                             | Kalender und Termine wie am PC, neuer Termin erscheint in Google                                   | ⬜                                               |
| H-4  | Auf den Home-Bildschirm legen (iPhone)                                      | Startet als App ohne Browserleiste, mit Symbol                                                     | ⬜                                               |
| H-5  | Handy, Monat: nach oben, unten, links und rechts wischen                    | Oben und links: nächster Monat, unten und rechts: voriger. Antippen öffnet weiter den Termin       | ✅ (Browser)                                     |
| A-22 | Fenster schliessen mit «im Hintergrund weiterlaufen»                        | Die App bleibt im Infobereich, ein Klick auf das Symbol öffnet sie wieder                          | ⬜                                               |
| A-23 | «Mit Windows starten» einschalten, neu anmelden                             | Die App startet ohne Fenster im Infobereich                                                        | ⬜                                               |

### 2026-11-19 · Version 0.15.0

- `npm test`: 133 von 133 Tests bestanden. `npm run typecheck` ohne Befund.
- A-33 mit einer Testseite im Browser geprüft (FullCalendar mit Forma-Theme und dem CSS der App).
- **Nicht geprüft:** A-33 an der Desktop-App mit den echten Kalendern TBZ und BMS.

### 2026-11-19 · Version 0.14.0

- `npm test`: 133 von 133 Tests bestanden. `npm run typecheck` und ESLint ohne Befund.
- H-5 im Browser geprüft (375 × 812, Mausrad echt, Touchpad und Wischen simuliert).
- **Nicht geprüft:** A-32 an der Desktop-App, H-5 auf einem echten Handy.

### 2026-11-17 · Version 0.13.0

- `npm test`: 124 von 124 Tests bestanden. `npm run typecheck` und `npm run lint` ohne Befund.
- H-1 und H-2 im Browser geprüft (375 × 812, hell und dunkel).
- **Nicht geprüft:** H-3 und H-4. Der Google-Client «Webanwendung» fehlt noch.

### 2026-11-17 · Version 0.12.1

- `npm test`: 114 von 114 Tests bestanden. `npm run typecheck` und `npm run lint` ohne Befund.
- A-30 und A-31 an der installierten App mit Ollama und `qwen2.5:3b` geprüft (Sätze im Journal).

### 2026-11-17 · Version 0.12.0

- `npm test`: 102 von 102 Tests bestanden. `npm run typecheck` und `npm run lint` ohne Befund.
- A-29 an der installierten App geprüft.
- **Nicht geprüft:** A-30, A-31. Ollama ist noch nicht installiert.

### 2026-11-17 · Version 0.11.0

- `npm test`: 92 von 92 Tests bestanden. `npm run typecheck` und `npm run lint` ohne Befund.
- A-25 (entfernen) und A-26 an der installierten App geprüft.
- **Nicht geprüft:** A-27, A-28, Zurückholen eines entfernten Kalenders.

### 2026-11-17 · Version 0.10.2

- `npm test`: 89 von 89 Tests bestanden. `npm run typecheck` und `npm run lint` ohne Befund.
- M-1 bis M-5 an zwei Testkalendern «Sync-Test» bestanden, dazu ganztägige Termine und die Prüfung auf Ping-Pong nach jedem Schritt. Die Testkalender sind danach wieder leer.
- **Nicht geprüft:** M-6 als eigener Schritt, A-14, A-20, A-22, A-23.

### 2026-11-17 · Version 0.10.1

- A-21 bestanden: beide Outlook-Konten mit Kalendern und Terminen in der installierten App.
- **Nicht geprüft:** Schreiben ins lokale Outlook, M-1 bis M-6.

### 2026-11-17 · Version 0.10.0

- `npm test`: 87 von 87 Tests bestanden. `npm run typecheck` und `npm run lint` ohne Befund.
- A-24 bestanden: zwei Konten, je drei Kalender, Termine mit Uhrzeit, ganztägige, Vorkommen und Serien, Umlaute und Notizen.
- **Nicht geprüft:** A-21, Schreiben ins lokale Outlook, M-1 bis M-6.

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
| M-1 | Termin in Google erstellen                                      | Nach dem Sync in Outlook vorhanden                                            | ✅     |
| M-2 | Diesen Termin in Outlook ändern                                 | Änderung in Google sichtbar, kein Ping-Pong im Log                            | ✅     |
| M-3 | Termin in Google löschen                                        | In Outlook gelöscht                                                           | ✅     |
| M-4 | Wöchentliche Serie erstellen und eine Einzelinstanz verschieben | Serie gespiegelt. Die verschobene Einzelinstanz wird nicht übertragen (E-015) | ✅     |
| M-5 | Beide Seiten offline ändern, dann syncen                        | Neuere Änderung gewinnt, Eintrag im Log                                       | ✅     |
| M-6 | App neu starten                                                 | Keine Duplikate                                                               | ⬜     |

## Testprotokoll

### 2026-11-16 · Version 0.1.0 (Etappe 1)

- `npm test`: 26 von 26 Tests bestanden. `npm run typecheck` und `npm run lint` ohne Befund.
- A-1 bis A-7 an der gebauten App geprüft, automatisiert über das Chrome DevTools Protocol. A-5 wurde über die simulierte Systemeinstellung geprüft, nicht über den Windows-Schalter selbst.
- A-9: Installer gebaut (rund 121 MB, unsigniert). Die paketierte App aus `dist/win-unpacked` gestartet und geprüft. Der Installer selbst wurde nicht ausgeführt.
- A-8 am selben Tag nachgeholt, nachdem das Supabase-Projekt eingerichtet war: Status «Supabase verbunden», Lesen, Schreiben und Zurücklesen funktionieren, nach einem Neustart keine Duplikate. Ohne Anmeldung liefert die Datenbank keine Zeilen und lehnt Schreiben mit 401 ab.
- **Noch offen:** Für die Supabase-Variante der Datenschicht gibt es keinen automatischen Test. Sie ist nur von Hand an der laufenden App geprüft.

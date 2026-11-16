# 🏗️ Architektur

Dieses Dokument beschreibt den geplanten Aufbau der App. Es wird mit jeder Etappe an den echten Stand angepasst.

> **Stand:** Etappe 2 (Code). Gebaut sind Oberfläche, IPC-API, Datenschicht, Demo-Provider sowie Google-Login und Google-Provider. Microsoft und die Sync-Engine sind geplant.

## Überblick

Die App ist eine Electron-Anwendung mit drei Teilen:

| Teil             | Aufgabe                                                                      |
| ---------------- | ---------------------------------------------------------------------------- |
| **Main-Prozess** | Fenster, Tray, Datenschicht, Anmeldung bei Google und Microsoft, Sync-Engine |
| **Preload**      | Schmale, sichere Brücke (`contextBridge`) zwischen Renderer und Main-Prozess |
| **Renderer**     | React-Oberfläche mit FullCalendar, Dialogen und Einstellungen                |

Der Renderer spricht nie direkt mit Google oder Microsoft. Alle Zugriffe laufen über die IPC-API im Main-Prozess, dort liegen auch die Tokens.

```mermaid
flowchart LR
    subgraph R["Renderer (React)"]
        UI["Kalender-UI<br>FullCalendar"]
    end

    subgraph MAIN["Main-Prozess (Electron)"]
        IPC["IPC-API"]
        ENG["Sync-Engine"]
        SCH["Scheduler"]
        DB["Datenschicht"]
        GP["Google-Provider"]
        MP["Microsoft-Provider"]
    end

    SB[("Supabase")]
    GAPI(["Google Calendar API v3"])
    GRAPH(["Microsoft Graph"])

    UI <-->|contextBridge| IPC
    IPC --> ENG
    SCH --> ENG
    ENG <--> DB
    DB <--> SB
    ENG <--> GP
    ENG <--> MP
    GP <--> GAPI
    MP <--> GRAPH
```

## Projektstruktur

Die aktuelle Struktur steht im [README](../README.md#-architektur). Geplant und noch nicht vorhanden sind der Microsoft-Login, `providers/microsoft.ts` und `sync/` (Engine, Mapper, Scheduler).

## Normalisiertes Event-Modell

Beide Anbieter werden auf ein gemeinsames Modell abgebildet:

| Feld           | Bedeutung                                                               |
| -------------- | ----------------------------------------------------------------------- |
| `title`        | Titel des Termins                                                       |
| `description`  | Beschreibung                                                            |
| `location`     | Ort                                                                     |
| `start`, `end` | Beginn und Ende. Ganztägig als Datum, sonst als Zeitpunkt nach ISO 8601 |
| `allDay`       | Ganztägiger Termin                                                      |
| `timeZone`     | Zeitzone                                                                |
| `recurrence`   | Wiederholung als RRULE                                                  |
| `attendees?`   | Teilnehmer (optional, wird in v1 nicht gespiegelt)                      |
| `status`       | Status, z. B. bestätigt oder abgesagt                                   |

Gesynct wird nur diese definierte Teilmenge an Feldern. So geht nichts verloren, nur weil ein Feld beim anderen Anbieter kein Gegenstück hat.

## Datenbank

Die Daten liegen in **Supabase** (Postgres). Das Schema steht in [`supabase/migrations`](../supabase/migrations). Nur der Main-Prozess spricht mit Supabase, über die Datenschicht in `src/main/db`. Sie hat zwei Umsetzungen mit derselben Schnittstelle:

- `SupabaseStore`: der Normalfall, sobald die Zugangsdaten in `.env` stehen
- `MemoryStore`: Demo-Daten im Arbeitsspeicher, solange Supabase nicht eingerichtet oder nicht erreichbar ist, und für Tests

Jede Zeile gehört einem Supabase-Benutzer (`user_id`). Row Level Security sorgt dafür, dass jeder nur seine eigenen Zeilen sieht. Die App meldet sich beim ersten Start anonym an. Diese Sitzung liegt verschlüsselt im Electron `safeStorage`.

Zusätzlich zum Plan haben alle Tabellen die Spalte `user_id`, und `calendars` hat `visible` (ob der Kalender in der Ansicht gezeigt wird).

```mermaid
erDiagram
    accounts ||--o{ calendars : besitzt
    calendars ||--o| sync_state : hat
    calendars ||--o{ sync_pairs : "gekoppelt in"
    sync_pairs ||--o{ event_links : enthaelt

    accounts {
        text id
        text provider
        text email
        text token_ref
    }
    calendars {
        text id
        text account_id
        text remote_id
        text name
        text color
        int sync_enabled
    }
    sync_pairs {
        text id
        text google_calendar_id
        text ms_calendar_id
    }
    event_links {
        text pair_id
        text google_event_id
        text ms_event_id
        text last_hash
        text google_etag
        text ms_changekey
        text updated_at
    }
    sync_state {
        text calendar_id
        text delta_token
    }
```

| Tabelle       | Zweck                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------- |
| `accounts`    | Verbundene Konten mit Anbieter, E-Mail und Verweis auf das Token                               |
| `calendars`   | Kalender eines Kontos mit Name, Farbe und ob der Sync aktiv ist                                |
| `sync_pairs`  | Welche Kalender miteinander gekoppelt sind, z. B. Google «Privat» ↔ Outlook «Kalender»         |
| `event_links` | Verknüpfung zwischen einem Google-Termin und seinem Outlook-Gegenstück, inklusive letztem Hash |
| `sync_state`  | Googles `syncToken` bzw. Graphs `deltaLink` pro Kalender                                       |

## Sync-Algorithmus

Der Algorithmus läuft pro Kalender-Paar.

1. **Änderungen holen.** Beide Seiten werden inkrementell abgefragt: Google über `syncToken`, Graph über `/calendarView/delta`. Beim ersten Lauf gilt ein Zeitfenster von 30 Tagen zurück bis 365 Tage voraus.
2. **Gegenstück suchen.** Für jede Änderung wird über `event_links` das Gegenstück gesucht:
   - **neu:** auf der anderen Seite erstellen und den Link speichern
   - **geändert:** Hash der normalisierten Felder mit `last_hash` vergleichen. Ist er gleich, ist es das Echo des eigenen Updates und wird ignoriert. Sonst wird die andere Seite aktualisiert.
   - **gelöscht oder abgesagt:** auf der anderen Seite löschen
3. **Konflikte lösen.** Wurden beide Seiten seit dem letzten Sync geändert, gewinnt die neuere `updated` bzw. `lastModifiedDateTime`. Das wird ins Sync-Log geschrieben.
4. **Markierung setzen.** Im Termin selbst wird eine ID-Markierung gespeichert (Google `extendedProperties.private`, Graph `singleValueExtendedProperties`). Damit werden gespiegelte Termine auch nach einem Verlust der Datenbank wiedererkannt.
5. **Fehler behandeln.**

   | Fehler | Reaktion                             |
   | ------ | ------------------------------------ |
   | `401`  | Token erneuern                       |
   | `410`  | `syncToken` abgelaufen, Vollabgleich |
   | `429`  | Backoff                              |

### Loop-Schutz

Schreibt die App einen Termin nach Outlook, meldet Outlook diesen beim nächsten Abruf als «geändert». Ohne Schutz würde die App ihn zurück nach Google schreiben, und so weiter. Darum wird nach jedem Schreiben der Hash der normalisierten Felder in `last_hash` gespeichert. Kommt eine Änderung mit demselben Hash zurück, ist es das eigene Echo und wird verworfen.

### Wann läuft der Sync?

- alle 2 Minuten (Polling)
- wenn das Fenster den Fokus bekommt
- manuell über die Oberfläche

## Wiederkehrende Termine

- Die Serie wird über RRULE ↔ Graph `patternedRecurrence` abgebildet: täglich, wöchentlich, monatlich, jährlich, mit Ende oder Anzahl.
- Geänderte oder abgesagte Einzeltermine einer Serie werden als Ausnahmen gesynct.
- Exotische RRULEs, die Graph nicht abbilden kann, werden als Einzeltermine gespiegelt und mit einer Warnung im Log vermerkt.

## Sicherheit

- Tokens liegen verschlüsselt im Electron `safeStorage` (Windows DPAPI), nie in Supabase und nie im Klartext auf der Festplatte.
- Die App verwendet nur den öffentlichen Supabase-Schlüssel. Einen geheimen Schlüssel lehnt sie ab. Den Schutz der Daten übernimmt Row Level Security.
- Das Fenster läuft mit `sandbox` und `contextIsolation`, ohne Node in der Oberfläche. Alles, was vom Renderer kommt, prüft der Main-Prozess.
- Der Renderer hat über `contextBridge` nur Zugriff auf eine schmale, definierte API.
- Google-Anmeldung über OAuth 2.0 «Desktop app» mit Loopback-Redirect und PKCE.
- Microsoft-Anmeldung über MSAL als öffentlicher Client, Authority `common` für private Konten sowie Schul- und Firmenkonten.

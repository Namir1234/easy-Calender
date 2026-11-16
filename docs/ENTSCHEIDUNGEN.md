# 🧭 Entscheidungen

Wichtige technische Entscheidungen mit Begründung. Neue Entscheidungen kommen unten dazu und bekommen eine fortlaufende Nummer. Wird eine Entscheidung später geändert, bleibt der alte Eintrag stehen und wird als «ersetzt durch E-xxx» markiert.

| Nr.                                                                   | Datum      | Entscheidung                                          | Status |
| --------------------------------------------------------------------- | ---------- | ----------------------------------------------------- | ------ |
| [E-001](#e-001-electron-mit-vite-react-und-typescript)                | 2026-11-16 | Electron mit Vite, React und TypeScript               | gilt   |
| [E-002](#e-002-polling-statt-push-webhooks)                           | 2026-11-16 | Polling statt Push-Webhooks                           | gilt   |
| [E-003](#e-003-teilnehmer-und-einladungen-werden-nicht-gespiegelt)    | 2026-11-16 | Teilnehmer und Einladungen werden nicht gespiegelt    | gilt   |
| [E-004](#e-004-tokens-im-electron-safestorage)                        | 2026-11-16 | Tokens im Electron `safeStorage`                      | gilt   |
| [E-005](#e-005-bei-konflikten-gewinnt-die-neuere-änderung)            | 2026-11-16 | Bei Konflikten gewinnt die neuere Änderung            | gilt   |
| [E-006](#e-006-loop-schutz-über-hash-und-id-markierung)               | 2026-11-16 | Loop-Schutz über Hash und ID-Markierung               | gilt   |
| [E-007](#e-007-nur-eine-definierte-teilmenge-an-feldern-wird-gesynct) | 2026-11-16 | Nur eine definierte Teilmenge an Feldern wird gesynct | gilt   |
| [E-008](#e-008-supabase-statt-lokaler-sqlite-datenbank)               | 2026-11-16 | Supabase statt lokaler SQLite-Datenbank               | gilt   |
| [E-009](#e-009-anonyme-anmeldung-und-row-level-security)              | 2026-11-16 | Anonyme Anmeldung und Row Level Security              | gilt   |
| [E-010](#e-010-fullcalendar-7)                                        | 2026-11-16 | FullCalendar 7                                        | gilt   |
| [E-011](#e-011-neutrale-oberfläche-nach-festen-gestaltungsregeln)     | 2026-11-16 | Neutrale Oberfläche nach festen Gestaltungsregeln     | gilt   |

---

## E-001: Electron mit Vite, React und TypeScript

**Entscheidung:** Die App wird als Electron-Desktop-App für Windows gebaut, auf Basis der Vorlage `electron-vite`. Die Oberfläche nutzt React mit FullCalendar, die lokale Datenbank ist `better-sqlite3` im Main-Prozess. _(Der Teil zur Datenbank ist ersetzt durch E-008.)_

**Begründung:** Für beide Anbieter gibt es offizielle Node-Bibliotheken (`googleapis`, `@azure/msal-node`, `@microsoft/microsoft-graph-client`). FullCalendar liefert Monats-, Wochen- und Tagesansicht fertig mit.

## E-002: Polling statt Push-Webhooks

**Entscheidung:** Der Sync fragt Änderungen alle 2 Minuten ab, zusätzlich beim Fokussieren des Fensters und manuell.

**Begründung:** Webhooks bräuchten einen öffentlich erreichbaren Server. Den gibt es bei einer reinen Desktop-App nicht.

**Folge:** Der Sync läuft nur, solange die App offen ist. Im Tray minimiert reicht.

## E-003: Teilnehmer und Einladungen werden nicht gespiegelt

**Entscheidung:** Gespiegelt werden Titel, Zeit, Ort, Beschreibung und Wiederholung. Teilnehmer nicht.

**Begründung:** Würde ein Termin mit Teilnehmern auf der anderen Seite neu erstellt, könnten ungewollte Einladungsmails verschickt werden.

## E-004: Tokens im Electron safeStorage

**Entscheidung:** Zugriffs- und Refresh-Tokens werden über Electron `safeStorage` verschlüsselt gespeichert. In der Datenbank steht nur ein Verweis.

**Begründung:** `safeStorage` nutzt unter Windows DPAPI, die Tokens sind damit an das Windows-Benutzerkonto gebunden und liegen nicht im Klartext auf der Festplatte.

## E-005: Bei Konflikten gewinnt die neuere Änderung

**Entscheidung:** Wurde ein Termin seit dem letzten Sync auf beiden Seiten geändert, gewinnt die Seite mit dem neueren Zeitstempel (`updated` bei Google, `lastModifiedDateTime` bei Graph). Der Konflikt wird ins Sync-Log geschrieben.

**Begründung:** Die Regel ist einfach und vorhersehbar. Über das Log bleibt nachvollziehbar, welche Änderung überschrieben wurde.

## E-006: Loop-Schutz über Hash und ID-Markierung

**Entscheidung:** Nach jedem Schreiben wird ein Hash der normalisierten Felder gespeichert (`last_hash`). Kommt eine Änderung mit demselben Hash zurück, wird sie ignoriert. Zusätzlich trägt jeder gespiegelte Termin eine ID-Markierung (Google `extendedProperties.private`, Graph `singleValueExtendedProperties`).

**Begründung:** Der Hash verhindert, dass die App ihre eigenen Änderungen endlos hin und her schreibt. Die Markierung sorgt dafür, dass nach einem Verlust der Datenbank keine Duplikate entstehen.

## E-007: Nur eine definierte Teilmenge an Feldern wird gesynct

**Entscheidung:** Beide Anbieter werden auf ein gemeinsames, normalisiertes Event-Modell abgebildet. Nur dessen Felder werden übertragen.

**Begründung:** Google und Graph kennen Felder, die es beim jeweils anderen nicht gibt. Würde man alles übertragen wollen, ginge beim Hin und Her Information verloren.

## E-008: Supabase statt lokaler SQLite-Datenbank

**Entscheidung:** Konten, Kalender und der Sync-Zustand liegen in Supabase (Postgres) statt in einer lokalen SQLite-Datei. Ersetzt den Datenbank-Teil von E-001.

**Begründung:** Vorgabe von Namir vom 2026-11-16.

**Folgen:** Die App braucht für die Datenbank Internet und ein Supabase-Projekt. Solange keines eingerichtet ist, läuft sie mit Demo-Daten im Arbeitsspeicher. Als Nebeneffekt entfällt das native Modul `better-sqlite3`, das auf diesem Rechner ohne Build-Werkzeuge nicht hätte kompiliert werden können.

## E-009: Anonyme Anmeldung und Row Level Security

**Entscheidung:** Die App verwendet nur den öffentlichen Supabase-Schlüssel und meldet sich beim ersten Start anonym an. Jede Zeile trägt eine `user_id`, Row Level Security lässt jeden Benutzer nur seine eigenen Zeilen sehen.

**Begründung:** Der öffentliche Schlüssel steckt in jeder ausgelieferten App und ist nicht geheim. Ohne Zugriffsregeln könnte jeder mit diesem Schlüssel alle Daten lesen. Die anonyme Anmeldung braucht kein Login-Fenster.

**Folge:** Die Daten hängen an dieser einen Installation. Wer die App auf mehreren Geräten mit denselben Daten nutzen will, braucht später ein richtiges Login. Supabase kann einen anonymen Benutzer nachträglich in einen festen umwandeln.

## E-010: FullCalendar 7

**Entscheidung:** Die Kalenderansicht nutzt FullCalendar 7 mit dem Theme «forma» und eigenen Farben.

**Begründung:** Version 7 ist die aktuelle Hauptversion. Die Plugins sind dort Teil von `@fullcalendar/react`, die einzelnen Pakete der Version 6 gelten als veraltet. «forma» lehnt sich an die Gestaltung von Windows und Outlook an.

## E-011: Neutrale Oberfläche nach festen Gestaltungsregeln

**Entscheidung:** Die Oberfläche folgt den Regeln in [DESIGN.md](DESIGN.md): neutrale Flächen, Farbe nur für Kalender, ein roter Akzent für «heute» und «jetzt», Systemschrift, Popover statt Modal.

**Begründung:** Wunsch von Namir vom 2026-11-16, die Oberfläche nach dem Katalog von impeccable.style zu überarbeiten. Die erste Fassung hatte mehrere der dort genannten Merkmale: Indigo-Standardpalette, Emoji als Logo, winzige Grossbuchstaben-Labels, Rahmen in Rahmen und ein Modal für vier Zeilen Information.

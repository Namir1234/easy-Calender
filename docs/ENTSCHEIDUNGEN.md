# 🧭 Entscheidungen

Wichtige technische Entscheidungen mit Begründung. Neue Entscheidungen kommen unten dazu und bekommen eine fortlaufende Nummer. Wird eine Entscheidung später geändert, bleibt der alte Eintrag stehen und wird als «ersetzt durch E-xxx» markiert.

| Nr.                                                                   | Datum      | Entscheidung                                           | Status |
| --------------------------------------------------------------------- | ---------- | ------------------------------------------------------ | ------ |
| [E-001](#e-001-electron-mit-vite-react-und-typescript)                | 2026-11-16 | Electron mit Vite, React und TypeScript                | gilt   |
| [E-002](#e-002-polling-statt-push-webhooks)                           | 2026-11-16 | Polling statt Push-Webhooks                            | gilt   |
| [E-003](#e-003-teilnehmer-und-einladungen-werden-nicht-gespiegelt)    | 2026-11-16 | Teilnehmer und Einladungen werden nicht gespiegelt     | gilt   |
| [E-004](#e-004-tokens-im-electron-safestorage)                        | 2026-11-16 | Tokens im Electron `safeStorage`                       | gilt   |
| [E-005](#e-005-bei-konflikten-gewinnt-die-neuere-änderung)            | 2026-11-16 | Bei Konflikten gewinnt die neuere Änderung             | gilt   |
| [E-006](#e-006-loop-schutz-über-hash-und-id-markierung)               | 2026-11-16 | Loop-Schutz über Hash und ID-Markierung                | gilt   |
| [E-007](#e-007-nur-eine-definierte-teilmenge-an-feldern-wird-gesynct) | 2026-11-16 | Nur eine definierte Teilmenge an Feldern wird gesynct  | gilt   |
| [E-008](#e-008-supabase-statt-lokaler-sqlite-datenbank)               | 2026-11-16 | Supabase statt lokaler SQLite-Datenbank                | gilt   |
| [E-009](#e-009-anonyme-anmeldung-und-row-level-security)              | 2026-11-16 | Anonyme Anmeldung und Row Level Security               | gilt   |
| [E-010](#e-010-fullcalendar-7)                                        | 2026-11-16 | FullCalendar 7                                         | gilt   |
| [E-011](#e-011-neutrale-oberfläche-nach-festen-gestaltungsregeln)     | 2026-11-16 | Neutrale Oberfläche nach festen Gestaltungsregeln      | gilt   |
| [E-012](#e-012-googleapiscalendar-und-eng-gefasste-berechtigungen)    | 2026-11-16 | `@googleapis/calendar` und eng gefasste Berechtigungen | gilt   |
| [E-013](#e-013-microsoft-ohne-zusatzbibliotheken)                     | 2026-11-16 | Microsoft ohne Zusatzbibliotheken                      | gilt   |
| [E-014](#e-014-abgleich-über-listen-und-fingerabdrücke)               | 2026-11-16 | Abgleich über Listen und Fingerabdrücke                | gilt   |
| [E-015](#e-015-serien-als-ganzes-ohne-ausnahmen)                      | 2026-11-16 | Serien als Ganzes, ohne Ausnahmen                      | gilt   |
| [E-016](#e-016-outlook-über-das-lokal-installierte-outlook)           | 2026-11-17 | Outlook über das lokal installierte Outlook            | gilt   |
| [E-017](#e-017-notizen-gehen-nur-mit-ascii-nach-outlook)              | 2026-11-17 | Notizen gehen nur mit ASCII nach Outlook               | gilt   |
| [E-018](#e-018-assistent-mit-lokalem-modell-über-ollama)              | 2026-11-17 | Assistent mit lokalem Modell über Ollama               | gilt   |

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

## E-012: @googleapis/calendar und eng gefasste Berechtigungen

**Entscheidung:** Für Google wird das Paket `@googleapis/calendar` zusammen mit `google-auth-library` verwendet, nicht das Sammelpaket `googleapis`. Die App fragt nur diese Berechtigungen an: Kalenderliste lesen (`calendar.calendarlist.readonly`) sowie Termine lesen und schreiben (`calendar.events`), dazu die E-Mail-Adresse des Kontos.

**Begründung:** `googleapis` enthält alle Google-APIs und würde den Installer unnötig vergrössern. `@googleapis/calendar` ist derselbe offizielle Code, nur für die Calendar API. Die Berechtigungen sind so eng wie möglich: Die App kann keine Kalender anlegen, löschen oder freigeben. Das Schreiben von Terminen wird erst ab Etappe 4 gebraucht, aber schon jetzt angefragt, damit später keine zweite Zustimmung nötig ist.

## E-013: Microsoft ohne Zusatzbibliotheken

**Entscheidung:** Die Anmeldung bei Microsoft und die Zugriffe auf Microsoft Graph laufen direkt über `fetch`, ohne `@azure/msal-node` und ohne `@microsoft/microsoft-graph-client`. Das ersetzt die ursprüngliche Planung.

**Begründung:** Die App braucht nur den Standardablauf «Authorization Code mit PKCE» und eine Handvoll Graph-Aufrufe. Der Rückweg über den lokalen Server und PKCE sind von der Google-Anmeldung schon da und werden wiederverwendet. Zwei Bibliotheken weniger heisst kleinerer Installer und weniger fremder Code im Main-Prozess. Das Refresh-Token liegt wie bei Google verschlüsselt im `safeStorage`.

## E-014: Abgleich über Listen und Fingerabdrücke

**Entscheidung:** Der Abgleich holt bei jedem Lauf die Termine beider Kalender im Fenster von 30 Tagen zurück bis 365 Tage voraus und vergleicht sie. Delta-Abfragen (`syncToken`, `/delta`) werden nicht verwendet. Pro Verknüpfung wird für jede Seite ein Fingerabdruck der abgeglichenen Felder gespeichert, in den Spalten `google_etag` und `ms_changekey` der Tabelle `event_links`.

**Begründung:** Der Listenvergleich kommt ohne Zustand aus, der ablaufen oder verloren gehen kann, und ist darum einfacher zu prüfen. Für private Kalender reicht die Geschwindigkeit. Ein Fingerabdruck pro Seite statt eines gemeinsamen verhindert Ping-Pong auch dann, wenn ein Anbieter einen Termin leicht anders zurückgibt, als er geschrieben wurde. Schutzmassnahmen: Fehlt ein verknüpfter Termin in der Liste, wird einzeln nachgefragt, bevor er als gelöscht gilt. Würden auf einen Schlag mehr als 15 Termine und mehr als die Hälfte gelöscht, stoppt der Abgleich.

## E-015: Serien als Ganzes, ohne Ausnahmen

**Entscheidung:** Eine Serie wird als ein Termin mit Regel abgeglichen. Einzelne geänderte oder abgesagte Termine einer Serie (Ausnahmen) werden nicht übertragen. Regeln, die Outlook nicht abbilden kann, werden nicht übertragen und im Bereich «Synchronisation» gemeldet.

**Begründung:** Ausnahmen sind bei Google und Microsoft sehr unterschiedlich gebaut. Ein falscher Abgleich wäre schlimmer als ein fehlender. Die Serie selbst deckt den häufigsten Fall ab.

**Nachtrag 0.13.1:** Outlook erlaubt bei einer ganzen Serie nicht, Beginn, Ende oder «ganztägig» direkt zu ändern («The object does not support this method»). Das Brückenskript löst die Serie darum vor dem Ändern auf und setzt das Muster danach neu. Allfällige Ausnahmen der Serie gehen dabei verloren, was zu dieser Entscheidung passt.

## E-016: Outlook über das lokal installierte Outlook

**Entscheidung:** Outlook-Kalender werden über das auf dem Rechner installierte Outlook (classic) gelesen und geschrieben, nicht über Microsoft Graph. Ein PowerShell-Skript steuert Outlook über dessen Objektmodell (COM). Der Graph-Weg aus E-013 bleibt im Code und wird nur mit gesetzter Anwendungs-ID verwendet.

**Begründung:** Graph verlangt eine App-Registrierung bei Microsoft. TBZ und BMZ sperren diese für Lernende, und auch die Zustimmung zu fremden Apps kann gesperrt sein. Das lokale Outlook ist schon angemeldet und braucht weder Registrierung noch Freigabe.

**Preis:** Es geht nur unter Windows mit Outlook (classic) und eingerichtetem Konto, nicht mit dem «neuen Outlook». Der Abgleich läuft nur, wenn der Rechner an ist. Outlook wird dafür im Hintergrund gestartet. Kalender haben keine eigene Farbe aus Outlook.

## E-017: Notizen gehen nur mit ASCII nach Outlook

**Entscheidung:** Beim Schreiben ins lokale Outlook wird die Notiz eines Termins nach ASCII umgeschrieben: «Zürich» wird «Zuerich», «café» wird «cafe», «€» wird «EUR». Titel und Ort bleiben unverändert. Beim Abgleich gilt: Unterscheiden sich zwei Notizen nur durch diese Umschrift, behält die Zielseite ihre eigene Fassung.

**Begründung:** Outlook (classic) in der geprüften Version 16.0.20527 verfälscht Nicht-ASCII-Zeichen, wenn die Notiz über das Objektmodell gesetzt wird: Hinter jeder Folge solcher Zeichen entsteht Zeichenmüll. Andere Schreibwege (RTF, HTML, MAPI-Eigenschaft) nimmt Outlook von aussen nicht an. Eine lesbare Umschrift ist besser als Zeichenmüll. Die Regel beim Abgleich verhindert, dass Google seine Umlaute verliert, wenn ein Termin in Outlook angefasst wird.

**Preis:** In Outlook stehen Notizen ohne Umlaute. Wird eine Notiz in Outlook inhaltlich geändert, wandert sie in dieser Form nach Google.

## E-018: Assistent mit lokalem Modell über Ollama

**Entscheidung:** Der Assistent nutzt ein kleines Sprachmodell, das mit Ollama auf Namirs Rechner läuft. Vorgeschlagen ist `qwen2.5:3b` (etwa 2 GB). Ist ein anderes Modell geladen, nimmt die App dieses.

**Begründung:** Namir wollte keine laufenden Kosten. Die API von Anthropic kostet pro Anfrage, Copilot bietet fremden Apps keinen Zugang, und Gratis-Kontingente von Cloud-Anbietern verwenden die Eingaben oft zum Training. Ein lokales Modell kostet nichts, und Termine verlassen den Rechner nicht. Für das Eintragen einfacher Termine reicht ein kleines Modell, wenn die App ihm das Rechnen mit Daten abnimmt (Kalenderblatt im Prompt) und seine Antwort streng prüft.

**Preis:** Ollama muss installiert sein und läuft im Hintergrund. Das Modell braucht 2 bis 3 GB Arbeitsspeicher, eine Antwort kann ein paar Sekunden dauern. Ein kleines Modell versteht nicht jede Formulierung. Darum wird nie ohne Bestätigung eingetragen.

**Nachtrag 0.12.1:** Der Test mit dem echten Modell zeigte, dass es Tage erfindet und Kalender falsch wählt. Seither entscheidet die App selbst, was sie prüfen kann: Kalender (über Namen und Konto), ob ein Wann genannt ist, ob Wochentag, Uhrzeit und Titel zur Nachricht passen. Das Modell liefert nur noch den Vorschlag, den die App prüft.

## E-019: Outlook-Funktionen ohne Abgleich der Zusatzfelder

**Entscheidung:** Erinnerung, «Anzeigen als», privat und Kategorien liest und schreibt die App bei jedem Anbieter, gleicht sie aber nicht zwischen den Kalendern ab. Fehlt ein Feld beim Schreiben, bleibt es beim Anbieter unverändert. Die App erinnert nur an Google-Termine mit einer Windows-Mitteilung; Outlook erinnert selbst an seine Termine.

**Begründung:** Namir wünschte alle Funktionen des Outlook-Kalenders. Die Zusatzfelder in den Abgleich zu nehmen, hätte die Fingerabdrücke aller bestehenden Verknüpfungen verändert und beim nächsten Lauf jeden Termin neu geschrieben. Ausserdem kennt Google weder «abwesend» noch Kategorien: Die App merkt sie sich dort in privaten Eigenschaften des Termins (`extendedProperties.private`). Würde die App auch an Outlook-Termine erinnern, käme jede Erinnerung doppelt.

**Preis:** Ein gespiegelter Termin hat auf der anderen Seite die Vorgaben des Anbieters (z. B. 15 Minuten Erinnerung), nicht die Werte des Originals. Teilnehmer, Einladungen, Teams-Besprechungen, Räume, Anlagen und das Teilen von Kalendern sind nicht gebaut: Sie würden E-Mails an andere verschicken oder Rechte vergeben und brauchen eine eigene Entscheidung.

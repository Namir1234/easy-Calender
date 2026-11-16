# 🧭 Entscheidungen

Wichtige technische Entscheidungen mit Begründung. Neue Entscheidungen kommen unten dazu und bekommen eine fortlaufende Nummer. Wird eine Entscheidung später geändert, bleibt der alte Eintrag stehen und wird als «ersetzt durch E-xxx» markiert.

| Nr. | Datum | Entscheidung | Status |
|---|---|---|---|
| [E-001](#e-001-electron-mit-vite-react-und-typescript) | 2026-11-16 | Electron mit Vite, React und TypeScript | gilt |
| [E-002](#e-002-polling-statt-push-webhooks) | 2026-11-16 | Polling statt Push-Webhooks | gilt |
| [E-003](#e-003-teilnehmer-und-einladungen-werden-nicht-gespiegelt) | 2026-11-16 | Teilnehmer und Einladungen werden nicht gespiegelt | gilt |
| [E-004](#e-004-tokens-im-electron-safestorage) | 2026-11-16 | Tokens im Electron `safeStorage` | gilt |
| [E-005](#e-005-bei-konflikten-gewinnt-die-neuere-änderung) | 2026-11-16 | Bei Konflikten gewinnt die neuere Änderung | gilt |
| [E-006](#e-006-loop-schutz-über-hash-und-id-markierung) | 2026-11-16 | Loop-Schutz über Hash und ID-Markierung | gilt |
| [E-007](#e-007-nur-eine-definierte-teilmenge-an-feldern-wird-gesynct) | 2026-11-16 | Nur eine definierte Teilmenge an Feldern wird gesynct | gilt |

---

## E-001: Electron mit Vite, React und TypeScript

**Entscheidung:** Die App wird als Electron-Desktop-App für Windows gebaut, auf Basis der Vorlage `electron-vite`. Die Oberfläche nutzt React mit FullCalendar, die lokale Datenbank ist `better-sqlite3` im Main-Prozess.

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

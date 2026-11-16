# 📓 Arbeitsjournal

Laufendes Protokoll des Projekts. Der neuste Eintrag steht oben.

**So wird das Journal geführt:** Nach jedem Arbeitsschritt kommt ein Eintrag mit Datum dazu. Er hält fest, was gemacht wurde, was dabei aufgefallen ist und was als Nächstes ansteht. Grössere technische Entscheidungen wandern zusätzlich nach [ENTSCHEIDUNGEN.md](ENTSCHEIDUNGEN.md), erledigte Etappen werden in der [Roadmap im README](../README.md#-roadmap) abgehakt.

## Aktueller Stand

|                        |                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------- |
| **Etappe**             | 1 von 7 abgeschlossen (Grundgerüst)                                                     |
| **Als Nächstes**       | Etappe 2: Google-Login, Kalender lesen und anzeigen                                     |
| **Blockiert durch**    | nichts. Etappe 2 braucht aber die Google-Zugangsdaten                                   |
| **Offen bei Namir**    | Supabase-Projekt einrichten, danach Google Cloud und Azure (siehe [SETUP.md](SETUP.md)) |
| **Noch nicht geprüft** | Die Supabase-Anbindung ist geschrieben, aber nie gegen ein echtes Projekt gelaufen      |

---

## 2026-11-16 · Etappe 1: Grundgerüst, Supabase und neues Design

**Gemacht**

- Projekt mit `electron-vite` aufgesetzt (Electron 44, React 19, TypeScript, Vite 8).
- Datenschicht mit zwei Umsetzungen: Supabase und Arbeitsspeicher. Schema mit Zugriffsregeln unter `supabase/migrations`.
- IPC-API mit fünf Funktionen. Der Main-Prozess prüft alle Eingaben, das Fenster läuft in der Sandbox ohne Node.
- Kalenderansicht mit FullCalendar 7: Monat, Woche, Tag, hell und dunkel, Kalender ein- und ausblenden, Termin-Details als Popover.
- Demo-Provider, der Termine für vier Demo-Kalender berechnet.
- 26 Unit-Tests, dazu Prüfung an der laufenden App (siehe [TESTPLAN.md](TESTPLAN.md)).
- Windows-Installer gebaut und die paketierte App gestartet.
- Oberfläche nach dem Katalog von impeccable.style überarbeitet, Regeln in [DESIGN.md](DESIGN.md) festgehalten.

**Abweichungen vom Plan**

- **Supabase statt SQLite** auf Wunsch von Namir (E-008). Daraus folgt die anonyme Anmeldung mit Row Level Security (E-009).
- **FullCalendar 7** statt der im Plan gemeinten Version 6 (E-010).
- Die `.env`-Variablen heissen `MAIN_VITE_SUPABASE_URL` und `MAIN_VITE_SUPABASE_KEY`. Das Präfix hält sie aus der Oberfläche heraus.
- Tray-Icon ist noch nicht dabei, es kommt wie geplant in Etappe 7.

**Aufgefallen**

- Die Supabase-Anbindung konnte nicht getestet werden: Es gibt noch kein Projekt, und lokal fehlen Docker und Postgres. Schlägt die Verbindung fehl, fällt die App auf Demo-Daten zurück und zeigt den Grund an.
- Die Impeccable-Skills sind nachträglich ins Projekt installiert (`.claude/skills/impeccable`, ohne Hooks, Telemetrie aus). Der Detektor fand im Quellcode der Oberfläche nichts, konnte dort aber nur die Textmuster-Regeln prüfen, nicht die Regeln für die gerenderte Seite.
- Der Installer ist unsigniert. Windows zeigt beim Ausführen eine SmartScreen-Warnung.
- Die Demo-Daten (Anbieter `demo`) müssen in Etappe 2 wieder entfernt werden, auch aus Supabase.

**Als Nächstes**

- Namir richtet Supabase ein, dann wird die Anbindung geprüft.
- Etappe 2: Google-Login mit Loopback-OAuth und PKCE, Kalender lesen und anzeigen.

---

## 2026-11-16 · Projektstart: Plan und Dokumentation

**Gemacht**

- Projektplan für die Kalender-App festgehalten: Ziel, Tech-Stack, Architektur, Sync-Algorithmus, Etappen.
- README neu geschrieben mit Features, Sync-Ablauf und Architektur als Diagramm, Tech-Stack, Roadmap und Einrichtung.
- Dokumentation unter `docs/` angelegt:
  - [ARCHITEKTUR.md](ARCHITEKTUR.md): Aufbau, Datenmodell, Sync-Algorithmus
  - [ENTSCHEIDUNGEN.md](ENTSCHEIDUNGEN.md): die ersten sieben Entscheidungen aus dem Plan
  - [SETUP.md](SETUP.md): Anleitung für Google Cloud und Azure
  - [TESTPLAN.md](TESTPLAN.md): Unit-Tests und manuelle Testfälle
  - dieses Journal

**Aufgefallen**

- Es gibt noch keinen Code, das Repo enthält bis jetzt nur Dokumentation.
- Die Namen der `.env`-Variablen in [SETUP.md](SETUP.md) sind ein Vorschlag und werden in Etappe 2 und 3 festgelegt.

**Als Nächstes**

- Etappe 1 starten: Projekt mit `electron-vite` aufsetzen, SQLite-Schema anlegen, IPC-Grundgerüst, FullCalendar mit lokalen Dummy-Daten.

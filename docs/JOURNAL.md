# 📓 Arbeitsjournal

Laufendes Protokoll des Projekts. Der neuste Eintrag steht oben.

**So wird das Journal geführt:** Nach jedem Arbeitsschritt kommt ein Eintrag mit Datum dazu. Er hält fest, was gemacht wurde, was dabei aufgefallen ist und was als Nächstes ansteht. Grössere technische Entscheidungen wandern zusätzlich nach [ENTSCHEIDUNGEN.md](ENTSCHEIDUNGEN.md), erledigte Etappen werden in der [Roadmap im README](../README.md#-roadmap) abgehakt.

## Aktueller Stand

| | |
|---|---|
| **Etappe** | 0 von 7 abgeschlossen (Plan und Dokumentation) |
| **Als Nächstes** | Etappe 1: Grundgerüst mit `electron-vite`, SQLite, IPC und FullCalendar-UI mit Dummy-Daten |
| **Blockiert durch** | nichts |
| **Offen bei Namir** | Google Cloud und Azure einrichten (siehe [SETUP.md](SETUP.md)), wird ab Etappe 2 bzw. 3 gebraucht |

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

# 📓 Arbeitsjournal

Laufendes Protokoll des Projekts. Der neuste Eintrag steht oben.

**So wird das Journal geführt:** Nach jedem Arbeitsschritt kommt ein Eintrag mit Datum dazu. Er hält fest, was gemacht wurde, was dabei aufgefallen ist und was als Nächstes ansteht. Grössere technische Entscheidungen wandern zusätzlich nach [ENTSCHEIDUNGEN.md](ENTSCHEIDUNGEN.md), erledigte Etappen werden in der [Roadmap im README](../README.md#-roadmap) abgehakt.

## Aktueller Stand

|                     |                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------ |
| **Etappe**          | 1 von 7 abgeschlossen. Etappe 2 ist geschrieben, aber noch nicht mit einem echten Google-Konto geprüft |
| **Als Nächstes**    | Namir verbindet sein Google-Konto in der App, danach wird Etappe 2 geprüft                             |
| **Blockiert durch** | Die Google-Anmeldung im Browser kann nur Namir selbst abschliessen                                     |
| **Offen bei Namir** | Google Cloud einrichten, später Azure (siehe [SETUP.md](SETUP.md))                                     |

---

## 2026-11-16 · Google Cloud eingerichtet

**Gemacht**

- Google-Cloud-Projekt «easy-calender» (von Namir angelegt), Google Calendar API aktiviert.
- Google Auth Platform eingerichtet: App-Name «easy-Calender», Zielgruppe «Extern» im Testmodus, Namirs Gmail-Adresse als Kontakt und als Testnutzer. Die Nutzungsbedingungen und die Richtlinie zu Nutzerdaten hat Namir selbst angenommen.
- OAuth-Client vom Typ «Desktopanwendung» angelegt, Client-ID und Secret in `.env` eingetragen (Arbeitsordner und Hauptordner, nicht im Repository).
- App mit den Zugangsdaten neu gebaut und installiert.

**Geprüft**

- Die Anmeldung wurde aus der installierten App ausgelöst. Sie wurde im Browser nicht innerhalb von fünf Minuten abgeschlossen, die App hat das sauber als Zeitüberschreitung gemeldet.

**Nicht geprüft**

- Weiterhin der ganze Weg mit einem echten Google-Konto (A-11 bis A-14 im Testplan).

**Aufgefallen**

- Google weist darauf hin, dass neue Client-Einstellungen zwischen fünf Minuten und mehreren Stunden brauchen können, bis sie wirken.
- Im Testmodus laufen Refresh-Tokens bei Google nach sieben Tagen ab. Die App verlangt dann eine neue Anmeldung. Dauerhaft lösen lässt sich das nur, indem die App bei Google auf «In Produktion» gestellt wird.

---

## 2026-11-16 · Etappe 2: Google-Login und Google-Kalender (Code)

**Gemacht**

- Google-Anmeldung nach OAuth 2.0 für Desktop-Apps: Der Standardbrowser öffnet die Anmeldung und kommt auf einen lokalen Server zurück (127.0.0.1, zufälliger Port). PKCE und ein `state`-Wert sichern den Ablauf ab.
- Das Refresh-Token liegt verschlüsselt im Electron `safeStorage` (`tokens.bin`), nicht in Supabase.
- Google-Provider liest die Kalenderliste und die Termine eines Zeitraums. Ein Mapper wandelt Google-Termine ins normalisierte Modell um.
- Datenschicht erweitert: Konto speichern mit Abgleich der Kalender, Konto entfernen, Demo-Konten entfernen.
- Oberfläche: Knopf «Google-Konto verbinden», pro Konto «Konto entfernen». Fällt ein Kalender beim Laden aus, werden die anderen trotzdem angezeigt und der Grund gemeldet.
- Mit dem ersten echten Konto verschwinden die Demo-Daten. Wird das letzte Konto entfernt, kommen sie zurück.
- Version 0.2.0 als Installer gebaut und auf Namirs Rechner installiert (Desktop-Verknüpfung und Startmenü).

**Geprüft**

- 47 Unit-Tests bestanden, darunter der Rückweg der Anmeldung (richtiger und falscher `state`, Abbruch, Zeitüberschreitung) und der Google-Mapper.
- An der laufenden App: Termine laden, Kalender ausblenden, Fehlermeldung beim Verbinden ohne Zugangsdaten, Ablehnen ungültiger Eingaben.
- Die installierte App startet und verbindet sich mit Supabase.

**Nicht geprüft**

- Der gesamte Weg mit einem echten Google-Konto: Anmeldung im Browser, Tausch des Codes, Kalender und Termine von Google lesen, Konto entfernen. Dafür fehlen die Zugangsdaten des OAuth-Clients.

**Aufgefallen**

- Die Google Cloud Console verlangt beim ersten Besuch, dass Namir die Nutzungsbedingungen annimmt. Das ist seine Entscheidung und wurde nicht für ihn angeklickt.
- Statt `googleapis` wird das kleinere `@googleapis/calendar` verwendet (E-012).
- Zeitpunkte im Event-Modell dürfen jetzt eine Zeitverschiebung tragen, so wie Google sie liefert.
- Ausgeblendete Kalender werden nicht mehr abgefragt. Das spart Anfragen bei Google.

**Als Nächstes**

- Google Cloud einrichten (Projekt, Calendar API, Zustimmungsbildschirm mit Testnutzer, OAuth-Client «Desktop app») und Etappe 2 mit dem echten Konto prüfen.

---

## 2026-11-16 · Supabase eingerichtet und geprüft

**Gemacht**

- Supabase-Projekt «easy-Calender» angelegt (Organisation Pomodoro-Timer, Gratis-Tarif, Region Europa).
- Schema aus `supabase/migrations` über den SQL-Editor eingespielt, «Allow anonymous sign-ins» aktiviert.
- `.env` mit Projekt-URL und Publishable Key angelegt, im Arbeitsordner und im Hauptordner. Die Datei ist nicht im Repository.
- Impeccable-Skills ins Projekt aufgenommen (`.claude/skills/impeccable`).
- Etappe 1 nach `main` gebracht.

**Geprüft an der laufenden App**

- Status «Supabase verbunden», die Demo-Konten und -Kalender liegen in der Datenbank.
- Kalender aus- und wieder einblenden wird in Supabase gespeichert und richtig zurückgelesen.
- Nach einem Neustart meldet sich die App mit derselben Sitzung an, es entstehen keine doppelten Demo-Daten.
- Zugriffsregeln: Ohne Anmeldung liefert die Datenbank keine Zeilen, Schreiben wird mit 401 abgelehnt.

**Aufgefallen**

- Das Datenbank-Passwort hat Supabase erzeugt, es ist nirgends notiert. Die App braucht es nicht. Bei Bedarf lässt es sich im Dashboard unter «Database → Settings» neu setzen.
- Im Gratis-Tarif pausiert Supabase ein Projekt nach längerer Inaktivität. Dann zeigt die App «Supabase-Fehler» und fällt auf Demo-Daten zurück, bis das Projekt im Dashboard wieder gestartet wird.

**Als Nächstes**

- Etappe 2: Google-Login mit Loopback-OAuth und PKCE, Kalender lesen und anzeigen. Dafür braucht es die Google-Zugangsdaten.

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

# 📓 Arbeitsjournal

Laufendes Protokoll des Projekts. Der neuste Eintrag steht oben.

**So wird das Journal geführt:** Nach jedem Arbeitsschritt kommt ein Eintrag mit Datum dazu. Er hält fest, was gemacht wurde, was dabei aufgefallen ist und was als Nächstes ansteht. Grössere technische Entscheidungen wandern zusätzlich nach [ENTSCHEIDUNGEN.md](ENTSCHEIDUNGEN.md), erledigte Etappen werden in der [Roadmap im README](../README.md#-roadmap) abgehakt.

## Aktueller Stand

|                     |                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Etappe**          | Alle sieben Etappen sind gebaut und mit echten Konten geprüft. Version 0.12.0 bringt den Assistenten (Chatbot) |
| **Als Nächstes**    | Ollama installieren und den Assistenten mit dem echten Modell prüfen. Danach: Personen einladen                |
| **Blockiert durch** | Ollama ist noch nicht installiert. Das macht Namir selbst                                                      |
| **Offen bei Namir** | Ollama installieren, Modell `qwen2.5:3b` laden. Welche echten Kalender abgeglichen werden sollen               |

---

## 2026-11-17 · Assistent mit lokalem Modell (Version 0.12.0)

Namirs Wunsch: ein eingebauter Chatbot, dem er Termine schreibt und der sie in den richtigen Kalender einträgt. Er soll nichts kosten, stark muss er nicht sein (E-018).

**Gemacht**

- Knopf «Assistent» in der Seitenleiste. Er öffnet rechts eine Spalte mit dem Gespräch.
- Der Assistent schickt die Nachricht an Ollama auf diesem Rechner (`127.0.0.1:11434`). Das Modell muss nach einem festen JSON-Schema antworten: Titel, Tag, Uhrzeiten, Kalender, Ort, Notiz, oder eine Rückfrage.
- Kleine Modelle rechnen schlecht mit Daten. Darum bekommt das Modell ein fertiges Kalenderblatt der nächsten vier Wochen («Mittwoch 18.11. = 2026-11-18 (morgen)») und muss nur nachschlagen. Die Uhrzeiten rechnet die App selbst um.
- Eingetragen wird nie direkt. Der Assistent zeigt einen Vorschlag mit «Eintragen», «Ändern» (öffnet das normale Formular, schon ausgefüllt) und «Verwerfen».
- Ist etwas unklar oder unstimmig (kein Tag, 30. Februar), fragt der Assistent nach, statt etwas Falsches einzutragen.
- Läuft Ollama nicht oder fehlt das Modell, zeigt die Spalte eine Anleitung.

**Geprüft**

- 102 Unit-Tests bestanden. Neu: Kalenderblatt, Umwandlung der Antwort (Uhrzeit, ohne Ende, über Mitternacht, ganztägig, mehrtägig, Rückfragen), Wahl des Modells, Prüfung des Verlaufs, Gespräch mit einem nachgebauten Ollama.
- An der installierten App: Die Spalte öffnet sich und zeigt ohne Ollama die Anleitung. Eine Nachricht ergibt eine verständliche Meldung statt eines Fehlers.

**Nicht geprüft**

- Das Gespräch mit dem echten Modell. Ollama ist noch nicht installiert.

---

## 2026-11-17 · Einstellungen pro Kalender (Version 0.11.0)

Namirs Wunsch: Die vielen mitgelieferten Kalender (Feiertage, Familie, Claude, Sync-Test) sollen weg, eigene Kalender sollen sich anlegen und einfärben lassen, vom Noser-Kalender sollen nur ganztägige Termine erscheinen.

**Gemacht**

- Jeder Kalender hat in der Seitenleiste einen Knopf «···» mit drei Einstellungen: Farbe, «Nur ganztägige Termine zeigen» und «Aus der App entfernen».
- «Entfernen» heisst: Der Kalender verschwindet aus der App, bei Google oder Outlook bleibt er bestehen. Unter «Entfernte Kalender» lässt er sich zurückholen. Gelöscht wird beim Anbieter nichts.
- In Outlook-Konten gibt es «Neuer Kalender». Er wird als leerer Kalender im Konto angelegt.
- Die Einstellungen liegen in `settings.json` auf dem Gerät, nicht in Supabase. So braucht es keine Änderung am Datenbankschema.
- Auf Namirs Wunsch eingestellt: Feiertage (vier Kalender), Familie, Claude und beide Sync-Test sind aus der App entfernt. Vom Noser-Kalender erscheinen nur ganztägige Termine.

**Geprüft** (installierte App)

- 92 Unit-Tests bestanden.
- Nach dem Einstellen zeigt die Seitenleiste noch sechs Kalender und «Entfernte Kalender (8)». Der Noser-Kalender liefert 14 Termine, keiner mit Uhrzeit.

**Nicht geprüft**

- «Neuer Kalender» in der installierten App (die Funktion dahinter lief beim Anlegen des Testkalenders), Farbe ändern über die Oberfläche.

**Offen**

- Neue Kalender in Google: Dafür reicht die Berechtigung der App nicht. Es bräuchte eine zusätzliche Zustimmung bei Google.
- Chatbot und Einladungen: noch nicht gebaut, siehe «Aktueller Stand».

---

## 2026-11-17 · Abgleich an echten Kalendern geprüft (Version 0.10.2)

**Vorbereitet**

- Namir hatte gemeldet, die Testkalender seien angelegt. Sie fehlten. Auf seinen Auftrag habe ich sie angelegt: «Sync-Test» im BMZ-Konto über das lokale Outlook, «Sync-Test» in Google über die Kalender-Seite im Browser.
- Dabei ist in Google ein zweiter, gleichnamiger Kalender entstanden, weil der erste Klick scheinbar nichts tat. Er ist leer und kann gelöscht werden.

**Geprüft** (installierte App, nur die zwei Testkalender, am Schluss wieder leer)

- M-1: Termin in Google erstellt, erscheint in Outlook mit Titel, Zeit, Ort und Notiz.
- M-2: In Outlook geändert, Änderung kommt in Google an.
- Ganztägiger Termin von Outlook nach Google, mit richtigem Beginn und Ende.
- M-4: Wöchentliche Serie von Google nach Outlook, vier Termine im Wochenabstand.
- M-3: In Google gelöscht, verschwindet in Outlook.
- M-5: Beide Seiten geändert, die jüngere Änderung gewinnt.
- Nach jedem Schritt ein zweiter Lauf: «Alles auf dem gleichen Stand», kein Ping-Pong.

**Gefunden und behoben**

- Outlook verfälscht Umlaute in der Notiz beim Speichern: Aus «äöü» wird «äöü» plus Zeichenmüll. Titel und Ort sind nicht betroffen, das Lesen auch nicht. Das ist ein Fehler dieser Outlook-Version (16.0.20527). Vier andere Schreibwege (RTF, HTML, MAPI-Eigenschaft, Texteditor) lässt Outlook von aussen nicht zu.
- Lösung (E-017): Notizen gehen nur mit ASCII nach Outlook («Zuerich»). Kommt eine solche Notiz beim Abgleich zurück, behält Google seine Fassung mit Umlauten.

**Aufgefallen**

- Der Versuch mit dem Texteditor hat Outlook zum Absturz gebracht. Es startet beim nächsten Zugriff wieder. Dieser Weg wird nicht verwendet.

**Nachtrag**

- Den doppelten, leeren Google-Kalender «Sync-Test» auf Namirs Auftrag gelöscht. Vorher an der Kalender-ID geprüft, dass es der unverbundene ist. Der verbundene Testkalender und das Paar bestehen weiter.

**Nicht geprüft**

- M-6 (Neustart ohne Duplikate) als eigener Schritt, Ausnahmen einer Serie (bewusst nicht abgeglichen), A-14, A-20, A-22, A-23.

---

## 2026-11-17 · Outlook verbunden (Version 0.10.1)

**Gemacht**

- Fehler behoben: In der installierten App scheiterte «Outlook verbinden» mit «Outlook hat eine unlesbare Antwort gegeben». Der Pfad zum Brückenskript zeigte ins App-Archiv, wo PowerShell nicht lesen kann. Er zeigt jetzt auf die entpackte Kopie daneben. In der Entwicklung fiel das nicht auf, weil es dort kein Archiv gibt.
- In der Auswahl für den Abgleich steht hinter jedem Kalender das Konto. Vorher gab es zweimal «Kalender» ohne Unterschied.

**Geprüft** (an der installierten App)

- «Outlook verbinden»: Beide Konten aus Outlook (classic) erscheinen mit je drei Kalendern, 23 und 5 Termine im Zeitraum von 7 Tagen zurück bis 30 Tage voraus. Google bleibt daneben bestehen, keine Fehlermeldung.

**Nicht geprüft**

- Schreiben ins Outlook und der Abgleich.

**Gelernt**

- Namir hatte gemeldet, die Kalender seien da, bevor die Verbindung stand. Solche Meldungen prüfe ich an der App nach, bevor ich darauf aufbaue.

---

## 2026-11-17 · Outlook ohne Azure: über das lokale Outlook (Version 0.10.0)

Namir wollte einen Weg ohne Azure, nachdem beide Schulen die App-Registrierung sperren.

**Gemacht**

- Die App spricht mit dem auf dem Rechner installierten Outlook (classic) statt mit Microsofts Servern. Ein kleines PowerShell-Skript (`resources/outlook.ps1`) liest und schreibt Termine über das Objektmodell von Outlook. Outlook gleicht sie selbst mit seinem Server ab.
- Neuer Anbieter `OutlookLocalProvider` mit derselben Schnittstelle wie Google. Die Sync-Engine bleibt unverändert.
- Der Knopf heisst jetzt «Outlook verbinden». Er übernimmt alle Konten, die in Outlook (classic) einen Kalender haben. Eine Anmeldung braucht es nicht.
- Der Weg über Microsoft Graph bleibt im Code. Er wird nur verwendet, wenn `MAIN_VITE_MS_CLIENT_ID` gesetzt ist.

**Geprüft**

- 87 Unit-Tests bestanden, neu der Mapper, die Übersetzung der Serien und die Brücke.
- Das Skript lesend gegen Namirs Outlook: zwei Konten mit je drei Kalendern, Termine mit Uhrzeit, ganztägige, einzelne Vorkommen und Serien, Umlaute und Notizen kommen richtig an. Eine Abfrage dauert etwa eine halbe Sekunde.

**Nicht geprüft**

- Schreiben ins lokale Outlook (erstellen, ändern, löschen) und der Abgleich. Das soll zuerst an einem Testkalender geschehen.
- Der Knopf «Outlook verbinden» in der installierten App.

**Aufgefallen**

- In Outlook (classic) sind das BMZ-Konto und das Noser-Young-Konto eingerichtet, das TBZ-Konto nicht.
- Entscheidung dazu: E-016.

---

## 2026-11-17 · Azure-Registrierung: Schulkonten gesperrt

**Versucht**

- App-Registrierung mit dem TBZ-Konto und mit dem BMZ-Konto, im Azure-Portal und im Entra Admin Center.

**Ergebnis**

- Beide Schulen sperren den Bereich «App-Registrierungen»: «Sie haben keinen Zugriff», Fehlercode 401. Registriert wurde nichts.
- Das Noser-Young-Konto wurde bewusst nicht versucht. Eine private App gehört nicht ins Verzeichnis des Arbeitgebers.

**Als Nächstes**

- Namir meldet sich mit einem privaten Microsoft-Konto an (outlook.com oder hotmail.com), dann wird die App dort registriert.
- Offen bleibt, ob TBZ und BMZ die Zustimmung zu fremden Apps erlauben. Das zeigt sich erst beim Verbinden eines Schulkontos in der App.

---

## 2026-11-17 · Google mit echtem Konto geprüft

**Gemacht**

- Namir hat sein Google-Konto in der installierten Version 0.9.0 verbunden. Diesmal ist das Token gespeichert.

**Geprüft** (an der laufenden App, nur lesend)

- Ein Google-Konto, sechs Kalender mit ihren Google-Farben. Die Beispielkonten sind verschwunden.
- 35 Termine im Zeitraum von 30 Tagen zurück bis 60 Tage voraus, davon 29 ganztägig. Zeiten kommen mit Zeitverschiebung an, keine doppelten IDs, keine Fehlermeldung.
- Nach einem Neustart der App sind Konto, Kalender und Termine ohne neue Anmeldung da.

**Nicht geprüft**

- Termine in einem Google-Kalender erstellen, ändern und löschen. Das würde in Namirs echten Kalender schreiben und braucht seinen Auftrag.
- Google-Konto entfernen (A-14), Microsoft, Abgleich.

---

## 2026-11-16 · Etappen 3 bis 7 geschrieben (Version 0.9.0)

Namirs Auftrag: das ganze Projekt fertig machen.

**Vorab geklärt**

- Namir meldete zweimal, er sei mit Google verbunden. Die App zeigte aber weiter nur die Beispielkonten, ein Google-Token war nie gespeichert. Vermutlich wurden die Beispielkalender für die eigenen gehalten. Darum steht jetzt über den Beispielkonten ein Hinweis «Das sind Beispieldaten».
- Geprüft, ob Firefox den Rückweg der Anmeldung erreicht: ja, sowohl über `127.0.0.1` als auch über `localhost`. Der «Seiten-Ladefehler» in Firefox stammte von einem alten Tab einer abgebrochenen Anmeldung.

**Gemacht**

- **Etappe 3, Microsoft:** Anmeldung über den Browser mit PKCE, ohne Secret. Outlook-Kalender und -Termine über Microsoft Graph lesen und schreiben. Mapper zwischen Graph und dem normalisierten Modell.
- **Etappe 4, Termine bearbeiten:** Formular zum Erstellen und Ändern, Löschen aus dem Detailfenster. Ein Zeitraum lässt sich im Kalender mit der Maus aufziehen. Alles, was die Oberfläche schickt, wird im Main-Prozess geprüft.
- **Etappe 5, Abgleich:** Sync-Engine für Kalenderpaare Google ↔ Outlook. Neue, geänderte und gelöschte Termine wandern in beide Richtungen. Bei Konflikten gewinnt die jüngere Änderung. Der Abgleich läuft alle fünf Minuten, nach Änderungen in der App und auf Knopfdruck.
- **Etappe 6, Serien:** Serien werden als Ganzes mit ihrer Regel abgeglichen. RRULE und das Graph-Format werden ineinander übersetzt (täglich, wöchentlich, monatlich, jährlich, mit Intervall, Wochentagen und Ende).
- **Etappe 7, Feinschliff:** Symbol im Infobereich, Weiterlaufen im Hintergrund, Start mit Windows, nur eine laufende App, Bereich «Synchronisation» mit Stand und Meldungen.

**Geprüft**

- 80 Unit-Tests bestanden. Neu: die Sync-Engine (13 Fälle, darunter kein Ping-Pong, Konflikt, Löschen, Wiederherstellen, Sicherheitsstopp), der Graph-Mapper, die Übersetzung der Serien und die Eingabeprüfung.
- An der gebauten App mit Beispieldaten: Termin erstellen, Fehlermeldung bei «Ende vor Beginn», Detailfenster, Termin ändern. Die Seitenleiste zeigt Hinweis, beide Verbinden-Knöpfe, Synchronisation und Einstellungen.

**Nicht geprüft**

- Alles, was ein echtes Konto braucht: Google-Anmeldung bis zum Schluss, die ganze Microsoft-Seite, der Abgleich zwischen zwei echten Kalendern, Serien bei beiden Anbietern. Dieser Code ist nur durch Unit-Tests abgedeckt.
- Löschen eines Termins über die Oberfläche, Symbol im Infobereich, Start mit Windows.

**Aufgefallen und entschieden**

- Statt MSAL und Graph-Client spricht die App direkt mit den Microsoft-Endpunkten (E-013).
- Der Abgleich vergleicht Listen statt Delta-Tokens zu verwenden und merkt sich pro Seite einen Fingerabdruck (E-014).
- Ausnahmen einer Serie (ein einzelner verschobener Termin) werden nicht abgeglichen (E-015).

**Als Nächstes**

- Google-Konto verbinden, Azure-Registrierung, dann die manuellen Sync-Tests mit zwei Testkalendern.

---

## 2026-11-16 · Anmeldung mit Notausgängen (Version 0.2.1)

**Gemacht**

- Namir meldete, beim Verbinden sei kein Browser aufgegangen. Zwei Anmeldungen waren zuvor nach fünf Minuten abgelaufen.
- Während die App auf die Anmeldung wartet, zeigt sie jetzt drei Auswege: «Seite nochmals öffnen», «Link kopieren» und «Abbrechen». Vorher blieb der Knopf fünf Minuten gesperrt, ohne Ausweg.
- Version 0.2.1 gebaut und installiert.

**Geprüft**

- 48 Unit-Tests bestanden, neu der Abbruch von der App aus.
- An der installierten App: Nach dem Klick wechselt der Titel des Firefox-Fensters auf «Anmelden – Google Konten». Die App öffnet den Browser also. Der kopierte Link ist die Google-Anmeldeadresse mit Rückweg auf 127.0.0.1. «Abbrechen» gibt den Knopf sofort wieder frei.

**Aufgefallen**

- Die Anmeldeseite geht als neuer Tab im bestehenden Firefox-Fenster auf. Liegt das Fenster im Hintergrund, sieht es aus, als passiere nichts.

**Nicht geprüft**

- Weiterhin A-11 bis A-14: Die Anmeldung selbst muss Namir im Browser abschliessen.

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

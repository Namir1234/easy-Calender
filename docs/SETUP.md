# 🔑 Setup

Ohne Einrichtung startet die App mit Demo-Daten. Für den echten Betrieb musst du sie einmalig bei drei Diensten registrieren. Alle drei sind gratis.

> **Hinweis:** Die Menünamen in den Portalen ändern sich ab und zu. Wenn ein Punkt bei dir anders heisst, such nach dem Begriff in der Suchleiste des Portals.

## Checkliste

- [x] Supabase: Projekt erstellt
- [x] Supabase: Schema eingespielt
- [x] Supabase: «Anonymous sign-ins» aktiviert
- [x] Supabase: URL und Publishable Key in `.env`
- [x] Google Cloud: Projekt erstellt, Calendar API aktiviert
- [x] Google Cloud: OAuth-Client «Desktop app» angelegt, eigenes Konto als Testnutzer eingetragen
- [x] Google Cloud: OAuth-Client «Webanwendung» für die Handy-Version
- [x] GitHub: Pages mit Quelle «GitHub Actions» eingeschaltet
- [ ] Azure: App registriert, Berechtigungen gesetzt, Anwendungs-ID in `.env`

## 1. Supabase

In Supabase liegen die verbundenen Konten, die Kalender und später der Sync-Zustand. Tokens von Google und Microsoft werden dort nicht gespeichert.

> **Stand:** Für Namirs Installation ist das am 2026-11-16 erledigt und geprüft. Die Schritte gelten für eine neue Einrichtung.

1. Erstelle auf [supabase.com](https://supabase.com/) ein neues Projekt.
2. Öffne den **SQL Editor**, füge den Inhalt von [`supabase/migrations/20261116000000_init.sql`](../supabase/migrations/20261116000000_init.sql) ein und führe ihn aus. Das legt die Tabellen und die Zugriffsregeln an.
3. Aktiviere unter **Authentication → Sign In / Providers** die Option **«Allow anonymous sign-ins»**. Die App meldet sich beim ersten Start anonym an, und alle Zeilen gehören diesem Benutzer.
4. Kopiere unter **Project Settings → API** die **Project URL** und den **Publishable Key** (früher «anon key»).

> [!CAUTION]
> Verwende nie den **Secret Key** (früher «service_role key»). Er umgeht alle Zugriffsregeln. Die App lehnt ihn ab.

## 2. Google Cloud Console (ab Etappe 2)

1. Öffne die [Google Cloud Console](https://console.cloud.google.com/) und erstelle ein neues Projekt.
2. Aktiviere unter «APIs und Dienste» die **Google Calendar API**.
3. Richte den OAuth-Zustimmungsbildschirm ein und trage dein eigenes Google-Konto als **Testnutzer** ein.
4. Lege unter «Anmeldedaten» einen **OAuth-Client** vom Typ **«Desktop app»** an.
5. Notiere **Client-ID** und **Client-Secret** und trag sie in `.env` ein (siehe unten).

Die App fragt bei der Anmeldung diese Berechtigungen an: E-Mail-Adresse, Kalenderliste lesen, Termine lesen und schreiben. Solange die App bei Google im Testmodus ist, zeigt Google bei der Anmeldung einen Hinweis «Google hat diese App nicht überprüft». Für den Eigengebrauch ist das in Ordnung. Im Testmodus läuft die Anmeldung allerdings nach sieben Tagen ab, dann muss das Konto in der App neu verbunden werden.

Beim Typ «Desktop app» muss keine Redirect-URI eingetragen werden. Die App verwendet `http://127.0.0.1` mit einem zufälligen Port.

## 3. Outlook

**Normalfall, ohne Registrierung:** Die App verwendet das auf dem Rechner installierte Outlook (classic). Voraussetzung ist nur, dass dein Konto dort eingerichtet ist. In der App genügt dann ein Klick auf «Outlook verbinden». Mit dem «neuen Outlook» geht das nicht.

**Alternative über Azure:** Nur nötig, wenn du ohne lokales Outlook arbeiten willst. Schulen und Firmen sperren diesen Weg oft.

1. Öffne das [Azure Portal](https://portal.azure.com/) und geh zu «App-Registrierungen».
2. Erstelle eine neue Registrierung mit diesen Einstellungen:

   | Einstellung             | Wert                                                                                 |
   | ----------------------- | ------------------------------------------------------------------------------------ |
   | Name                    | easy-Calender                                                                        |
   | Unterstützte Kontotypen | Konten in einem beliebigen Organisationsverzeichnis und persönliche Microsoft-Konten |
   | Plattform               | Mobilgerät- und Desktopanwendungen (öffentlicher Client)                             |
   | Redirect-URI            | `http://localhost`                                                                   |

3. Füge unter «API-Berechtigungen» die delegierten Microsoft-Graph-Berechtigungen **`Calendars.ReadWrite`**, **`User.Read`**, **`offline_access`**, **`openid`** und **`email`** hinzu.
4. Kopiere die **Anwendungs-ID (Client-ID)** von der Übersichtsseite und trag sie als `MAIN_VITE_MS_CLIENT_ID` in `.env` ein. Ein Secret braucht es nicht.

Die Redirect-URI muss genau `http://localhost` heissen, ohne Port. Die App hängt beim Anmelden einen zufälligen Port an, das erlaubt Microsoft bei `localhost`.

> [!WARNING]
> Bei TBZ- oder Noser-Konten kann die Organisation die Zustimmung für Dritt-Apps blockieren. Dann funktionieren nur private Microsoft-Konten, bis ein Admin die App freigibt.

## 4. Assistent (Ollama)

Der Assistent braucht ein Sprachmodell auf deinem Rechner. Das ist gratis und nichts geht ins Internet.

1. Ollama von [ollama.com](https://ollama.com/download) herunterladen und installieren. Es startet danach von selbst im Hintergrund.
2. Ein Terminal öffnen und das Modell laden (etwa 2 GB):

   ```bash
   ollama pull qwen2.5:3b
   ```

3. In easy-Calender auf «Assistent» klicken. Steht dort eine Anleitung, auf «Nochmals prüfen».

Arbeitsspeicher: Das Modell braucht etwa 2 bis 3 GB. Wer mehr Speicher hat und genauere Antworten will, kann ein grösseres Modell laden (z. B. `qwen2.5:7b`, etwa 5 GB). Die App nimmt `qwen2.5:3b`, wenn es da ist, sonst das erste geladene Modell.

## 5. Handy-Version (Web-App)

Die Handy-Version läuft unter **https://namir1234.github.io/easy-Calender/**. Damit die Anmeldung dort geht, braucht es zwei Einstellungen, die nur du machen kannst.

**GitHub Pages einschalten (einmalig)**

1. Öffne auf GitHub das Repository → **Settings → Pages**.
2. Wähle bei **Source** die Option **«GitHub Actions»**.
3. Unter **Actions** den Ablauf «Handy-Version» starten (**Run workflow**) oder etwas auf main pushen.

**Google-Client für das Web (einmalig)**

1. Öffne die [Google Cloud Console](https://console.cloud.google.com/) im selben Projekt wie für die Desktop-App.
2. Unter «APIs und Dienste → Anmeldedaten» einen neuen **OAuth-Client** vom Typ **«Webanwendung»** anlegen.
3. Bei **Autorisierte JavaScript-Quellen** eintragen:
   - `https://namir1234.github.io`
   - `http://localhost:5174` (zum Ausprobieren am PC)
4. Weiterleitungs-URIs braucht es keine.
5. Die **Client-ID** (endet auf `.apps.googleusercontent.com`) in `web/src/config.ts` bei `COMMITTED_CLIENT_ID` eintragen. Sie ist nicht geheim. Ein Client-Secret braucht die Web-App nicht.

**Auf das Handy legen**

- **iPhone:** Die Adresse in Safari öffnen → Teilen → «Zum Home-Bildschirm».
- **Android:** In Chrome öffnen → Menü → «Zum Startbildschirm hinzufügen».

Die Anmeldung gilt eine Stunde. Danach zeigt die App «Wieder anmelden». Ein Tipp darauf genügt meist.

**Lokal ausprobieren:** `npm run web:dev` startet sie unter http://localhost:5174. Mit `?demo` in der Adresse läuft sie mit Beispieldaten.

## 6. Die Datei .env

Kopiere [`.env.example`](../.env.example) nach `.env` in den Projektordner und trage die Werte ein. Starte die App danach neu.

```env
MAIN_VITE_SUPABASE_URL=https://dein-projekt.supabase.co
MAIN_VITE_SUPABASE_KEY=sb_publishable_...
MAIN_VITE_GOOGLE_CLIENT_ID=....apps.googleusercontent.com
MAIN_VITE_GOOGLE_CLIENT_SECRET=...
MAIN_VITE_MS_CLIENT_ID=00000000-0000-0000-0000-000000000000
```

- Das Präfix `MAIN_VITE_` sorgt dafür, dass die Werte nur im Main-Prozess sichtbar sind, nie in der Oberfläche.
- `.env` ist über `.gitignore` vom Repository ausgeschlossen.
- Die Werte werden beim Bauen fest in die App übernommen. Nach einer Änderung an `.env` muss die App neu gestartet (`npm run dev`) bzw. neu gebaut und installiert werden (`npm run build`).

Ob die Verbindung steht, siehst du unten links in der App: «Supabase verbunden», «Demo-Daten» oder «Supabase-Fehler» mit dem Grund.

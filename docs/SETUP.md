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

## 3. Azure Portal (Microsoft)

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

## 4. Die Datei .env

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

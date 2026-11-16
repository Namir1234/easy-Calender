# 🔑 Setup

Ohne Einrichtung startet die App mit Demo-Daten. Für den echten Betrieb musst du sie einmalig bei drei Diensten registrieren. Alle drei sind gratis.

> **Hinweis:** Die Menünamen in den Portalen ändern sich ab und zu. Wenn ein Punkt bei dir anders heisst, such nach dem Begriff in der Suchleiste des Portals.

## Checkliste

- [ ] Supabase: Projekt erstellt
- [ ] Supabase: Schema eingespielt
- [ ] Supabase: «Anonymous sign-ins» aktiviert
- [ ] Supabase: URL und Publishable Key in `.env`
- [ ] Google Cloud: Projekt erstellt, Calendar API aktiviert (ab Etappe 2)
- [ ] Google Cloud: OAuth-Client «Desktop app» angelegt, eigenes Konto als Testnutzer eingetragen
- [ ] Azure: App registriert, Berechtigungen gesetzt (ab Etappe 3)

## 1. Supabase

In Supabase liegen die verbundenen Konten, die Kalender und später der Sync-Zustand. Tokens von Google und Microsoft werden dort nicht gespeichert.

> **Stand:** Der Supabase-Teil der App ist geschrieben, aber noch nie gegen ein echtes Projekt gelaufen. Wenn beim ersten Verbinden etwas nicht klappt, zeigt die App den Grund unten links an.

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
5. Notiere **Client-ID** und **Client-Secret**.

## 3. Azure Portal (ab Etappe 3)

1. Öffne das [Azure Portal](https://portal.azure.com/) und geh zu «App-Registrierungen».
2. Erstelle eine neue Registrierung mit diesen Einstellungen:

   | Einstellung             | Wert                                                                                 |
   | ----------------------- | ------------------------------------------------------------------------------------ |
   | Unterstützte Kontotypen | Konten in einem beliebigen Organisationsverzeichnis und persönliche Microsoft-Konten |
   | Art des Clients         | öffentlicher Client (Mobilgerät und Desktop)                                         |
   | Redirect-URI            | `http://localhost`                                                                   |

3. Füge unter «API-Berechtigungen» die delegierten Microsoft-Graph-Berechtigungen **`Calendars.ReadWrite`** und **`offline_access`** hinzu.
4. Notiere die **Anwendungs-ID (Client-ID)**.

> [!WARNING]
> Bei TBZ- oder Noser-Konten kann die Organisation die Zustimmung für Dritt-Apps blockieren. Dann funktionieren nur private Microsoft-Konten, bis ein Admin die App freigibt.

## 4. Die Datei .env

Kopiere [`.env.example`](../.env.example) nach `.env` in den Projektordner und trage die Werte ein. Starte die App danach neu.

```env
MAIN_VITE_SUPABASE_URL=https://dein-projekt.supabase.co
MAIN_VITE_SUPABASE_KEY=sb_publishable_...
```

- Das Präfix `MAIN_VITE_` sorgt dafür, dass die Werte nur im Main-Prozess sichtbar sind, nie in der Oberfläche.
- `.env` ist über `.gitignore` vom Repository ausgeschlossen.
- Die Variablen für Google und Microsoft kommen in Etappe 2 und 3 dazu und werden hier nachgeführt.

Ob die Verbindung steht, siehst du unten links in der App: «Supabase verbunden», «Demo-Daten» oder «Supabase-Fehler» mit dem Grund.

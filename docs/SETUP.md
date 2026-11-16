# 🔑 Setup

Damit die App auf deine Kalender zugreifen darf, musst du sie einmalig bei Google und bei Microsoft registrieren. Beides ist gratis.

> **Hinweis:** Die Menünamen in den beiden Portalen ändern sich ab und zu. Wenn ein Punkt bei dir anders heisst, such nach dem Begriff in der Suchleiste des Portals.

## Checkliste

- [ ] Google Cloud: Projekt erstellt
- [ ] Google Cloud: Calendar API aktiviert
- [ ] Google Cloud: OAuth-Client «Desktop app» angelegt
- [ ] Google Cloud: eigenes Konto als Testnutzer eingetragen
- [ ] Azure: App registriert
- [ ] Azure: Berechtigungen gesetzt
- [ ] `.env` ausgefüllt

## 1. Google Cloud Console

1. Öffne die [Google Cloud Console](https://console.cloud.google.com/) und erstelle ein neues Projekt.
2. Aktiviere unter «APIs und Dienste» die **Google Calendar API**.
3. Richte den OAuth-Zustimmungsbildschirm ein und trage dein eigenes Google-Konto als **Testnutzer** ein.
4. Lege unter «Anmeldedaten» einen **OAuth-Client** vom Typ **«Desktop app»** an.
5. Notiere **Client-ID** und **Client-Secret**.

## 2. Azure Portal

1. Öffne das [Azure Portal](https://portal.azure.com/) und geh zu «App-Registrierungen».
2. Erstelle eine neue Registrierung mit diesen Einstellungen:

   | Einstellung | Wert |
   |---|---|
   | Unterstützte Kontotypen | Konten in einem beliebigen Organisationsverzeichnis und persönliche Microsoft-Konten |
   | Art des Clients | öffentlicher Client (Mobilgerät und Desktop) |
   | Redirect-URI | `http://localhost` |

3. Füge unter «API-Berechtigungen» die delegierten Microsoft-Graph-Berechtigungen **`Calendars.ReadWrite`** und **`offline_access`** hinzu.
4. Notiere die **Anwendungs-ID (Client-ID)**.

> [!WARNING]
> Bei TBZ- oder Noser-Konten kann die Organisation die Zustimmung für Dritt-Apps blockieren. Dann funktionieren nur private Microsoft-Konten, bis ein Admin die App freigibt.

## 3. Die Datei .env

Die Werte kommen in eine Datei `.env` im Projektordner.

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MS_CLIENT_ID=
```

> Die Variablennamen sind ein Vorschlag. Sie werden in Etappe 2 und 3 festgelegt und hier nachgeführt.

**Wichtig:** `.env` gehört nicht ins Git-Repository. Sobald das Grundgerüst steht, wird die Datei über `.gitignore` ausgeschlossen.

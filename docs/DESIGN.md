# 🎨 Design

Die Gestaltungsregeln der Oberfläche. Wer etwas an der UI ändert, hält sich daran oder passt dieses Dokument an.

Seit Version 0.15.0 folgt die Oberfläche [Hallmark](https://github.com/Nutlope/hallmark), Theme **Dose**: warmes Papier mit feiner Faser, getönter Kunststoff, grün-schwarze Tinte und ein einziges Grün. Hallmark prüft mit `sloplint` gegen eine Liste typischer Merkmale von KI-generierten Oberflächen. Der Stempel oben in [`main.css`](../src/renderer/src/assets/main.css) und [`web.css`](../web/src/web.css) hält fest, welches Theme und welche Entscheidungen gelten.

## Vier Designs zur Wahl

In den Einstellungen (Desktop) und im Kalender-Blatt (Handy) lässt sich das Design wechseln. Die Wahl gilt nur auf dem Gerät und wird im `localStorage` gespeichert. Jedes Design gibt es hell und dunkel. Darunter steht «Hell oder dunkel» mit «Wie das System» (Standard), «Hell» und «Dunkel», gespeichert unter `easy-calender.mode`.

| Design              | Aussehen                                                  | Schriften                                   |
| ------------------- | --------------------------------------------------------- | ------------------------------------------- |
| **Dose** (Standard) | warmes Papier mit Faser, Kunststoffknöpfe, ein Grün       | Schibsted Grotesk, Instrument Sans, DM Mono |
| **Klassisch**       | das Design bis 0.14: neutral grau, ein Rot                | Segoe UI Variable                           |
| **Coral**           | warmes Grau wie Briefpapier, geprägte Karten, Korallenrot | Figtree, Geist Mono                         |
| **Terrazzo**        | Off-White, eckig, harte Tintenkanten, Terrakotta          | Syne, Onest, JetBrains Mono                 |

Ein Design ist ein Block `:root[data-theme='…']` in [`tokens.css`](../src/renderer/src/assets/tokens.css), dazu ein zweiter für dunkel. Was ein Design anders macht als die anderen, steht in Tokens (`--strong-bg`, `--press`, `--label-tint`, `--tear`, `--stamp-*`), nie in eigenen Regeln in `main.css`. Ein neues Design braucht darum nur zwei Blöcke in `tokens.css` und einen Eintrag in [`design.ts`](../src/renderer/src/design.ts).

Die Regeln unten beschreiben Dose. Die anderen Designs halten dieselben Grundsätze ein.

## Grundsatz

**Die Oberfläche ist Papier. Farbe gehört den Kalendern.**

In einer Kalender-App ist Farbe Information: Sie sagt, zu welchem Kalender ein Termin gehört. Darum ist alles andere Papier und Tinte, und ein einziges Grün markiert Aktion, Auswahl, «heute» und «jetzt».

## Farben

Alle Farben sind als CSS-Variablen in [`tokens.css`](../src/renderer/src/assets/tokens.css) definiert, je einmal für hell und dunkel («night»). Ausserhalb dieser Datei steht keine Farbe als Wert. FullCalendar bekommt dieselben Werte über seine `--fc-forma-*`-Variablen.

| Variable              | Verwendung                                          |
| --------------------- | --------------------------------------------------- |
| `--color-paper`       | Kalenderfläche, warmes Papier mit Faser (`--grain`) |
| `--color-paper-2`     | Seitenleiste, Assistent, Kopfzeile auf dem Handy    |
| `--color-surface`     | Knöpfe, Felder, Etikett, Blätter                    |
| `--color-ink`         | Text                                                |
| `--color-muted`       | Nebentext, Rand der Felder                          |
| `--color-rule`        | Trennlinien, Rand der Knöpfe                        |
| `--color-accent`      | das eine Grün: Hauptknopf, «heute», «jetzt»         |
| `--color-accent-soft` | Mint: was gewählt ist (Ansicht auf dem Handy)       |
| `--color-focus`       | Fokusrahmen                                         |
| `--color-ok`          | Status: verbunden                                   |
| `--color-notice`      | Status: Demo-Daten (grau, kein Warn-Gelb)           |
| `--color-error`       | Fehler                                              |

Regeln:

- Kein Violett-Blau-Verlauf, kein Leuchten, kein Glas. Kalender dürfen jede Farbe haben.
- Text erreicht mindestens 4.5:1 zum Hintergrund, Ränder von Feldern 3:1.
- Kalenderfarben müssen mit weisser Schrift lesbar sein (mindestens 4.5:1).

## Schrift

Die Schriften liegen als Pakete in der App (`@fontsource`), es wird nichts aus dem Netz geladen.

| Rolle                                 | Schrift           | Gewicht  |
| ------------------------------------- | ----------------- | -------- |
| App-Name, Titel, Monat, Überschriften | Schibsted Grotesk | 700      |
| Fliesstext, Bedienelemente, Labels    | Instrument Sans   | 400, 500 |
| Uhrzeiten (Wochenraster, Etikett)     | DM Mono           | 400, 500 |

Regeln:

- DM Mono nur für Uhrzeiten und Daten, nie für Labels oder Überschriften.
- Nichts ist kleiner als 12 px.
- Keine Grossbuchstaben-Labels, keine gesperrte Schrift, keine Vorzeile über einer Überschrift.

## Formen und Flächen

- Eckenradius: 10 px für Bedienelemente, 14 px für Flächen (Etikett, Formular), 22 px oben an Blättern auf dem Handy.
- **Knöpfe sind gegossener Kunststoff:** Lichtkante oben, ein 3 px Rand unten, beim Drücken sinken sie ein. Der Hauptknopf ist grün, die anderen sind klar.
- **Ein Termin ist ein Etikett:** Der Kopf ist in der Farbe seines Kalenders getönt, die Zeit steht in DM Mono, eine gestrichelte Abrisskante trennt die Aktionen ab.
- **Der Status ist ein Stempel:** doppelt umrandet, leicht schräg, in der Farbe des Zustands.
- Keine Karte in einer Karte. Seitenleiste und Kalender trennt eine einzige Linie.
- Hell trägt ein Schatten, dunkel eine Kante.
- Kein Emoji und kein Icon als Dekoration.

## Abstände

Alle Abstände laufen über die Skala `--space-3xs` (2 px) bis `--space-2xl` (64 px). Zusammengehöriges steht eng, Getrenntes weit: 2 px zwischen Kalendern einer Gruppe, 24 px zwischen den Gruppen, 24 px Innenabstand der Seitenleiste.

## Bewegung

- Nur kurze Übergänge (`--dur-micro` 120 ms, `--dur-short` 220 ms) bei Hover, beim Drücken und beim Öffnen des Etiketts.
- Nur `transform`, `opacity`, Farben und Schatten werden animiert, nie Breite oder Höhe.
- `prefers-reduced-motion` schaltet alle Übergänge ab.
- Inhalte sind ohne Animation sichtbar.

## Bedienung

- Termin-Details erscheinen als Etikett neben dem Termin, nicht als Modal. Ein Klick daneben oder Escape schliesst es.
- Jeder Text steht nur einmal.
- Hell und dunkel folgen der Einstellung des Systems, ausser in den Einstellungen ist «Hell» oder «Dunkel» gewählt.

## Prüfen

```bash
node <hallmark>/scripts/sloplint.mjs src/renderer/src/assets src/renderer/src/components web/src --genre modern-minimal --scope app
```

Stand 0.17.0: 0 FAIL, 0 WARN, 2 beantwortete Hinweise (F4) und eine begründete Ausnahme (37: mehr als drei Schriftfamilien, weil vier Designs).

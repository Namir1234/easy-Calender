# 🎨 Design

Die Gestaltungsregeln der Oberfläche. Wer etwas an der UI ändert, hält sich daran oder passt dieses Dokument an.

Die Regeln folgen dem Katalog von [Impeccable](https://impeccable.style/slop), der typische Merkmale von KI-generierten Oberflächen («AI-Slop») und Qualitätsprobleme auflistet. Die Impeccable-Skills liegen unter `.claude/skills/impeccable` (ohne Hooks). Geprüft wird mit `npx impeccable detect`.

## Grundsatz

**Die Oberfläche ist neutral. Farbe gehört den Kalendern.**

In einer Kalender-App ist Farbe Information: Sie sagt, zu welchem Kalender ein Termin gehört. Darum ist alles andere grau, und nur ein einziges Rot markiert «heute» und «jetzt».

## Farben

Alle Farben sind als CSS-Variablen in [`main.css`](../src/renderer/src/assets/main.css) definiert, je einmal für hell und dunkel. FullCalendar bekommt dieselben Werte.

| Variable      | Hell      | Dunkel    | Verwendung                                |
| ------------- | --------- | --------- | ----------------------------------------- |
| `--paper`     | `#ffffff` | `#17181b` | Kalenderfläche, Popover                   |
| `--panel`     | `#f3f4f5` | `#101113` | Seitenleiste                              |
| `--ink`       | `#16181d` | `#ecedef` | Text                                      |
| `--ink-muted` | `#535966` | `#a4a9b3` | Nebentext                                 |
| `--ink-faint` | `#6f7582` | `#838995` | zurückgenommener Text, z. B. Nachbarmonat |
| `--line`      | `#e2e4e8` | `#2c2e33` | Trennlinien                               |
| `--accent`    | `#c8321e` | `#ff7a66` | nur «heute», «jetzt» und Fokusrahmen      |
| `--ok`        | `#1f7a4d` | `#5fcf9a` | Status: verbunden                         |
| `--notice`    | `#8a5a00` | `#e0b252` | Status: Demo-Daten                        |
| `--error`     | `#a1260d` | `#ff8f7d` | Fehler                                    |

Regeln:

- Die Oberfläche selbst nutzt kein Violett, keine Verläufe, kein Leuchten und keinen Glas-Effekt. Kalender dürfen jede Farbe haben.
- Kategorien färben den Termin wie in Outlook: Hat ein Termin eine Kategorie, trägt er deren Farbe, sonst die des Kalenders.
- «Anzeigen als» folgt den Mustern von Outlook: frei hell mit Farbbalken, mit Vorbehalt schraffiert, abwesend mit violetter Linie unten (Information, keine Dekoration), woanders tätig gepunktet.
- Privat und Serie zeigen kleine Zeichen oben rechts im Termin (Schloss, Pfeile). Sie tragen Information und sind darum erlaubt.
- Text erreicht mindestens einen Kontrast von 4.5:1 zum Hintergrund.
- Kalenderfarben müssen mit weisser Schrift lesbar sein (mindestens 4.5:1).

## Schrift

- **Segoe UI Variable**, die Systemschrift von Windows 11. Die App ist ein Windows-Programm und soll sich so anfühlen. Es wird keine Schrift nachgeladen.
- Überschriften nutzen den Schnitt «Display», Fliesstext den Schnitt «Text».

| Rolle                      | Grösse | Gewicht |
| -------------------------- | ------ | ------- |
| App-Name, Titel im Popover | 18 px  | 650     |
| Fliesstext, Bedienelemente | 14 px  | 400     |
| Konto-Überschrift, Status  | 13 px  | 600     |
| Nebentext (Minimum)        | 12 px  | 400     |

Regeln:

- Nichts ist kleiner als 12 px.
- Keine Grossbuchstaben-Labels, keine gesperrte Schrift.
- Überschriften-Ebenen werden nicht übersprungen (`h1` App-Name, `h2` Konten).

## Formen und Flächen

- Eckenradius: 4 px für Bedienelemente, 8 px für das Popover. Sonst keine Rundungen.
- Keine Karte in einer Karte. Seitenleiste und Kalender trennt eine einzige Linie, der Kalender füllt seine Fläche randlos.
- Eine Fläche bekommt entweder eine Kante oder einen Schatten, nie beides. Hell: Schatten. Dunkel: Kante, weil ein Schatten dort nicht trägt.
- Kein Emoji und kein Icon als Dekoration.

## Abstände

Zusammengehöriges steht eng, Getrenntes weit: 4 px innerhalb einer Kontogruppe, 24 px zwischen den Gruppen, 20 px Innenabstand der Seitenleiste.

## Bewegung

- Nur kurze Übergänge (120 ms, `ease-out`) bei Hover und beim Öffnen des Popovers.
- Kein Federn, kein Pulsieren, keine Daueranimation. Der Status-Punkt steht still.
- `prefers-reduced-motion` schaltet alle Übergänge ab.
- Inhalte sind ohne Animation sichtbar. Fällt eine Animation aus, fehlt nichts.

## Bedienung

- Termin-Details erscheinen als Popover neben dem Termin, nicht als Modal. Ein Klick daneben oder Escape schliesst es.
- Jeder Text steht nur einmal. Ein Label wird nicht in der Zeile darunter wiederholt.
- Hell und dunkel folgen der Windows-Einstellung.

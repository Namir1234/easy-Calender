/** Kürzeste freie Lücke, in die Uhrzeit und Titel einer Lektion passen. */
export const MIN_LABEL_GAP_MS = 25 * 60 * 1000

export interface BackgroundLabel {
  /** Wo der Text steht, als Anteil der Höhe der Lektion (0 = oben). */
  offset: number
  /** Ob eine freie Lücke gross genug für den Text ist. */
  fits: boolean
}

/**
 * Wo der Text eines Hintergrund-Termins stehen soll. Liegen andere Termine
 * über dem oberen Rand, rutscht der Text in die erste freie Lücke, die gross
 * genug ist. Gibt es keine solche Lücke, nimmt er die grösste, und `fits`
 * ist falsch. Ist alles überdeckt, bleibt er oben.
 */
export function backgroundLabel(
  start: number,
  end: number,
  covers: Array<[number, number]>,
  minGap = MIN_LABEL_GAP_MS
): BackgroundLabel {
  const length = end - start
  if (length <= 0) return { offset: 0, fits: false }

  // Überdeckungen auf die Lektion zuschneiden, sortieren und verschmelzen.
  const clipped = covers
    .map(([from, to]): [number, number] => [Math.max(from, start), Math.min(to, end)])
    .filter(([from, to]) => from < to)
    .sort((a, b) => a[0] - b[0])

  const gaps: Array<[number, number]> = []
  let cursor = start
  for (const [from, to] of clipped) {
    if (from > cursor) gaps.push([cursor, from])
    cursor = Math.max(cursor, to)
  }
  if (cursor < end) gaps.push([cursor, end])
  if (gaps.length === 0) return { offset: 0, fits: false }

  // Kurze Lektionen ohne Überdeckung zählen als passend, auch unter minGap.
  if (clipped.length === 0) return { offset: 0, fits: true }

  const fitting = gaps.find(([from, to]) => to - from >= minGap)
  const chosen = fitting ?? gaps.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a))
  return { offset: (chosen[0] - start) / length, fits: Boolean(fitting) }
}

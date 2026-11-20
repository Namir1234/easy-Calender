import { describe, expect, it } from 'vitest'
import { backgroundLabel } from './backgroundLabel'

const MIN = 60 * 1000
// Chemie 07:50–09:30, in Minuten ab Mitternacht
const start = 470 * MIN
const end = 570 * MIN
const at = (covers: Array<[number, number]>): ReturnType<typeof backgroundLabel> =>
  backgroundLabel(
    start,
    end,
    covers.map(([from, to]) => [from * MIN, to * MIN])
  )

describe('backgroundLabel', () => {
  it('bleibt oben, wenn nichts darüber liegt', () => {
    expect(at([])).toEqual({ offset: 0, fits: true })
  })

  it('zählt eine kurze Lektion ohne Überdeckung als passend', () => {
    expect(backgroundLabel(0, 10 * MIN, [])).toEqual({ offset: 0, fits: true })
  })

  it('bleibt oben, wenn oben genug Platz frei ist', () => {
    // Termin erst ab 09:00, oben sind 70 Minuten frei
    expect(at([[540, 570]])).toEqual({ offset: 0, fits: true })
  })

  it('rutscht unter einen Termin, der den Titel verdeckt', () => {
    // Mathe-Prüfung 08:00–08:30: oben nur 10 Minuten frei, ab 08:30 genug
    const label = at([[480, 510]])
    expect(label.offset).toBeCloseTo(0.4)
    expect(label.fits).toBe(true)
  })

  it('verschmilzt überlappende Termine', () => {
    expect(
      at([
        [470, 500],
        [490, 520]
      ]).offset
    ).toBeCloseTo(0.5)
  })

  it('nimmt die grösste Lücke, wenn keine gross genug ist', () => {
    // Lücken: 5, 10 und 10 Minuten. Die erste der grössten (ab 08:20) gewinnt.
    const label = at([
      [475, 500],
      [510, 560]
    ])
    expect(label.offset).toBeCloseTo(0.3)
    expect(label.fits).toBe(false)
  })

  it('meldet eine ganz überdeckte Lektion', () => {
    expect(at([[400, 600]])).toEqual({ offset: 0, fits: false })
    // Probeprüfung genau so lang wie Französisch
    expect(at([[470, 570]])).toEqual({ offset: 0, fits: false })
  })

  it('ignoriert Termine ausserhalb der Lektion', () => {
    expect(at([[300, 400]])).toEqual({ offset: 0, fits: true })
  })
})

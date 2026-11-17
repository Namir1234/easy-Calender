const GERMAN: Record<string, string> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  Ä: 'Ae',
  Ö: 'Oe',
  Ü: 'Ue',
  ß: 'ss',
  '«': '"',
  '»': '"',
  '„': '"',
  '“': '"',
  '”': '"',
  '’': "'",
  '‘': "'",
  '–': '-',
  '—': '-',
  '…': '...',
  '€': 'EUR'
}

/**
 * Schreibt einen Text nur mit ASCII-Zeichen: «Zürich» wird «Zuerich»,
 * «café» wird «cafe». Was sich nicht umschreiben lässt, wird zu «?».
 *
 * Gebraucht wird das für Notizen im lokalen Outlook, das andere Zeichen
 * beim Speichern verfälscht (siehe E-017).
 */
export function toAscii(text: string): string {
  return [...text]
    .map((char) => {
      if (char.charCodeAt(0) < 128) return char
      if (GERMAN[char] !== undefined) return GERMAN[char]
      // Akzente abtrennen: «é» ist «e» plus Akzent.
      const base = char.normalize('NFD').replace(/[̀-ͯ]/g, '')
      return /^[\x20-\x7e]+$/.test(base) ? base : '?'
    })
    .join('')
}

/** Ob zwei Texte bis auf die Umschrift nach ASCII gleich sind. */
export function sameInAscii(a: string | undefined, b: string | undefined): boolean {
  return toAscii((a ?? '').trim()) === toAscii((b ?? '').trim())
}

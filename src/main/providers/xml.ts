/** Ein Element aus einer XML-Antwort. Namensräume sind weggelassen, nur der lokale Name zählt. */
export interface XmlNode {
  name: string
  /** Attribute, ebenfalls ohne Namensraum */
  attrs: Record<string, string>
  children: XmlNode[]
  text: string
}

const ENTITIES: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }

function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, entity: string) => {
    if (entity[0] === '#') {
      const code =
        entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1))
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole
    }
    return ENTITIES[entity.toLowerCase()] ?? whole
  })
}

const localName = (tag: string): string => tag.slice(tag.indexOf(':') + 1).toLowerCase()

/**
 * Liest XML, wie es CalDAV-Server liefern, in einen einfachen Baum.
 * Namensräume fallen weg, es zählen nur die lokalen Namen.
 * Es ist kein vollständiger XML-Parser, aber er verträgt CDATA, Kommentare
 * und Elemente ohne Inhalt.
 */
export function parseXml(xml: string): XmlNode {
  const root: XmlNode = { name: '#root', attrs: {}, children: [], text: '' }
  const stack: XmlNode[] = [root]
  let index = 0

  while (index < xml.length) {
    const open = xml.indexOf('<', index)
    const textEnd = open === -1 ? xml.length : open
    if (textEnd > index) stack[stack.length - 1].text += decode(xml.slice(index, textEnd))
    if (open === -1) break

    if (xml.startsWith('<![CDATA[', open)) {
      const end = xml.indexOf(']]>', open)
      if (end === -1) throw new Error('Ungültige XML-Antwort: CDATA ohne Ende')
      stack[stack.length - 1].text += xml.slice(open + 9, end)
      index = end + 3
      continue
    }
    if (xml.startsWith('<!--', open)) {
      const end = xml.indexOf('-->', open)
      index = end === -1 ? xml.length : end + 3
      continue
    }

    const close = xml.indexOf('>', open)
    if (close === -1) throw new Error('Ungültige XML-Antwort: Element ohne Ende')
    const tag = xml.slice(open + 1, close)
    index = close + 1
    if (tag.startsWith('?') || tag.startsWith('!')) continue

    if (tag.startsWith('/')) {
      const name = localName(tag.slice(1).trim())
      // Bis zum passenden Element zurück. Fehlt es, bleibt der Baum, wie er ist.
      const at = stack.map((node) => node.name).lastIndexOf(name)
      if (at > 0) stack.length = at
      continue
    }

    const selfClosing = tag.endsWith('/')
    const body = tag.replace(/\/$/, '').trim()
    const name = localName(body.split(/\s/)[0])
    const attrs: Record<string, string> = {}
    for (const match of body.matchAll(/([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
      attrs[localName(match[1])] = decode(match[3] ?? match[4] ?? '')
    }
    const node: XmlNode = { name, attrs, children: [], text: '' }
    stack[stack.length - 1].children.push(node)
    if (!selfClosing) stack.push(node)
  }

  return root
}

/** Alle Nachfahren mit diesem Namen, in Dokumentreihenfolge. */
export function findAll(node: XmlNode, name: string): XmlNode[] {
  const found: XmlNode[] = []
  const visit = (current: XmlNode): void => {
    for (const child of current.children) {
      if (child.name === name) found.push(child)
      visit(child)
    }
  }
  visit(node)
  return found
}

/** Der erste Nachfahre mit diesem Namen. */
export function find(node: XmlNode, name: string): XmlNode | undefined {
  return findAll(node, name)[0]
}

/** Der Text des ersten Nachfahren mit diesem Namen, ohne Leerraum am Rand. */
export function textOf(node: XmlNode, name: string): string | undefined {
  const found = find(node, name)
  return found ? found.text.trim() : undefined
}

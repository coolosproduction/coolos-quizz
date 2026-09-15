// Cartes à trous — le contenu est stocké en texte brut avec les trous marqués manuellement
// par l'utilisateur via la syntaxe {{mot ou groupe de mots}}. Ce fichier centralise le parsing
// pour l'édition (aperçu) et l'étude (saisie + correction), partagé entre
// app/revision/[setId]/page.tsx (création/édition) et app/revision/etudier-trous/[setId]/page.tsx.

export type ClozeSegment =
  | { type: 'text', value: string }
  | { type: 'blank', value: string, index: number }

const BLANK_REGEX = /\{\{(.+?)\}\}/g

export function parseCloze(content: string): ClozeSegment[] {
  const segments: ClozeSegment[] = []
  let lastIndex = 0
  let blankIndex = 0
  let match: RegExpExecArray | null
  BLANK_REGEX.lastIndex = 0
  while ((match = BLANK_REGEX.exec(content)) !== null) {
    if (match.index > lastIndex) segments.push({ type: 'text', value: content.slice(lastIndex, match.index) })
    segments.push({ type: 'blank', value: match[1], index: blankIndex })
    blankIndex++
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < content.length) segments.push({ type: 'text', value: content.slice(lastIndex) })
  return segments
}

export function countBlanks(content: string): number {
  const matches = content.match(BLANK_REGEX)
  return matches ? matches.length : 0
}

// Insère les marqueurs {{ }} autour d'une sélection de texte dans un textarea, en se basant
// sur les indices de sélection natifs (selectionStart/selectionEnd). Retourne le nouveau
// contenu et la position où replacer le curseur après l'insertion.
export function wrapSelectionAsBlank(content: string, selStart: number, selEnd: number): { content: string, cursor: number } | null {
  if (selStart === selEnd) return null
  const before = content.slice(0, selStart)
  const selected = content.slice(selStart, selEnd)
  const after = content.slice(selEnd)
  const newContent = `${before}{{${selected}}}${after}`
  return { content: newContent, cursor: before.length + selected.length + 4 }
}

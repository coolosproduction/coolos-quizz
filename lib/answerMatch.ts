// Comparaison de texte partagée entre tous les modes à correction automatisée (carte-image à
// trous, et le mode "essai libre" du lien public de partage) : accents/majuscules ignorés, mais
// pas de tolérance aux fautes de frappe. Extrait de lib/imageCloze.ts (qui le réexporte pour ne
// rien casser côté appelants existants) pour être réutilisable aussi par le texte à trous
// ({{mot}}, lib/cloze.ts) sans dépendre d'un fichier au nom spécifique aux images.

export function normalizeAnswer(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
}

export function isAnswerCorrect(given: string, correct: string): boolean {
  const g = normalizeAnswer(given)
  if (!g) return false
  return g === normalizeAnswer(correct)
}

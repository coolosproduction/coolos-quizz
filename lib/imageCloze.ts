// Cartes "carte-image à trous" — une image (ex. carte géographique) avec des zones rectangulaires
// définies en pourcentages de la taille de l'image (donc responsive), chacune associée à une
// réponse texte. Contrairement aux cartes à trous textuelles ({{mot}}, cf. lib/cloze.ts), la
// correction est automatisée : on compare la saisie de l'utilisateur à la réponse attendue plutôt
// que de demander une auto-évaluation oui/en_partie/non.

export type ImageBlank = {
  id: string
  x: number       // % depuis la gauche de l'image
  y: number       // % depuis le haut de l'image
  width: number   // % de la largeur de l'image
  height: number  // % de la hauteur de l'image
  answer: string
}

// Normalise une réponse pour la comparaison : espaces superflus, casse et accents ignorés
// ("Paris" == "paris" == "PARIS" == "pariS"), mais une faute de frappe reste refusée.
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

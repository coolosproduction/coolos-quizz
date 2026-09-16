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

// normalizeAnswer/isAnswerCorrect vivent désormais dans lib/answerMatch.ts (réutilisées aussi par
// le texte à trous sur le lien public en essai libre) — réexportées ici pour ne rien casser côté
// appelants existants de ce fichier.
export { normalizeAnswer, isAnswerCorrect } from './answerMatch'

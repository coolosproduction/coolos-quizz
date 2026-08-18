// Petit spinner rond partagé — pour les attentes courtes (bouton en cours
// d'envoi, recherche en cours, action ponctuelle) là où un squelette de
// page complet serait excessif. Remplace les divers "..." et "Envoi..."
// textuels par un même indicateur visuel cohérent, sans changer le texte
// qui l'accompagne.
export default function Spinner({
  size = 16,
  color = '#ffd93d',
  className = '',
  label,
}: {
  size?: number
  color?: string
  className?: string
  label?: string
}) {
  return (
    <span
      className={`coolos-spinner ${className}`}
      style={{ width: size, height: size, borderTopColor: color }}
      role="status"
      aria-label={label || 'Chargement'}
    />
  )
}

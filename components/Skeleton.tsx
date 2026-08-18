// Squelette de chargement générique — remplace les "Chargement..." bruts et
// les sauts brutaux vide -> contenu sur les pages qui dépendent de Supabase
// ou du temps réel. Un seul composant partagé pour que l'effet (durée,
// teinte, easing) reste identique partout plutôt que réinventé page par
// page. Purement visuel : n'affecte ni les données ni le comportement.
export default function Skeleton({
  width = '100%',
  height = '16px',
  radius = '8px',
  className = '',
  style = {},
}: {
  width?: string | number
  height?: string | number
  radius?: string
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      className={`coolos-skeleton ${className}`}
      style={{ width, height, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  )
}

// Ligne façon "carte" (avatar + deux lignes de texte) — le motif de
// chargement le plus fréquent sur le site : classement, amis, historique,
// liste de joueurs en salle multijoueur...
export function SkeletonRow({ avatar = true }: { avatar?: boolean }) {
  return (
    <div
      className="flex items-center gap-4"
      style={{ background: '#1a1828', border: '1px solid #2a2830', borderRadius: '12px', padding: '12px 16px' }}
    >
      {avatar && <Skeleton width={32} height={32} radius="9999px" />}
      <div className="flex-1" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Skeleton width="40%" height={14} />
        <Skeleton width="65%" height={11} />
      </div>
    </div>
  )
}

// Plusieurs SkeletonRow d'affilée, pour les listes (classement, amis...).
export function SkeletonList({ count = 5, avatar = true }: { count?: number, avatar?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} avatar={avatar} />
      ))}
    </div>
  )
}

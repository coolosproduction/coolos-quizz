'use client'

// Badge admin/propriétaire et badge premium, visuellement distincts,
// affichés partout où le pseudo d'un joueur apparaît (classement, chat,
// profils, salons multijoueur, admin...). Un admin/owner n'affiche que le
// badge admin — il a déjà tous les accès premium, inutile de l'afficher en
// double (cf. is_admin() côté DB qui inclut owner).
type RoleBadgeProps = {
  role?: string | null
  isPremium?: boolean | null
  size?: 'xs' | 'sm'
  className?: string
}

export default function RoleBadge({ role, isPremium, size = 'xs', className = '' }: RoleBadgeProps) {
  const isAdminLike = role === 'admin' || role === 'owner'
  if (!isAdminLike && !isPremium) return null

  const fontSize = size === 'sm' ? '11px' : '10px'
  const padding = size === 'sm' ? '3px 9px' : '2px 7px'

  if (isAdminLike) {
    return (
      <span
        className={`font-fredoka rounded-full inline-flex items-center gap-1 flex-shrink-0 ${className}`}
        style={{ background: '#2a1f3d', color: '#a78bfa', border: '1px solid #3a2d5a', fontSize, padding, lineHeight: 1 }}
      >
        ⚡ {role === 'owner' ? 'Propriétaire' : 'Admin'}
      </span>
    )
  }

  return (
    <span
      className={`font-fredoka rounded-full inline-flex items-center gap-1 flex-shrink-0 ${className}`}
      style={{ background: '#2d2010', color: '#ffd93d', border: '1px solid #4a3a10', fontSize, padding, lineHeight: 1 }}
    >
      ★ Premium
    </span>
  )
}

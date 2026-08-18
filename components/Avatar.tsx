'use client'

// Composant unifié pour l'affichage d'un avatar joueur, utilisé partout sur
// le site (classement, amis, profils, admin, multijoueur...) pour que la
// résolution de l'image et le style du cercle/placeholder soient toujours
// identiques, plutôt que chaque page ne réimplémente son propre bout de JSX.
type AvatarProps = {
  url?: string | null
  size?: number
  border?: 'subtle' | 'accent'
  className?: string
}

const BORDER_COLORS: Record<'subtle' | 'accent', string> = {
  subtle: '#2a2830',
  accent: '#a78bfa',
}

export default function Avatar({ url, size = 36, border = 'accent', className = '' }: AvatarProps) {
  const borderWidth = size >= 56 ? 3 : 2
  const dotSize = Math.max(8, Math.round(size * 0.45))

  return (
    <div
      className={`rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        border: `${borderWidth}px solid ${BORDER_COLORS[border]}`,
        background: '#2a1f3d',
      }}
    >
      {url ? (
        <img src={url} alt="avatar" className="w-full h-full object-cover" />
      ) : (
        <div className="rounded-full bg-[#a78bfa]" style={{ width: `${dotSize}px`, height: `${dotSize}px` }}></div>
      )}
    </div>
  )
}

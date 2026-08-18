'use client'

// Anneau de progression circulaire réutilisable (taux de victoire, percentile...).
// Même technique que le minuteur circulaire de la page quiz multijoueur
// (cercle SVG + strokeDashoffset), pour rester cohérent avec le reste du site
// plutôt que d'introduire une nouvelle façon de dessiner un anneau.
type StatRingProps = {
  value: number // 0-100
  label: string // valeur affichée au centre, ex "72%"
  sublabel?: string
  color: string
  size?: number
  strokeWidth?: number
}

export default function StatRing({ value, label, sublabel, color, size = 120, strokeWidth = 10 }: StatRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, value))
  const strokeDashoffset = circumference * (1 - clamped / 100)

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1e1c2e" strokeWidth={strokeWidth} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-fredoka text-xl" style={{ color }}>{label}</span>
        </div>
      </div>
      {sublabel && <p className="text-[#827f97] text-xs text-center">{sublabel}</p>}
    </div>
  )
}

'use client'

import { useState } from 'react'

// Liste de barres horizontales réutilisable (réussite par difficulté, par
// sous-catégorie...). Étiquette toujours affichée en clair à côté de la
// barre (jamais la couleur seule qui porte l'identité), infobulle légère au
// survol pour le détail exact.
type BarItem = {
  id: string
  label: string
  value: number // 0-100, déjà en pourcentage
  color: string
  detail?: string // texte affiché dans l'infobulle au survol
}

export default function BarList({ items, emptyLabel }: { items: BarItem[], emptyLabel?: string }) {
  const [hoverId, setHoverId] = useState<string | null>(null)

  if (items.length === 0) {
    return <p className="text-[#827f97] text-sm">{emptyLabel || 'Pas encore de données.'}</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {items.map(item => (
        <div key={item.id} className="flex items-center gap-3">
          <span className="font-fredoka text-[#c9c4e0] text-sm flex-shrink-0" style={{ width: '110px' }} title={item.label}>
            <span className="block truncate">{item.label}</span>
          </span>
          <div
            className="relative flex-1 rounded-full"
            style={{ background: '#1e1c2e', height: '14px' }}
            onMouseEnter={() => setHoverId(item.id)}
            onMouseLeave={() => setHoverId(prev => (prev === item.id ? null : prev))}
          >
            <div
              className="rounded-full"
              style={{
                width: `${Math.max(0, Math.min(100, item.value))}%`,
                height: '14px',
                background: item.color,
                transition: 'width 0.6s ease',
              }}
            ></div>
            {hoverId === item.id && item.detail && (
              <div
                className="absolute font-fredoka text-xs rounded-lg whitespace-nowrap"
                style={{ background: '#0f0e17', border: '1px solid #3a3650', color: '#eeeaf8', padding: '4px 10px', bottom: 'calc(100% + 6px)', left: '0', zIndex: 10 }}
              >
                {item.detail}
              </div>
            )}
          </div>
          <span className="font-fredoka text-sm flex-shrink-0" style={{ width: '44px', textAlign: 'right', color: item.color }}>
            {Math.round(item.value)}%
          </span>
        </div>
      ))}
    </div>
  )
}

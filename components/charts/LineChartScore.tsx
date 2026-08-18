'use client'

import { useState } from 'react'

export type ScorePoint = {
  id: string
  date: string // déjà formaté court, ex "12 août"
  value: number // % de réussite de cette partie (0-100)
  source: 'solo' | 'multiplayer'
}

const WIDTH = 640
const HEIGHT = 220
const PAD_LEFT = 34
const PAD_RIGHT = 12
const PAD_TOP = 12
const PAD_BOTTOM = 28
const PLOT_W = WIDTH - PAD_LEFT - PAD_RIGHT
const PLOT_H = HEIGHT - PAD_TOP - PAD_BOTTOM
const LINE_COLOR = '#a78bfa'

// Courbe d'évolution du score (une seule série : % de réussite par partie,
// solo et multijoueur mélangés par ordre chronologique — cf. barème commun
// déjà utilisé partout ailleurs sur le site). Un seul axe, pas de légende
// nécessaire pour une série unique ; infobulle par point au survol plutôt
// qu'un curseur croisé, pour rester simple sur une page de stats interne.
export default function LineChartScore({ points }: { points: ScorePoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  if (points.length === 0) {
    return <p className="text-[#827f97] text-sm">Pas encore de parties enregistrées.</p>
  }

  const n = points.length
  const xFor = (i: number) => (n === 1 ? PAD_LEFT + PLOT_W / 2 : PAD_LEFT + (i / (n - 1)) * PLOT_W)
  const yFor = (v: number) => PAD_TOP + (1 - Math.max(0, Math.min(100, v)) / 100) * PLOT_H

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(p.value)}`).join(' ')
  const areaPath = `${linePath} L ${xFor(n - 1)} ${PAD_TOP + PLOT_H} L ${xFor(0)} ${PAD_TOP + PLOT_H} Z`

  const gridLevels = [0, 25, 50, 75, 100]
  const labelIdxs = n === 1 ? [0] : Array.from(new Set([0, Math.floor((n - 1) / 2), n - 1]))

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {gridLevels.map(level => (
          <g key={level}>
            <line
              x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT}
              y1={yFor(level)} y2={yFor(level)}
              stroke="#1e1c2e" strokeWidth={1}
            />
            <text x={PAD_LEFT - 8} y={yFor(level) + 3} textAnchor="end" fontSize="10" fill="#8480a1">
              {level}
            </text>
          </g>
        ))}

        <path d={areaPath} fill={LINE_COLOR} opacity={0.12} stroke="none" />
        <path d={linePath} fill="none" stroke={LINE_COLOR} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {points.map((p, i) => (
          <g key={p.id}>
            <circle
              cx={xFor(i)} cy={yFor(p.value)} r={10} fill="transparent"
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(prev => (prev === i ? null : prev))}
              style={{ cursor: 'pointer' }}
            />
            <circle
              cx={xFor(i)} cy={yFor(p.value)} r={hoverIndex === i ? 5 : 3.5}
              fill={p.source === 'multiplayer' ? '#4ecdc4' : LINE_COLOR}
              stroke="#0f0e17" strokeWidth={1.5}
              style={{ transition: 'r 0.15s ease', pointerEvents: 'none' }}
            />
          </g>
        ))}

        {labelIdxs.map(i => (
          <text key={i} x={xFor(i)} y={HEIGHT - 8} textAnchor="middle" fontSize="10" fill="#827f97">
            {points[i].date}
          </text>
        ))}
      </svg>

      {hoverIndex !== null && (
        <div
          className="absolute font-fredoka text-xs rounded-lg pointer-events-none"
          style={{
            background: '#0f0e17', border: '1px solid #3a3650', color: '#eeeaf8', padding: '6px 12px',
            left: `${(xFor(hoverIndex) / WIDTH) * 100}%`, top: `${(yFor(points[hoverIndex].value) / HEIGHT) * 100}%`,
            transform: 'translate(-50%, -130%)', whiteSpace: 'nowrap', zIndex: 10,
          }}
        >
          {points[hoverIndex].date} · {Math.round(points[hoverIndex].value)}%
          {points[hoverIndex].source === 'multiplayer' && <span className="text-[#4ecdc4]"> · multi</span>}
        </div>
      )}

      <div className="flex items-center gap-4 justify-end" style={{ marginTop: '4px' }}>
        <span className="flex items-center gap-1.5 text-[#827f97] text-xs">
          <span className="rounded-full inline-block" style={{ width: '8px', height: '8px', background: LINE_COLOR }}></span>
          Solo
        </span>
        <span className="flex items-center gap-1.5 text-[#827f97] text-xs">
          <span className="rounded-full inline-block" style={{ width: '8px', height: '8px', background: '#4ecdc4' }}></span>
          Multijoueur
        </span>
      </div>
    </div>
  )
}

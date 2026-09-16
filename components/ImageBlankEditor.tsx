'use client'

// Éditeur interactif de trous sur une image : clic-glisser pour dessiner un rectangle à cacher,
// puis saisie de la réponse attendue pour ce trou. Coordonnées stockées en pourcentages de la
// taille de l'image (responsive, indépendant de la résolution d'affichage). Pas de redimensionnement
// d'un trou existant en v1 — on supprime et on redessine si besoin.

import { useRef, useState } from 'react'
import type { ImageBlank } from '../lib/imageCloze'

type DraftRect = { startX: number, startY: number, x: number, y: number, width: number, height: number }

const MIN_SIZE = 2 // % minimum pour éviter qu'un simple clic crée un trou de taille nulle

export default function ImageBlankEditor({
  imageUrl,
  blanks,
  onChange,
  accentColor = '#6bcb77',
}: {
  imageUrl: string
  blanks: ImageBlank[]
  onChange: (blanks: ImageBlank[]) => void
  accentColor?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [drawing, setDrawing] = useState(false)
  const [draft, setDraft] = useState<DraftRect | null>(null)
  const [pendingAnswer, setPendingAnswer] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editAnswer, setEditAnswer] = useState('')

  const percentFromEvent = (e: { clientX: number, clientY: number }) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return { px: 0, py: 0 }
    const px = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100))
    const py = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100))
    return { px, py }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-blank-box]')) return
    const { px, py } = percentFromEvent(e)
    setDrawing(true)
    setDraft({ startX: px, startY: py, x: px, y: py, width: 0, height: 0 })
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drawing || !draft) return
    const { px, py } = percentFromEvent(e)
    const x = Math.min(draft.startX, px)
    const y = Math.min(draft.startY, py)
    const width = Math.abs(px - draft.startX)
    const height = Math.abs(py - draft.startY)
    setDraft({ ...draft, x, y, width, height })
  }

  const handlePointerUp = () => {
    if (!drawing) return
    setDrawing(false)
    if (!draft || draft.width < MIN_SIZE || draft.height < MIN_SIZE) { setDraft(null); return }
    setPendingAnswer('')
  }

  const confirmerNouveauTrou = () => {
    if (!draft || !pendingAnswer.trim()) return
    const nouveau: ImageBlank = {
      id: crypto.randomUUID(),
      x: draft.x, y: draft.y, width: draft.width, height: draft.height,
      answer: pendingAnswer.trim(),
    }
    onChange([...blanks, nouveau])
    setDraft(null)
    setPendingAnswer('')
  }

  const annulerNouveauTrou = () => {
    setDraft(null)
    setPendingAnswer('')
  }

  const supprimerTrou = (id: string) => {
    onChange(blanks.filter(b => b.id !== id))
  }

  const commencerEditionTrou = (b: ImageBlank) => {
    setEditingId(b.id)
    setEditAnswer(b.answer)
  }

  const sauvegarderEditionTrou = () => {
    if (!editingId || !editAnswer.trim()) return
    onChange(blanks.map(b => b.id === editingId ? { ...b, answer: editAnswer.trim() } : b))
    setEditingId(null)
    setEditAnswer('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <p className="text-[#827f97] text-xs">
        Dessine un rectangle sur l'image (clic-glisser) pour créer un trou, puis indique la réponse attendue. Clique sur un trou existant pour modifier ou supprimer sa réponse.
      </p>

      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', touchAction: 'none', cursor: 'crosshair', userSelect: 'none' }}
      >
        <img src={imageUrl} alt="" draggable={false} style={{ display: 'block', maxWidth: '100%', borderRadius: '12px' }} />

        {blanks.map((b, i) => (
          <div
            key={b.id}
            data-blank-box
            style={{
              position: 'absolute',
              left: `${b.x}%`, top: `${b.y}%`, width: `${b.width}%`, height: `${b.height}%`,
              background: 'rgba(107, 203, 119, 0.35)',
              border: `2px solid ${accentColor}`,
              borderRadius: '4px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
            onClick={(e) => { e.stopPropagation(); commencerEditionTrou(b) }}
          >
            <span className="font-fredoka text-xs" style={{ color: '#0f0e17', background: accentColor, borderRadius: '9999px', padding: '1px 6px' }}>
              {i + 1}
            </span>
          </div>
        ))}

        {draft && (
          <div
            style={{
              position: 'absolute',
              left: `${draft.x}%`, top: `${draft.y}%`, width: `${draft.width}%`, height: `${draft.height}%`,
              background: 'rgba(255, 217, 61, 0.25)',
              border: '2px dashed #ffd93d',
              borderRadius: '4px',
            }}
          />
        )}
      </div>

      {draft && !drawing && (
        <div className="bg-[#0f0e17] border border-[#3a3650] rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
          <span className="font-fredoka text-[#9b96b8] text-sm">Réponse pour ce trou :</span>
          <input
            type="text"
            value={pendingAnswer}
            onChange={e => setPendingAnswer(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && confirmerNouveauTrou()}
            autoFocus
            maxLength={200}
            className="flex-1 bg-[#1a1828] border border-[#3a3650] rounded-lg px-3 py-2 text-[#eeeaf8] text-sm outline-none focus:border-[#6bcb77]"
            style={{ minWidth: '160px' }}
          />
          <button type="button" onClick={confirmerNouveauTrou} disabled={!pendingAnswer.trim()} className="font-fredoka text-xs rounded-full px-4 py-2 hover:opacity-80 transition disabled:opacity-50" style={{ background: accentColor, color: '#0f0e17' }}>
            Ajouter
          </button>
          <button type="button" onClick={annulerNouveauTrou} className="font-fredoka text-xs text-[#827f97] hover:text-[#c9c4e0] transition">
            Annuler
          </button>
        </div>
      )}

      {editingId && (
        <div className="bg-[#0f0e17] border border-[#3a3650] rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
          <span className="font-fredoka text-[#9b96b8] text-sm">Modifier la réponse :</span>
          <input
            type="text"
            value={editAnswer}
            onChange={e => setEditAnswer(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sauvegarderEditionTrou()}
            autoFocus
            maxLength={200}
            className="flex-1 bg-[#1a1828] border border-[#3a3650] rounded-lg px-3 py-2 text-[#eeeaf8] text-sm outline-none focus:border-[#a78bfa]"
            style={{ minWidth: '160px' }}
          />
          <button type="button" onClick={sauvegarderEditionTrou} disabled={!editAnswer.trim()} className="font-fredoka text-xs rounded-full px-4 py-2 hover:opacity-80 transition disabled:opacity-50" style={{ background: '#a78bfa', color: '#0f0e17' }}>
            Sauvegarder
          </button>
          <button type="button" onClick={() => { supprimerTrou(editingId); setEditingId(null) }} className="font-fredoka text-xs text-[#827f97] hover:text-[#ff6b6b] transition">
            Supprimer ce trou
          </button>
          <button type="button" onClick={() => setEditingId(null)} className="font-fredoka text-xs text-[#827f97] hover:text-[#c9c4e0] transition">
            Fermer
          </button>
        </div>
      )}

      {blanks.length > 0 && (
        <p className="text-[#827f97] text-xs">{blanks.length} trou{blanks.length > 1 ? 's' : ''} créé{blanks.length > 1 ? 's' : ''}</p>
      )}
    </div>
  )
}

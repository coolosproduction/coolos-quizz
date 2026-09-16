'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '../../../../lib/supabase'
import { parseCloze } from '../../../../lib/cloze'
import { isAnswerCorrect } from '../../../../lib/answerMatch'
import type { ImageBlank } from '../../../../lib/imageCloze'
import Skeleton from '@/components/Skeleton'

// Un lien public peut pointer vers un set composé de n'importe quel mélange des 3 types de
// cartes (classique, à trous texte, carte-image à trous). Les modes à trous permettent à un
// visiteur sans compte d'essayer de remplir les trous puis de voir son résultat + les réponses —
// en essai libre, sans aucune progression enregistrée (pas de revision_sessions ici).
type ClassicCard = { kind: 'classic', id: string, recto: string, verso: string }
type ClozeCardPublic = { kind: 'cloze', id: string, content: string }
type ImageCardPublic = { kind: 'image', id: string, image_path: string, blanks: ImageBlank[] }
type PublicCard = ClassicCard | ClozeCardPublic | ImageCardPublic

async function getSignedImageUrls(paths: (string | null | undefined)[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths.filter((p): p is string => !!p)))
  if (unique.length === 0) return {}
  const supabase = createClient()
  const { data } = await supabase.storage.from('revision-images').createSignedUrls(unique, 3600)
  const map: Record<string, string> = {}
  ;(data || []).forEach(d => { if (d.signedUrl && d.path) map[d.path] = d.signedUrl })
  return map
}

export default function RevisionPartagePublique() {
  const params = useParams()
  const token = params.token as string

  const [loading, setLoading] = useState(true)
  const [invalid, setInvalid] = useState(false)
  const [setName, setSetName] = useState('')
  const [ownerPseudo, setOwnerPseudo] = useState('')
  const [cards, setCards] = useState<PublicCard[]>([])
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [index, setIndex] = useState(0)

  // État de l'essai libre pour la carte courante — remis à zéro à chaque navigation, jamais
  // persisté (pas de compte, pas de revision_sessions pour ce lecteur public).
  const [revealed, setRevealed] = useState(false)
  const [checked, setChecked] = useState(false)
  const [clozeInputs, setClozeInputs] = useState<Record<number, string>>({})
  const [imageInputs, setImageInputs] = useState<Record<string, string>>({})

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()

      const { data: linkInfo, error: linkError } = await supabase.rpc('get_public_revision_link_info', { p_token: token })
      if (linkError || !linkInfo || linkInfo.length === 0) { setInvalid(true); setLoading(false); return }
      setSetName(linkInfo[0].set_name)
      setOwnerPseudo(linkInfo[0].owner_pseudo)

      const [classicRes, clozeRes, imageRes] = await Promise.all([
        supabase.rpc('get_public_revision_set', { p_token: token }),
        supabase.rpc('get_public_revision_cloze_cards', { p_token: token }),
        supabase.rpc('get_public_revision_image_cloze_cards', { p_token: token }),
      ])

      const classicCards: PublicCard[] = ((classicRes.data || []) as any[]).map(d => ({ kind: 'classic', id: d.card_id, recto: d.recto, verso: d.verso }))
      const clozeCards: PublicCard[] = ((clozeRes.data || []) as any[]).map(d => ({ kind: 'cloze', id: d.cloze_card_id, content: d.content }))
      const imageCards: PublicCard[] = ((imageRes.data || []) as any[]).map(d => ({ kind: 'image', id: d.card_id, image_path: d.image_path, blanks: (d.blanks || []) as ImageBlank[] }))

      const allCards = [...classicCards, ...clozeCards, ...imageCards]
      setCards(allCards)

      const urls = await getSignedImageUrls(imageCards.map(c => (c as ImageCardPublic).image_path))
      setImageUrls(urls)

      setLoading(false)
    }
    load()
  }, [token])

  const carte = cards[index] || null

  const resetEssai = () => {
    setRevealed(false)
    setChecked(false)
    setClozeInputs({})
    setImageInputs({})
  }

  const suivante = () => {
    resetEssai()
    setIndex(prev => (prev + 1) % cards.length)
  }
  const precedente = () => {
    resetEssai()
    setIndex(prev => (prev - 1 + cards.length) % cards.length)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0f0e17] flex items-center justify-center" style={{ padding: '24px' }}>
        <div style={{ width: '100%', maxWidth: '500px' }}>
          <Skeleton height={260} radius="24px" />
        </div>
      </main>
    )
  }

  if (invalid || !carte) {
    return (
      <main className="min-h-screen bg-[#0f0e17] flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-fredoka text-[#ff6b6b] text-xl">Ce lien est invalide.</p>
        <p className="text-[#827f97] text-sm">Il a peut-être été révoqué par son propriétaire, ou n'a jamais existé.</p>
        <Link href="/" className="font-fredoka text-sm text-[#a78bfa] mt-2">← Retour à l'accueil</Link>
      </main>
    )
  }

  const clozeBlanks = carte.kind === 'cloze' ? parseCloze(carte.content).filter(s => s.type === 'blank') : []
  const clozeScore = { correct: clozeBlanks.filter(b => isAnswerCorrect(clozeInputs[b.index] || '', b.value)).length, total: clozeBlanks.length }
  const imageScore = carte.kind === 'image'
    ? { correct: carte.blanks.filter(b => isAnswerCorrect(imageInputs[b.id] || '', b.answer)).length, total: carte.blanks.length }
    : { correct: 0, total: 0 }

  return (
    <main className="min-h-screen bg-[#0f0e17] flex flex-col items-center" style={{ padding: '40px 24px' }}>
      <div style={{ width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        <div className="text-center">
          <h1 className="font-fredoka text-2xl text-[#eeeaf8] mb-1">{setName}</h1>
          <p className="text-[#827f97] text-sm">Partagé par {ownerPseudo} · lecture seule</p>
        </div>

        <div
          onClick={carte.kind === 'classic' ? () => setRevealed(r => !r) : undefined}
          className={`bg-[#1a1828] border border-[#2a2830] rounded-2xl ${carte.kind === 'classic' ? 'cursor-pointer' : ''}`}
          style={{ minHeight: '220px', padding: '32px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}
        >
          {carte.kind === 'classic' && (
            <div>
              <p className="text-[#827f97] text-xs mb-3 font-fredoka">{revealed ? 'Réponse' : 'Question'}</p>
              <p className="text-[#eeeaf8] text-lg leading-relaxed">{revealed ? carte.verso : carte.recto}</p>
              {!revealed && <p className="text-[#4a4758] text-xs mt-4">Touche la carte pour voir la réponse</p>}
            </div>
          )}

          {carte.kind === 'cloze' && (
            <div style={{ width: '100%' }}>
              <p className="text-[#827f97] text-xs mb-3 font-fredoka">Texte à trous — essaie de le compléter</p>
              <p className="text-[#eeeaf8] text-lg" style={{ lineHeight: '2.4' }}>
                {parseCloze(carte.content).map((seg, i) => {
                  if (seg.type === 'text') return <span key={i}>{seg.value}</span>
                  if (!checked) {
                    return (
                      <input
                        key={i}
                        type="text"
                        value={clozeInputs[seg.index] || ''}
                        onChange={e => setClozeInputs(prev => ({ ...prev, [seg.index]: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && setChecked(true)}
                        placeholder="..."
                        className="bg-[#0f0e17] text-[#6bcb77] text-center font-fredoka outline-none mx-1 px-2 py-1 rounded-lg"
                        style={{ border: '1px solid #3a3650', minWidth: '90px', width: `${Math.max(70, seg.value.length * 12)}px` }}
                      />
                    )
                  }
                  return isAnswerCorrect(clozeInputs[seg.index] || '', seg.value) ? (
                    <span key={i} className="font-fredoka" style={{ color: '#6bcb77', fontWeight: 700 }}>{seg.value}</span>
                  ) : (
                    <span key={i} className="font-fredoka" style={{ color: '#ff6b6b' }}>
                      <span style={{ textDecoration: 'line-through' }}>{clozeInputs[seg.index] || '(vide)'}</span>
                      {' '}<span style={{ color: '#6bcb77', fontWeight: 700 }}>({seg.value})</span>
                    </span>
                  )
                })}
              </p>
              {!checked ? (
                <button onClick={() => setChecked(true)} className="font-fredoka text-sm rounded-full px-6 py-3 hover:opacity-90 transition mt-5" style={{ background: '#6bcb77', color: '#0f0e17' }}>
                  Corriger
                </button>
              ) : (
                <p className="font-fredoka text-base mt-5" style={{ color: '#ffd93d' }}>
                  {clozeScore.correct} / {clozeScore.total} bonne{clozeScore.correct !== 1 ? 's' : ''} réponse{clozeScore.total !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          )}

          {carte.kind === 'image' && (
            <div style={{ width: '100%' }}>
              <p className="text-[#827f97] text-xs mb-3 font-fredoka">Carte à trous — essaie de la compléter</p>
              <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
                {imageUrls[carte.image_path] && (
                  <img src={imageUrls[carte.image_path]} alt="" draggable={false} style={{ display: 'block', maxWidth: '100%', borderRadius: '16px', userSelect: 'none' }} />
                )}
                {carte.blanks.map(b => {
                  const correct = checked && isAnswerCorrect(imageInputs[b.id] || '', b.answer)
                  if (correct) return null
                  const wrong = checked
                  return (
                    <div
                      key={b.id}
                      style={{
                        position: 'absolute',
                        left: `${b.x}%`, top: `${b.y}%`, width: `${b.width}%`, height: `${b.height}%`,
                        background: 'rgba(8,7,12,0.97)',
                        border: `2px solid ${wrong ? '#ff6b6b' : '#6bcb77'}`,
                        borderRadius: '4px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden',
                        padding: '1px',
                      }}
                    >
                      {wrong ? (
                        <span className="font-fredoka text-center" style={{ color: '#eeeaf8', fontSize: '10px', lineHeight: '1.2' }}>{b.answer}</span>
                      ) : (
                        <input
                          type="text"
                          value={imageInputs[b.id] || ''}
                          onChange={e => setImageInputs(prev => ({ ...prev, [b.id]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && setChecked(true)}
                          className="text-center font-fredoka"
                          style={{ width: '100%', height: '100%', background: 'transparent', border: 'none', outline: 'none', color: '#eeeaf8', fontSize: '11px' }}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
              {!checked ? (
                <div>
                  <button onClick={() => setChecked(true)} className="font-fredoka text-sm rounded-full px-6 py-3 hover:opacity-90 transition mt-5" style={{ background: '#6bcb77', color: '#0f0e17' }}>
                    Corriger
                  </button>
                </div>
              ) : (
                <p className="font-fredoka text-base mt-5" style={{ color: '#ffd93d' }}>
                  {imageScore.correct} / {imageScore.total} bonne{imageScore.correct !== 1 ? 's' : ''} réponse{imageScore.total !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center">
          <button onClick={precedente} disabled={cards.length <= 1} className="font-fredoka text-sm rounded-full px-4 py-2 disabled:opacity-40 transition hover:opacity-80" style={{ background: '#1e1c2e', color: '#9b96b8', border: '1px solid #3a3650' }}>
            ← Précédente
          </button>
          <span className="text-[#827f97] text-xs">{index + 1} / {cards.length}</span>
          <button onClick={suivante} disabled={cards.length <= 1} className="font-fredoka text-sm rounded-full px-4 py-2 disabled:opacity-40 transition hover:opacity-80" style={{ background: '#1e1c2e', color: '#9b96b8', border: '1px solid #3a3650' }}>
            Suivante →
          </button>
        </div>

        <p className="text-[#8480a1] text-xs text-center mt-4">
          Ce lien ne sauvegarde aucune progression. Crée un compte sur Coolos Quiz pour réviser avec suivi.
        </p>
      </div>
    </main>
  )
}

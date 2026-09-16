'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '../../../../lib/supabase'
import { parseCloze } from '../../../../lib/cloze'
import type { ImageBlank } from '../../../../lib/imageCloze'
import Skeleton from '@/components/Skeleton'

// Un lien public peut désormais pointer vers un set composé de n'importe quel mélange des 3
// types de cartes (classique, à trous texte, carte-image à trous) — auparavant seules les cartes
// classiques étaient prises en charge, ce qui rendait "invalide" tout lien vers un set qui n'en
// avait aucune, même valide et non expiré.
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
  const [revealed, setRevealed] = useState(false)

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

  const suivante = () => {
    setRevealed(false)
    setIndex(prev => (prev + 1) % cards.length)
  }
  const precedente = () => {
    setRevealed(false)
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

  const labelHidden = carte.kind === 'image' ? 'Carte à trous' : carte.kind === 'cloze' ? 'Texte à trous' : 'Question'
  const labelReveal = carte.kind === 'image' ? 'Carte complète' : carte.kind === 'cloze' ? 'Texte complet' : 'Réponse'

  return (
    <main className="min-h-screen bg-[#0f0e17] flex flex-col items-center" style={{ padding: '40px 24px' }}>
      <div style={{ width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        <div className="text-center">
          <h1 className="font-fredoka text-2xl text-[#eeeaf8] mb-1">{setName}</h1>
          <p className="text-[#827f97] text-sm">Partagé par {ownerPseudo} · lecture seule</p>
        </div>

        <div
          onClick={() => setRevealed(r => !r)}
          className="bg-[#1a1828] border border-[#2a2830] rounded-2xl cursor-pointer"
          style={{ minHeight: '220px', padding: '32px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}
        >
          {carte.kind === 'classic' && (
            <div>
              <p className="text-[#827f97] text-xs mb-3 font-fredoka">{revealed ? labelReveal : labelHidden}</p>
              <p className="text-[#eeeaf8] text-lg leading-relaxed">{revealed ? carte.verso : carte.recto}</p>
              {!revealed && <p className="text-[#4a4758] text-xs mt-4">Touche la carte pour voir la réponse</p>}
            </div>
          )}

          {carte.kind === 'cloze' && (
            <div style={{ width: '100%' }}>
              <p className="text-[#827f97] text-xs mb-3 font-fredoka">{revealed ? labelReveal : labelHidden}</p>
              <p className="text-[#eeeaf8] text-lg leading-relaxed">
                {parseCloze(carte.content).map((seg, i) => seg.type === 'text'
                  ? <span key={i}>{seg.value}</span>
                  : revealed
                    ? <span key={i} className="font-fredoka" style={{ color: '#6bcb77' }}>{seg.value}</span>
                    : <span key={i} className="font-fredoka" style={{ color: '#6bcb77', borderBottom: '2px solid #6bcb77' }}>▁▁▁▁▁</span>
                )}
              </p>
              {!revealed && <p className="text-[#4a4758] text-xs mt-4">Touche la carte pour voir le texte complet</p>}
            </div>
          )}

          {carte.kind === 'image' && (
            <div style={{ width: '100%' }}>
              <p className="text-[#827f97] text-xs mb-3 font-fredoka">
                {revealed ? labelReveal : labelHidden}
              </p>
              <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
                {imageUrls[carte.image_path] && (
                  <img src={imageUrls[carte.image_path]} alt="" draggable={false} style={{ display: 'block', maxWidth: '100%', borderRadius: '16px', userSelect: 'none' }} />
                )}
                {!revealed && carte.blanks.map((b, i) => (
                  <div
                    key={b.id}
                    style={{
                      position: 'absolute',
                      left: `${b.x}%`, top: `${b.y}%`, width: `${b.width}%`, height: `${b.height}%`,
                      background: 'rgba(8,7,12,0.97)',
                      border: '2px solid #6bcb77',
                      borderRadius: '4px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <span className="font-fredoka text-xs" style={{ color: '#0f0e17', background: '#6bcb77', borderRadius: '9999px', padding: '1px 6px' }}>
                      {i + 1}
                    </span>
                  </div>
                ))}
              </div>
              {!revealed ? (
                <p className="text-[#4a4758] text-xs mt-4">Touche la carte pour voir la carte complète</p>
              ) : (
                carte.blanks.length > 0 && (
                  <div className="text-left mt-4" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {carte.blanks.map((b, i) => (
                      <p key={b.id} className="text-[#9b96b8] text-xs">
                        <span className="font-fredoka" style={{ color: '#6bcb77' }}>{i + 1}.</span> {b.answer}
                      </p>
                    ))}
                  </div>
                )
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

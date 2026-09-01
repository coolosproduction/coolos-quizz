'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '../../../../lib/supabase'
import Skeleton from '@/components/Skeleton'

type PublicCard = { card_id: string, recto: string, verso: string }

export default function RevisionPartagePublique() {
  const params = useParams()
  const token = params.token as string

  const [loading, setLoading] = useState(true)
  const [invalid, setInvalid] = useState(false)
  const [setName, setSetName] = useState('')
  const [ownerPseudo, setOwnerPseudo] = useState('')
  const [cards, setCards] = useState<PublicCard[]>([])
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_public_revision_set', { p_token: token })
      if (error || !data || data.length === 0) { setInvalid(true); setLoading(false); return }
      setSetName(data[0].set_name)
      setOwnerPseudo(data[0].owner_pseudo)
      setCards(data.map((d: any) => ({ card_id: d.card_id, recto: d.recto, verso: d.verso })))
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
        <p className="font-fredoka text-[#ff6b6b] text-xl">Ce lien est invalide ou a expiré.</p>
        <p className="text-[#827f97] text-sm">Les liens de partage de révision expirent 7 jours après leur création.</p>
        <Link href="/" className="font-fredoka text-sm text-[#a78bfa] mt-2">← Retour à l'accueil</Link>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#0f0e17] flex flex-col items-center" style={{ padding: '40px 24px' }}>
      <div style={{ width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        <div className="text-center">
          <h1 className="font-fredoka text-2xl text-[#eeeaf8] mb-1">{setName}</h1>
          <p className="text-[#827f97] text-sm">Partagé par {ownerPseudo} · lecture seule</p>
        </div>

        <div
          onClick={() => setRevealed(r => !r)}
          className="bg-[#1a1828] border border-[#2a2830] rounded-2xl cursor-pointer flex items-center justify-center text-center"
          style={{ minHeight: '220px', padding: '32px 24px' }}
        >
          <div>
            <p className="text-[#827f97] text-xs mb-3 font-fredoka">{revealed ? 'Réponse' : 'Question'}</p>
            <p className="text-[#eeeaf8] text-lg leading-relaxed">{revealed ? carte.verso : carte.recto}</p>
            {!revealed && <p className="text-[#4a4758] text-xs mt-4">Touche la carte pour voir la réponse</p>}
          </div>
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

'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase'
import BackButton from '@/components/BackButton'
import Skeleton, { SkeletonList } from '@/components/Skeleton'

type Card = { id: string, recto: string, verso: string }
type WorstCard = { card_id: string, recto: string, verso: string, non_count: number, attempts_count: number }
type SetOverview = { set_id: string, name: string, cards_count: number, sessions_count: number, last_session_at: string | null, success_rate: number }

const performanceColor = (rate: number) => (rate >= 70 ? '#6bcb77' : rate >= 40 ? '#ffd93d' : '#ff6b6b')

export default function GererSet() {
  const params = useParams()
  const router = useRouter()
  const setId = params.setId as string

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [setName, setSetName] = useState('')
  const [cards, setCards] = useState<Card[]>([])
  const [overview, setOverview] = useState<SetOverview | null>(null)
  const [worstCards, setWorstCards] = useState<WorstCard[]>([])

  const [renaming, setRenaming] = useState(false)
  const [nameInput, setNameInput] = useState('')

  const [newRecto, setNewRecto] = useState('')
  const [newVerso, setNewVerso] = useState('')
  const [adding, setAdding] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRecto, setEditRecto] = useState('')
  const [editVerso, setEditVerso] = useState('')

  const [confirmDeleteSet, setConfirmDeleteSet] = useState(false)
  const [confirmDeleteCard, setConfirmDeleteCard] = useState<string | null>(null)

  const loadAll = async () => {
    const supabase = createClient()

    const { data: setData } = await supabase
      .from('revision_sets')
      .select('id, name')
      .eq('id', setId)
      .maybeSingle()

    if (!setData) { setNotFound(true); setLoading(false); return }
    setSetName(setData.name)
    setNameInput(setData.name)

    const { data: cardsData } = await supabase
      .from('revision_cards')
      .select('id, recto, verso')
      .eq('set_id', setId)
      .order('created_at', { ascending: true })
    setCards((cardsData || []) as Card[])

    const { data: overviewData } = await supabase.rpc('get_revision_sets_overview')
    const mine = ((overviewData || []) as SetOverview[]).find(o => o.set_id === setId) || null
    setOverview(mine)

    const { data: worstData } = await supabase.rpc('get_revision_worst_cards', { p_set_id: setId, p_limit: 3 })
    setWorstCards((worstData || []) as WorstCard[])

    setLoading(false)
  }

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/connexion'); return }
      await loadAll()
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId])

  const handleRenommer = async () => {
    const name = nameInput.trim()
    if (!name) return
    const supabase = createClient()
    await supabase.from('revision_sets').update({ name, updated_at: new Date().toISOString() }).eq('id', setId)
    setSetName(name)
    setRenaming(false)
  }

  const handleSupprimerSet = async () => {
    const supabase = createClient()
    await supabase.from('revision_sets').delete().eq('id', setId)
    router.push('/revision')
  }

  const handleAjouterCarte = async () => {
    const recto = newRecto.trim()
    const verso = newVerso.trim()
    if (!recto || !verso) return
    setAdding(true)
    const supabase = createClient()
    await supabase.from('revision_cards').insert({ set_id: setId, recto, verso })
    setNewRecto('')
    setNewVerso('')
    await loadAll()
    setAdding(false)
  }

  const commencerEdition = (card: Card) => {
    setEditingId(card.id)
    setEditRecto(card.recto)
    setEditVerso(card.verso)
  }

  const handleSauvegarderEdition = async (cardId: string) => {
    const recto = editRecto.trim()
    const verso = editVerso.trim()
    if (!recto || !verso) return
    const supabase = createClient()
    await supabase.from('revision_cards').update({ recto, verso }).eq('id', cardId)
    setEditingId(null)
    await loadAll()
  }

  const handleSupprimerCarte = async (cardId: string) => {
    const supabase = createClient()
    await supabase.from('revision_cards').delete().eq('id', cardId)
    setConfirmDeleteCard(null)
    await loadAll()
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0f0e17]" style={{ padding: '32px 24px 60px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>
          <div className="flex items-center gap-3">
            <BackButton />
            <Skeleton width="220px" height={32} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Skeleton height={72} radius="16px" />
            <Skeleton height={72} radius="16px" />
            <Skeleton height={72} radius="16px" />
          </div>
          <SkeletonList count={3} avatar={false} />
        </div>
      </main>
    )
  }

  if (notFound) {
    return (
      <main className="min-h-screen bg-[#0f0e17] flex flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="font-fredoka text-[#ff6b6b] text-xl">Ce set est introuvable.</p>
        <Link href="/revision" className="bg-[#ffd93d] text-[#0f0e17] rounded-2xl py-3 px-8 font-fredoka text-lg">
          Retour à mes révisions
        </Link>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#0f0e17]" style={{ padding: '32px 24px 60px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>

        <div className="flex items-center gap-3">
          <BackButton />
          <div className="flex-1 min-w-0">
            {renaming ? (
              <div className="flex gap-2 items-center flex-wrap">
                <input
                  type="text"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleRenommer()}
                  maxLength={60}
                  autoFocus
                  className="bg-[#0f0e17] border border-[#a78bfa] rounded-xl px-3 py-2 text-[#eeeaf8] font-fredoka text-xl outline-none"
                />
                <button onClick={handleRenommer} className="font-fredoka text-xs rounded-full px-3 py-1.5 hover:opacity-80 transition" style={{ background: '#a78bfa', color: '#0f0e17' }}>
                  Sauver
                </button>
                <button onClick={() => { setRenaming(false); setNameInput(setName) }} className="font-fredoka text-xs text-[#827f97] hover:text-[#c9c4e0] transition">
                  Annuler
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-fredoka text-3xl text-[#eeeaf8]">{setName}</h1>
                <button onClick={() => setRenaming(true)} className="font-fredoka text-xs text-[#827f97] hover:text-[#a78bfa] transition">
                  Renommer
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Stats légères */}
        {overview && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-4 text-center">
              <div className="font-fredoka text-2xl text-[#ffd93d]">{overview.cards_count}</div>
              <div className="text-[#827f97] text-xs">Cartes</div>
            </div>
            <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-4 text-center">
              <div className="font-fredoka text-2xl text-[#4ecdc4]">{overview.sessions_count}</div>
              <div className="text-[#827f97] text-xs">Sessions</div>
            </div>
            <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-4 text-center">
              <div className="font-fredoka text-2xl" style={{ color: overview.sessions_count > 0 ? performanceColor(overview.success_rate) : '#827f97' }}>
                {overview.sessions_count > 0 ? `${overview.success_rate}%` : '—'}
              </div>
              <div className="text-[#827f97] text-xs">Réussite</div>
            </div>
          </div>
        )}

        {worstCards.length > 0 && (
          <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl" style={{ padding: '16px 20px' }}>
            <p className="font-fredoka text-[#c9c4e0] text-base mb-3">Cartes les plus ratées</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {worstCards.map(w => (
                <div key={w.card_id} className="flex justify-between items-center gap-3 bg-[#0f0e17] rounded-lg px-3 py-2">
                  <span className="text-[#c9c4e0] text-sm truncate">{w.recto}</span>
                  <span className="text-[#ff6b6b] text-xs font-fredoka flex-shrink-0">{w.non_count}/{w.attempts_count} ratées</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lancer une session */}
        {cards.length > 0 ? (
          <div className="flex gap-3 flex-wrap">
            <Link href={`/revision/etudier/${setId}?mode=classique`} className="flex-1 rounded-2xl py-4 font-fredoka text-lg text-center hover:opacity-90 transition" style={{ background: '#2a1f3d', color: '#a78bfa', border: '1px solid #a78bfa', minWidth: '200px' }}>
              Étudier — Classique →
            </Link>
            <Link href={`/revision/etudier/${setId}?mode=flashcard`} className="flex-1 rounded-2xl py-4 font-fredoka text-lg text-center hover:opacity-90 transition" style={{ background: '#1a2a2d', color: '#4ecdc4', border: '1px solid #4ecdc4', minWidth: '200px' }}>
              Étudier — Flashcard →
            </Link>
          </div>
        ) : (
          <p className="text-[#827f97] text-sm text-center">Ajoute au moins une carte ci-dessous pour pouvoir étudier ce set.</p>
        )}

        {/* Ajouter une carte */}
        <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-5">
          <p className="font-fredoka text-[#c9c4e0] text-base mb-3">Ajouter une carte</p>
          <div className="flex gap-3 flex-wrap mb-3">
            <textarea
              value={newRecto}
              onChange={e => setNewRecto(e.target.value)}
              placeholder="Recto (question)"
              rows={2}
              maxLength={500}
              className="flex-1 bg-[#0f0e17] border border-[#3a3650] rounded-xl px-4 py-3 text-[#eeeaf8] text-sm outline-none focus:border-[#a78bfa] resize-none"
              style={{ minWidth: '200px' }}
            />
            <textarea
              value={newVerso}
              onChange={e => setNewVerso(e.target.value)}
              placeholder="Verso (réponse)"
              rows={2}
              maxLength={500}
              className="flex-1 bg-[#0f0e17] border border-[#3a3650] rounded-xl px-4 py-3 text-[#eeeaf8] text-sm outline-none focus:border-[#a78bfa] resize-none"
              style={{ minWidth: '200px' }}
            />
          </div>
          <button
            onClick={handleAjouterCarte}
            disabled={adding || !newRecto.trim() || !newVerso.trim()}
            className="bg-[#ffd93d] text-[#0f0e17] rounded-xl px-6 py-3 font-fredoka text-sm hover:opacity-90 transition disabled:opacity-50"
          >
            {adding ? 'Ajout...' : '+ Ajouter la carte'}
          </button>
        </div>

        {/* Liste des cartes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {cards.length === 0 ? (
            <p className="text-[#827f97] text-sm text-center">Aucune carte pour l'instant.</p>
          ) : cards.map(c => (
            <div key={c.id} className="bg-[#1a1828] border border-[#2a2830] rounded-xl" style={{ padding: '14px 18px' }}>
              {editingId === c.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <textarea
                    value={editRecto}
                    onChange={e => setEditRecto(e.target.value)}
                    rows={2}
                    maxLength={500}
                    className="w-full bg-[#0f0e17] border border-[#a78bfa] rounded-xl px-4 py-3 text-[#eeeaf8] text-sm outline-none resize-none"
                  />
                  <textarea
                    value={editVerso}
                    onChange={e => setEditVerso(e.target.value)}
                    rows={2}
                    maxLength={500}
                    className="w-full bg-[#0f0e17] border border-[#a78bfa] rounded-xl px-4 py-3 text-[#eeeaf8] text-sm outline-none resize-none"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => handleSauvegarderEdition(c.id)} className="font-fredoka text-xs rounded-full px-4 py-2 hover:opacity-80 transition" style={{ background: '#a78bfa', color: '#0f0e17' }}>
                      Sauvegarder
                    </button>
                    <button onClick={() => setEditingId(null)} className="font-fredoka text-xs text-[#827f97] hover:text-[#c9c4e0] transition">
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-0" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <p className="text-[#eeeaf8] text-sm"><span className="text-[#827f97]">Recto : </span>{c.recto}</p>
                    <p className="text-[#c9c4e0] text-sm"><span className="text-[#827f97]">Verso : </span>{c.verso}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => commencerEdition(c)} className="font-fredoka text-xs text-[#827f97] hover:text-[#a78bfa] transition">
                      Modifier
                    </button>
                    {confirmDeleteCard === c.id ? (
                      <>
                        <button onClick={() => handleSupprimerCarte(c.id)} className="font-fredoka text-xs rounded-full px-3 py-1.5 hover:opacity-80 transition" style={{ background: '#ff6b6b', color: '#0f0e17' }}>
                          Confirmer
                        </button>
                        <button onClick={() => setConfirmDeleteCard(null)} className="font-fredoka text-xs text-[#827f97] hover:text-[#c9c4e0] transition">
                          Annuler
                        </button>
                      </>
                    ) : (
                      <button onClick={() => setConfirmDeleteCard(c.id)} className="font-fredoka text-xs text-[#827f97] hover:text-[#ff6b6b] transition">
                        Supprimer
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Supprimer le set */}
        <div style={{ borderTop: '1px solid #1e1c2e', paddingTop: '20px' }}>
          {confirmDeleteSet ? (
            <div className="flex items-center gap-3 justify-center">
              <span className="text-[#9b96b8] text-sm">Supprimer définitivement ce set et toutes ses cartes ?</span>
              <button onClick={handleSupprimerSet} className="font-fredoka text-sm rounded-full px-4 py-2 hover:opacity-80 transition" style={{ background: '#ff6b6b', color: '#0f0e17' }}>
                Confirmer
              </button>
              <button onClick={() => setConfirmDeleteSet(false)} className="font-fredoka text-sm text-[#827f97] hover:text-[#c9c4e0] transition">
                Annuler
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmDeleteSet(true)} className="w-full text-[#827f97] text-sm font-semibold hover:text-[#ff6b6b] transition text-center">
              Supprimer ce set
            </button>
          )}
        </div>

      </div>
    </main>
  )
}

'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import BackButton from '@/components/BackButton'

type SetOverview = {
  set_id: string
  name: string
  cards_count: number
  sessions_count: number
  last_session_at: string | null
  success_rate: number
}

const performanceColor = (rate: number) => (rate >= 70 ? '#6bcb77' : rate >= 40 ? '#ffd93d' : '#ff6b6b')

export default function Revision() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [hasPremiumAccess, setHasPremiumAccess] = useState(false)
  const [sets, setSets] = useState<SetOverview[]>([])
  const [newSetName, setNewSetName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const loadSets = async () => {
    const supabase = createClient()
    const { data } = await supabase.rpc('get_revision_sets_overview')
    setSets((data || []) as SetOverview[])
  }

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/connexion'); return }

      const { data: premiumAccess } = await supabase.rpc('has_premium_access')
      setHasPremiumAccess(!!premiumAccess)

      if (premiumAccess) await loadSets()
      setLoading(false)
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCreerSet = async () => {
    const name = newSetName.trim()
    if (!name) return
    setCreating(true)
    setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setCreating(false); return }

    const { error: insertError } = await supabase.from('revision_sets').insert({ user_id: user.id, name })
    if (insertError) {
      setError("Impossible de créer ce set.")
      setCreating(false)
      return
    }
    setNewSetName('')
    await loadSets()
    setCreating(false)
  }

  const handleSupprimerSet = async (setId: string) => {
    const supabase = createClient()
    await supabase.from('revision_sets').delete().eq('id', setId)
    setConfirmDeleteId(null)
    await loadSets()
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0f0e17] flex items-center justify-center">
        <p className="font-fredoka text-[#9b96b8] text-xl">Chargement...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#0f0e17]" style={{ padding: '32px 24px 60px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>

        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <h1 className="font-fredoka text-3xl text-[#eeeaf8] mb-1">★ Mes révisions</h1>
            <p className="text-[#9b96b8] text-sm">Fiches privées de révision — classique ou flashcard</p>
          </div>
        </div>

        {!hasPremiumAccess ? (
          <div className="bg-[#1a1828] border rounded-2xl p-10 text-center" style={{ borderColor: '#4a3a10' }}>
            <p className="font-fredoka text-[#ffd93d] text-xl mb-2">★ Fonctionnalité Premium</p>
            <p className="text-[#9b96b8] text-sm leading-relaxed">
              La révision par fiches personnelles (recto/verso, mode classique ou flashcard) est réservée
              aux comptes premium.
            </p>
          </div>
        ) : (
          <>
            {/* Créer un set */}
            <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-5">
              <p className="font-fredoka text-[#c9c4e0] text-base mb-3">Créer un nouveau set</p>
              <div className="flex gap-3 flex-wrap">
                <input
                  type="text"
                  value={newSetName}
                  onChange={e => setNewSetName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreerSet()}
                  placeholder="Ex. Vocabulaire espagnol, Dates d'histoire..."
                  maxLength={60}
                  className="flex-1 bg-[#0f0e17] border border-[#3a3650] rounded-xl px-4 py-3 text-[#eeeaf8] font-fredoka text-sm outline-none focus:border-[#a78bfa]"
                  style={{ minWidth: '220px' }}
                />
                <button
                  onClick={handleCreerSet}
                  disabled={creating || !newSetName.trim()}
                  className="bg-[#ffd93d] text-[#0f0e17] rounded-xl px-6 py-3 font-fredoka text-sm hover:opacity-90 transition disabled:opacity-50"
                >
                  {creating ? 'Création...' : '+ Créer'}
                </button>
              </div>
              {error && <p className="text-[#ff6b6b] text-sm mt-2">{error}</p>}
            </div>

            {/* Liste des sets */}
            {sets.length === 0 ? (
              <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-10 text-center">
                <p className="font-fredoka text-[#9b96b8] text-xl mb-2">Aucun set pour l'instant</p>
                <p className="text-[#6b6880] text-sm">Crée ton premier set ci-dessus pour commencer à réviser.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {sets.map(s => (
                  <div key={s.set_id} className="bg-[#1a1828] border border-[#2a2830] rounded-2xl" style={{ padding: '18px 20px' }}>
                    <div className="flex justify-between items-start flex-wrap gap-3 mb-3">
                      <div>
                        <Link href={`/revision/${s.set_id}`} className="font-fredoka text-[#eeeaf8] text-lg hover:text-[#a78bfa] transition">
                          {s.name}
                        </Link>
                        <div className="flex gap-3 flex-wrap mt-1">
                          <span className="text-[#6b6880] text-xs">{s.cards_count} carte{s.cards_count !== 1 ? 's' : ''}</span>
                          <span className="text-[#6b6880] text-xs">{s.sessions_count} session{s.sessions_count !== 1 ? 's' : ''}</span>
                          {s.sessions_count > 0 && (
                            <span className="text-xs font-fredoka" style={{ color: performanceColor(s.success_rate) }}>
                              {s.success_rate}% de réussite
                            </span>
                          )}
                        </div>
                      </div>
                      {confirmDeleteId === s.set_id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[#9b96b8] text-xs">Supprimer ?</span>
                          <button onClick={() => handleSupprimerSet(s.set_id)} className="font-fredoka text-xs rounded-full px-3 py-1.5" style={{ background: '#ff6b6b', color: '#0f0e17' }}>
                            Confirmer
                          </button>
                          <button onClick={() => setConfirmDeleteId(null)} className="font-fredoka text-xs rounded-full px-3 py-1.5" style={{ background: 'transparent', color: '#9b96b8', border: '1px solid #3a3650' }}>
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDeleteId(s.set_id)} className="font-fredoka text-xs text-[#6b6880] hover:text-[#ff6b6b] transition flex-shrink-0">
                          Supprimer
                        </button>
                      )}
                    </div>

                    <div className="flex gap-3 flex-wrap">
                      <Link href={`/revision/${s.set_id}`} className="font-fredoka text-xs rounded-full px-4 py-2" style={{ background: '#1e1c2e', color: '#9b96b8', border: '1px solid #3a3650' }}>
                        Gérer les cartes
                      </Link>
                      {s.cards_count > 0 && (
                        expandedId === s.set_id ? (
                          <div className="flex gap-2">
                            <Link href={`/revision/etudier/${s.set_id}?mode=classique`} className="font-fredoka text-xs rounded-full px-4 py-2" style={{ background: '#2a1f3d', color: '#a78bfa', border: '1px solid #a78bfa' }}>
                              Classique →
                            </Link>
                            <Link href={`/revision/etudier/${s.set_id}?mode=flashcard`} className="font-fredoka text-xs rounded-full px-4 py-2" style={{ background: '#1a2a2d', color: '#4ecdc4', border: '1px solid #4ecdc4' }}>
                              Flashcard →
                            </Link>
                          </div>
                        ) : (
                          <button onClick={() => setExpandedId(s.set_id)} className="font-fredoka text-xs rounded-full px-4 py-2" style={{ background: '#1f1e10', color: '#ffd93d', border: '1px solid #ffd93d' }}>
                            Étudier
                          </button>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

      </div>
    </main>
  )
}

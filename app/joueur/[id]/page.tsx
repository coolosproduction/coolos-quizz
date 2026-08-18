'use client'

import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase'

type Identite = {
  pseudo: string
  avatar_url: string | null
}

type StatsGenerales = {
  rank: number
  total_score: number
  questions_played: number
  correct_answers: number
  success_rate: number
}

type StatCategorie = {
  category_id: string
  category_name: string
  total_score: number
  questions_played: number
  correct_answers: number
  success_rate: number
}

type FriendRow = {
  id: string
  requester_id: string
  recipient_id: string
  status: 'pending' | 'accepted' | 'declined'
}

type Relation = 'none' | 'pending_sent' | 'pending_received' | 'friends'

export default function ProfilPublic() {
  const params = useParams()
  const router = useRouter()
  const targetId = params.id as string

  const [meId, setMeId] = useState<string | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)

  const [identite, setIdentite] = useState<Identite | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [stats, setStats] = useState<StatsGenerales | null>(null)
  const [statsCategories, setStatsCategories] = useState<StatCategorie[]>([])
  const [loading, setLoading] = useState(true)

  const [friendRow, setFriendRow] = useState<FriendRow | null>(null)
  const [bloqueParMoi, setBloqueParMoi] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<'unfriend' | 'block' | null>(null)

  const relation: Relation = !friendRow ? 'none'
    : friendRow.status === 'accepted' ? 'friends'
    : friendRow.requester_id === meId ? 'pending_sent'
    : 'pending_received'

  const loadRelation = useCallback(async (uid: string) => {
    const supabase = createClient()
    const { data: fr } = await supabase
      .from('friend_requests')
      .select('id, requester_id, recipient_id, status')
      .or(`and(requester_id.eq.${uid},recipient_id.eq.${targetId}),and(requester_id.eq.${targetId},recipient_id.eq.${uid})`)
      .in('status', ['pending', 'accepted'])
      .maybeSingle()
    setFriendRow(fr as FriendRow | null)

    const { data: bl } = await supabase
      .from('blocks')
      .select('id')
      .eq('blocker_id', uid)
      .eq('blocked_id', targetId)
      .maybeSingle()
    setBloqueParMoi(!!bl)
  }, [targetId])

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setMeId(user?.id || null)
      setCheckingAuth(false)

      const { data: idData, error: idError } = await supabase
        .rpc('get_user_public_identity', { p_user_id: targetId })

      if (idError || !idData || idData.length === 0) {
        setNotFound(true)
        setLoading(false)
        return
      }

      setIdentite({ pseudo: idData[0].pseudo, avatar_url: idData[0].avatar_url })

      const { data: rankData } = await supabase
        .rpc('get_user_rank', { p_user_id: targetId, p_category_id: null })
      if (rankData && rankData.length > 0) {
        const r = rankData[0]
        setStats({
          rank: Number(r.rank),
          total_score: Number(r.total_score),
          questions_played: Number(r.questions_played),
          correct_answers: Number(r.correct_answers),
          success_rate: Number(r.success_rate),
        })
      }

      const { data: catData } = await supabase
        .rpc('get_user_category_stats', { p_user_id: targetId })
      if (catData) {
        setStatsCategories((catData as any[]).map(c => ({
          category_id: c.category_id,
          category_name: c.category_name,
          total_score: Number(c.total_score),
          questions_played: Number(c.questions_played),
          correct_answers: Number(c.correct_answers),
          success_rate: Number(c.success_rate),
        })))
      }

      if (user) {
        await loadRelation(user.id)
      }

      setLoading(false)
    }
    init()
  }, [targetId, loadRelation])

  const envoyerDemande = async () => {
    if (!meId) return
    setActionLoading(true)
    setActionError(null)
    const supabase = createClient()
    const { error } = await supabase
      .from('friend_requests')
      .insert({ requester_id: meId, recipient_id: targetId, status: 'pending' })
    if (error) {
      setActionError("Impossible d'envoyer une demande à ce joueur.")
    } else {
      await loadRelation(meId)
    }
    setActionLoading(false)
  }

  const annulerDemande = async () => {
    if (!meId || !friendRow) return
    setActionLoading(true)
    setActionError(null)
    const supabase = createClient()
    const { error } = await supabase.from('friend_requests').delete().eq('id', friendRow.id)
    if (error) setActionError("Impossible d'annuler la demande.")
    else await loadRelation(meId)
    setActionLoading(false)
  }

  const repondreDemande = async (status: 'accepted' | 'declined') => {
    if (!meId || !friendRow) return
    setActionLoading(true)
    setActionError(null)
    const supabase = createClient()
    const { error } = await supabase
      .from('friend_requests')
      .update({ status, responded_at: new Date().toISOString() })
      .eq('id', friendRow.id)
    if (error) setActionError('Impossible de répondre à cette demande.')
    else await loadRelation(meId)
    setActionLoading(false)
  }

  const retirerAmi = async () => {
    if (!meId || !friendRow) return
    setActionLoading(true)
    setActionError(null)
    const supabase = createClient()
    const { error } = await supabase.from('friend_requests').delete().eq('id', friendRow.id)
    if (error) setActionError('Impossible de retirer ce joueur de tes amis.')
    else await loadRelation(meId)
    setConfirmAction(null)
    setActionLoading(false)
  }

  const bloquer = async () => {
    if (!meId) return
    setActionLoading(true)
    setActionError(null)
    const supabase = createClient()
    const { error } = await supabase.from('blocks').insert({ blocker_id: meId, blocked_id: targetId })
    if (error) setActionError('Impossible de bloquer ce joueur.')
    else await loadRelation(meId)
    setConfirmAction(null)
    setActionLoading(false)
  }

  const debloquer = async () => {
    if (!meId) return
    setActionLoading(true)
    setActionError(null)
    const supabase = createClient()
    const { error } = await supabase.from('blocks').delete().eq('blocker_id', meId).eq('blocked_id', targetId)
    if (error) setActionError('Impossible de débloquer ce joueur.')
    else await loadRelation(meId)
    setActionLoading(false)
  }

  if (checkingAuth || loading) {
    return (
      <main className="min-h-screen bg-[#0f0e17] flex items-center justify-center">
        <p className="font-fredoka text-[#9b96b8] text-xl">Chargement...</p>
      </main>
    )
  }

  if (notFound || !identite) {
    return (
      <main className="min-h-screen bg-[#0f0e17] flex flex-col items-center justify-center gap-4">
        <p className="font-fredoka text-[#9b96b8] text-xl">Joueur introuvable.</p>
        <Link href="/classement" className="font-fredoka text-sm text-[#a78bfa]">← Retour au classement</Link>
      </main>
    )
  }

  const cestMoi = meId === targetId

  return (
    <main className="min-h-screen bg-[#0f0e17]" style={{ padding: '32px 24px 60px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        <Link href="/classement" className="font-fredoka text-sm text-[#a78bfa] hover:opacity-80 transition">
          ← Retour au classement
        </Link>

        <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl" style={{ padding: '24px' }}>
          <div className="flex items-center gap-5 flex-wrap justify-between">
            <div className="flex items-center gap-5">
              <div className="rounded-full overflow-hidden flex items-center justify-center flex-shrink-0" style={{ width: '64px', height: '64px', border: '3px solid #a78bfa', background: '#2a1f3d' }}>
                {identite.avatar_url ? (
                  <img src={identite.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#a78bfa]"></div>
                )}
              </div>
              <div>
                <h1 className="font-fredoka text-2xl text-[#eeeaf8]">{identite.pseudo}</h1>
                {stats && (
                  <p className="text-[#6b6880] text-sm">Rang #{stats.rank} au classement général</p>
                )}
              </div>
            </div>

            {cestMoi ? (
              <Link href="/profil" className="font-fredoka text-sm rounded-full px-4 py-2 flex-shrink-0" style={{ background: '#2a1f3d', color: '#a78bfa', border: '1px solid #3a2d5a' }}>
                C'est toi · Voir ton profil
              </Link>
            ) : meId ? (
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {bloqueParMoi ? (
                    <button
                      onClick={debloquer}
                      disabled={actionLoading}
                      className="font-fredoka text-sm rounded-full px-4 py-2 disabled:opacity-50"
                      style={{ background: 'transparent', color: '#9b96b8', border: '1px solid #3a3650' }}
                    >
                      Débloquer
                    </button>
                  ) : (
                    <>
                      {relation === 'none' && (
                        <button
                          onClick={envoyerDemande}
                          disabled={actionLoading}
                          className="font-fredoka text-sm rounded-full px-4 py-2 disabled:opacity-50"
                          style={{ background: '#a78bfa', color: '#0f0e17' }}
                        >
                          + Ajouter en ami
                        </button>
                      )}
                      {relation === 'pending_sent' && (
                        <button
                          onClick={annulerDemande}
                          disabled={actionLoading}
                          className="font-fredoka text-sm rounded-full px-4 py-2 disabled:opacity-50"
                          style={{ background: 'transparent', color: '#9b96b8', border: '1px solid #3a3650' }}
                        >
                          Demande envoyée · Annuler
                        </button>
                      )}
                      {relation === 'pending_received' && (
                        <>
                          <button
                            onClick={() => repondreDemande('accepted')}
                            disabled={actionLoading}
                            className="font-fredoka text-sm rounded-full px-4 py-2 disabled:opacity-50"
                            style={{ background: '#6bcb77', color: '#0f0e17' }}
                          >
                            Accepter
                          </button>
                          <button
                            onClick={() => repondreDemande('declined')}
                            disabled={actionLoading}
                            className="font-fredoka text-sm rounded-full px-4 py-2 disabled:opacity-50"
                            style={{ background: 'transparent', color: '#9b96b8', border: '1px solid #3a3650' }}
                          >
                            Refuser
                          </button>
                        </>
                      )}
                      {relation === 'friends' && (
                        confirmAction === 'unfriend' ? (
                          <>
                            <span className="text-[#9b96b8] text-xs">Retirer cet ami ?</span>
                            <button onClick={retirerAmi} disabled={actionLoading} className="font-fredoka text-sm rounded-full px-4 py-2 disabled:opacity-50" style={{ background: '#ff6b6b', color: '#0f0e17' }}>
                              Confirmer
                            </button>
                            <button onClick={() => setConfirmAction(null)} className="font-fredoka text-sm rounded-full px-4 py-2" style={{ background: 'transparent', color: '#9b96b8', border: '1px solid #3a3650' }}>
                              Annuler
                            </button>
                          </>
                        ) : (
                          <span className="flex items-center gap-2">
                            <span className="font-fredoka text-sm rounded-full px-4 py-2" style={{ background: '#1a2e1f', color: '#6bcb77', border: '1px solid #2a4a30' }}>
                              ✓ Amis
                            </span>
                            <button onClick={() => setConfirmAction('unfriend')} className="font-fredoka text-xs text-[#6b6880] hover:text-[#ff6b6b] transition">
                              Retirer
                            </button>
                          </span>
                        )
                      )}
                      {confirmAction === 'block' ? (
                        <span className="flex items-center gap-2">
                          <span className="text-[#9b96b8] text-xs">Bloquer ce joueur ?</span>
                          <button onClick={bloquer} disabled={actionLoading} className="font-fredoka text-sm rounded-full px-4 py-2 disabled:opacity-50" style={{ background: '#ff6b6b', color: '#0f0e17' }}>
                            Confirmer
                          </button>
                          <button onClick={() => setConfirmAction(null)} className="font-fredoka text-sm rounded-full px-4 py-2" style={{ background: 'transparent', color: '#9b96b8', border: '1px solid #3a3650' }}>
                            Annuler
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmAction('block')}
                          className="font-fredoka text-xs text-[#6b6880] hover:text-[#ff6b6b] transition"
                          style={{ padding: '8px 4px' }}
                        >
                          Bloquer
                        </button>
                      )}
                    </>
                  )}
                </div>
                {actionError && <p className="text-[#ff6b6b] text-xs">{actionError}</p>}
              </div>
            ) : (
              <Link href="/connexion" className="font-fredoka text-sm rounded-full px-4 py-2 flex-shrink-0" style={{ background: '#a78bfa', color: '#0f0e17' }}>
                Connexion pour ajouter en ami
              </Link>
            )}
          </div>
        </div>

        {/* Stats générales */}
        {stats ? (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-5 text-center">
              <div className="font-fredoka text-3xl text-[#ffd93d] mb-1">{stats.total_score % 1 === 0 ? stats.total_score : stats.total_score.toFixed(1)}</div>
              <div className="text-[#6b6880] text-sm">Score total</div>
            </div>
            <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-5 text-center">
              <div className="font-fredoka text-3xl text-[#4ecdc4] mb-1">{stats.questions_played}</div>
              <div className="text-[#6b6880] text-sm">Questions jouées</div>
            </div>
            <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-5 text-center">
              <div className="font-fredoka text-3xl text-[#6bcb77] mb-1">{stats.success_rate}%</div>
              <div className="text-[#6b6880] text-sm">Réussite</div>
            </div>
          </div>
        ) : (
          <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-10 text-center">
            <p className="font-fredoka text-[#9b96b8] text-xl">Ce joueur n'a pas encore joué de partie.</p>
          </div>
        )}

        {/* Stats par catégorie */}
        {statsCategories.length > 0 && (
          <div>
            <h2 className="font-fredoka text-xl text-[#eeeaf8] mb-3">Par catégorie</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {statsCategories.map(cat => (
                <div key={cat.category_id} className="bg-[#1a1828] border border-[#2a2830] rounded-2xl" style={{ padding: '16px 20px' }}>
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-fredoka text-[#eeeaf8] text-base">{cat.category_name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[#6b6880] text-xs">{cat.questions_played} questions</span>
                      <span className="font-fredoka text-sm" style={{ color: cat.success_rate >= 70 ? '#6bcb77' : cat.success_rate >= 40 ? '#ffd93d' : '#ff6b6b' }}>
                        {cat.success_rate}%
                      </span>
                    </div>
                  </div>
                  <div className="bg-[#0f0e17] rounded-full" style={{ height: '8px' }}>
                    <div
                      className="rounded-full"
                      style={{
                        height: '8px',
                        width: `${Math.min(cat.success_rate, 100)}%`,
                        background: cat.success_rate >= 70 ? '#6bcb77' : cat.success_rate >= 40 ? '#ffd93d' : '#ff6b6b',
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-[#4a4760] text-xs text-center">
          Seules les statistiques agrégées sont visibles ici — l'historique détaillé des parties reste privé.
        </p>

      </div>
    </main>
  )
}

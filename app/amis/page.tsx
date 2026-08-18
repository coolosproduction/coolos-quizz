'use client'

import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import Avatar from '@/components/Avatar'
import BackButton from '@/components/BackButton'

type Identite = { pseudo: string, avatar_url: string | null }

type FriendRequestRow = {
  id: string
  requester_id: string
  recipient_id: string
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
}

type BlockRow = {
  id: string
  blocked_id: string
  created_at: string
}

type Onglet = 'amis' | 'recues' | 'envoyees' | 'bloques'

export default function Amis() {
  const router = useRouter()
  const [meId, setMeId] = useState<string | null>(null)
  const [onglet, setOnglet] = useState<Onglet>('amis')
  const [loading, setLoading] = useState(true)

  const [amis, setAmis] = useState<FriendRequestRow[]>([])
  const [recues, setRecues] = useState<FriendRequestRow[]>([])
  const [envoyees, setEnvoyees] = useState<FriendRequestRow[]>([])
  const [bloques, setBloques] = useState<BlockRow[]>([])
  const [identites, setIdentites] = useState<Record<string, Identite>>({})

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const otherIdOf = (row: FriendRequestRow, uid: string) => row.requester_id === uid ? row.recipient_id : row.requester_id

  const chargerIdentites = useCallback(async (ids: string[]) => {
    const supabase = createClient()
    const uniques = Array.from(new Set(ids)).filter(id => !identites[id])
    if (uniques.length === 0) return
    const results = await Promise.all(
      uniques.map(id => supabase.rpc('get_user_public_identity', { p_user_id: id }))
    )
    setIdentites(prev => {
      const next = { ...prev }
      results.forEach((res, i) => {
        const row = res.data && res.data.length > 0 ? res.data[0] : null
        if (row) next[uniques[i]] = { pseudo: row.pseudo, avatar_url: row.avatar_url }
      })
      return next
    })
  }, [identites])

  const chargerTout = useCallback(async (uid: string) => {
    const supabase = createClient()

    const { data: friendData } = await supabase
      .from('friend_requests')
      .select('id, requester_id, recipient_id, status, created_at')
      .or(`requester_id.eq.${uid},recipient_id.eq.${uid}`)
      .order('created_at', { ascending: false })

    const rows = (friendData || []) as FriendRequestRow[]
    const amisRows = rows.filter(r => r.status === 'accepted')
    const recuesRows = rows.filter(r => r.status === 'pending' && r.recipient_id === uid)
    const envoyeesRows = rows.filter(r => r.status === 'pending' && r.requester_id === uid)
    setAmis(amisRows)
    setRecues(recuesRows)
    setEnvoyees(envoyeesRows)

    const { data: blockData } = await supabase
      .from('blocks')
      .select('id, blocked_id, created_at')
      .eq('blocker_id', uid)
      .order('created_at', { ascending: false })
    setBloques((blockData || []) as BlockRow[])

    const idsToLoad = [
      ...amisRows.map(r => otherIdOf(r, uid)),
      ...recuesRows.map(r => otherIdOf(r, uid)),
      ...envoyeesRows.map(r => otherIdOf(r, uid)),
      ...((blockData || []) as BlockRow[]).map(b => b.blocked_id),
    ]
    await chargerIdentites(idsToLoad)

    setLoading(false)
  }, [chargerIdentites])

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/connexion'); return }
      setMeId(user.id)
      await chargerTout(user.id)
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const repondre = async (row: FriendRequestRow, status: 'accepted' | 'declined') => {
    if (!meId) return
    setActionLoadingId(row.id)
    const supabase = createClient()
    await supabase.from('friend_requests').update({ status, responded_at: new Date().toISOString() }).eq('id', row.id)
    await chargerTout(meId)
    setActionLoadingId(null)
  }

  const supprimerDemande = async (row: FriendRequestRow) => {
    if (!meId) return
    setActionLoadingId(row.id)
    const supabase = createClient()
    await supabase.from('friend_requests').delete().eq('id', row.id)
    await chargerTout(meId)
    setActionLoadingId(null)
    setConfirmId(null)
  }

  const debloquer = async (blockedId: string) => {
    if (!meId) return
    setActionLoadingId(blockedId)
    const supabase = createClient()
    await supabase.from('blocks').delete().eq('blocker_id', meId).eq('blocked_id', blockedId)
    await chargerTout(meId)
    setActionLoadingId(null)
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
      <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BackButton />
            <div>
              <h1 className="font-fredoka text-3xl text-[#eeeaf8] mb-1">Amis</h1>
              <p className="text-[#9b96b8] text-sm">Gère tes amis, tes demandes et les joueurs bloqués</p>
            </div>
          </div>
          <Link href="/classement" className="font-fredoka text-sm text-[#a78bfa] hover:opacity-80 transition flex-shrink-0">
            Chercher un joueur →
          </Link>
        </div>

        {/* Onglets */}
        <div className="flex bg-[#1a1828] rounded-xl p-1 gap-1 overflow-x-auto">
          {([
            { key: 'amis', label: 'Amis', count: amis.length },
            { key: 'recues', label: 'Demandes reçues', count: recues.length },
            { key: 'envoyees', label: 'Envoyées', count: envoyees.length },
            { key: 'bloques', label: 'Bloqués', count: bloques.length },
          ] as { key: Onglet, label: string, count: number }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setOnglet(t.key)}
              className="flex-1 text-center font-fredoka text-sm py-3 rounded-lg relative flex-shrink-0"
              style={{ background: onglet === t.key ? '#0f0e17' : 'transparent', color: onglet === t.key ? '#eeeaf8' : '#9b96b8', minWidth: '110px' }}
            >
              {t.label}
              {t.key === 'recues' && t.count > 0 && (
                <span
                  className="absolute font-fredoka text-xs rounded-full flex items-center justify-center"
                  style={{ background: '#ff6b6b', color: '#fff', width: '18px', height: '18px', top: '4px', right: '8px', fontSize: '10px' }}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Amis */}
        {onglet === 'amis' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {amis.length === 0 ? (
              <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-10 text-center">
                <p className="font-fredoka text-[#9b96b8] text-lg mb-2">Aucun ami pour l'instant</p>
                <p className="text-[#6b6880] text-sm">Cherche un joueur depuis le classement pour lui envoyer une demande.</p>
              </div>
            ) : amis.map(row => {
              const otherId = otherIdOf(row, meId!)
              return (
                <CarteJoueur key={row.id} userId={otherId} identites={identites}>
                  {confirmId === row.id ? (
                    <>
                      <span className="text-[#9b96b8] text-xs">Retirer ?</span>
                      <button onClick={() => supprimerDemande(row)} disabled={actionLoadingId === row.id} className="font-fredoka text-xs rounded-full px-3 py-1.5 disabled:opacity-50" style={{ background: '#ff6b6b', color: '#0f0e17' }}>
                        Confirmer
                      </button>
                      <button onClick={() => setConfirmId(null)} className="font-fredoka text-xs rounded-full px-3 py-1.5" style={{ background: 'transparent', color: '#9b96b8', border: '1px solid #3a3650' }}>
                        Annuler
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setConfirmId(row.id)} className="font-fredoka text-xs text-[#6b6880] hover:text-[#ff6b6b] transition">
                      Retirer
                    </button>
                  )}
                </CarteJoueur>
              )
            })}
          </div>
        )}

        {/* Demandes reçues */}
        {onglet === 'recues' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {recues.length === 0 ? (
              <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-10 text-center">
                <p className="font-fredoka text-[#9b96b8] text-lg">Aucune demande en attente</p>
              </div>
            ) : recues.map(row => (
              <CarteJoueur key={row.id} userId={row.requester_id} sousTitre="Souhaite devenir ton ami" identites={identites}>
                <button
                  onClick={() => repondre(row, 'accepted')}
                  disabled={actionLoadingId === row.id}
                  className="font-fredoka text-xs rounded-full px-3 py-1.5 disabled:opacity-50"
                  style={{ background: '#6bcb77', color: '#0f0e17' }}
                >
                  Accepter
                </button>
                <button
                  onClick={() => repondre(row, 'declined')}
                  disabled={actionLoadingId === row.id}
                  className="font-fredoka text-xs rounded-full px-3 py-1.5 disabled:opacity-50"
                  style={{ background: 'transparent', color: '#9b96b8', border: '1px solid #3a3650' }}
                >
                  Refuser
                </button>
              </CarteJoueur>
            ))}
          </div>
        )}

        {/* Demandes envoyées */}
        {onglet === 'envoyees' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {envoyees.length === 0 ? (
              <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-10 text-center">
                <p className="font-fredoka text-[#9b96b8] text-lg">Aucune demande envoyée</p>
              </div>
            ) : envoyees.map(row => (
              <CarteJoueur key={row.id} userId={row.recipient_id} sousTitre="En attente de réponse" identites={identites}>
                <button
                  onClick={() => supprimerDemande(row)}
                  disabled={actionLoadingId === row.id}
                  className="font-fredoka text-xs rounded-full px-3 py-1.5 disabled:opacity-50"
                  style={{ background: 'transparent', color: '#9b96b8', border: '1px solid #3a3650' }}
                >
                  Annuler
                </button>
              </CarteJoueur>
            ))}
          </div>
        )}

        {/* Bloqués */}
        {onglet === 'bloques' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {bloques.length === 0 ? (
              <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-10 text-center">
                <p className="font-fredoka text-[#9b96b8] text-lg">Aucun joueur bloqué</p>
              </div>
            ) : bloques.map(b => (
              <CarteJoueur key={b.id} userId={b.blocked_id} identites={identites}>
                <button
                  onClick={() => debloquer(b.blocked_id)}
                  disabled={actionLoadingId === b.blocked_id}
                  className="font-fredoka text-xs rounded-full px-3 py-1.5 disabled:opacity-50"
                  style={{ background: 'transparent', color: '#9b96b8', border: '1px solid #3a3650' }}
                >
                  Débloquer
                </button>
              </CarteJoueur>
            ))}
          </div>
        )}

      </div>
    </main>
  )
}

function CarteJoueur({ userId, identites, sousTitre, children }: { userId: string, identites: Record<string, Identite>, sousTitre?: string, children?: React.ReactNode }) {
  const id = identites[userId]
  return (
    <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl flex items-center gap-4 flex-wrap" style={{ padding: '14px 18px' }}>
      <Link href={`/joueur/${userId}`} className="flex items-center gap-3 flex-1 min-w-0">
        <Avatar url={id?.avatar_url} size={40} border="subtle" />
        <div className="min-w-0">
          <p className="font-fredoka text-[#eeeaf8] text-sm truncate">{id?.pseudo || 'Joueur'}</p>
          {sousTitre && <p className="text-[#6b6880] text-xs">{sousTitre}</p>}
        </div>
      </Link>
      <div className="flex items-center gap-2 flex-shrink-0">{children}</div>
    </div>
  )
}

'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '../../../../lib/supabase'
import { getMultiplayerIdentity, subscribeRoomRealtime, fetchRoomPlayers } from '../../../../lib/multiplayer'
import { onSitePresenceChange } from '../../../../lib/presence'
import BackButton from '@/components/BackButton'
import Avatar from '@/components/Avatar'
import ChatPanel from '@/components/ChatPanel'
import RoleBadge from '@/components/RoleBadge'
import Skeleton, { SkeletonList } from '@/components/Skeleton'
import Spinner from '@/components/Spinner'

type Friend = {
  id: string
  pseudo: string
  avatar_url: string | null
  role: string | null
  is_premium: boolean | null
}

type Game = {
  id: string
  code: string
  status: 'attente' | 'en_cours' | 'correction' | 'terminee' | 'annulee'
  host_id: string
  max_players: number
  config: {
    category_ids?: string[]
    difficulty?: string[]
    questions_count?: number
    timer_duration?: number
  }
}

type Player = {
  id: string
  user_id: string
  pseudo: string
  is_guest: boolean
  avatar_url: string | null
  status: 'actif' | 'abandonne'
  joined_at: string
  muted: boolean
  role?: string | null
  is_premium?: boolean | null
}

const difficulteLabels: Record<string, string> = {
  facile: 'Facile', moyen: 'Moyen', difficile: 'Difficile', hardcore: 'Hardcore',
}

// Forme minimale du payload postgres_changes utile côté client (on ne lit
// jamais que .new/.old.user_id et .status pour détecter une expulsion).
type PlayersChangePayload = {
  new?: { user_id?: string; status?: string } | null
  old?: { status?: string } | null
}

// Web Share API : pas toujours dans le lib DOM ciblé par ce projet, d'où ce
// typage minimal plutôt qu'un `as any` sur navigator.
type NavigatorWithShare = Navigator & {
  share?: (data?: { title?: string; text?: string; url?: string }) => Promise<void>
}

export default function SalleAttente() {
  const params = useParams()
  const router = useRouter()
  const code = (params.code as string || '').toUpperCase()

  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [closed, setClosed] = useState<string | null>(null)
  const [game, setGame] = useState<Game | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({})
  const [launching, setLaunching] = useState(false)
  const [copied, setCopied] = useState(false)
  const [shared, setShared] = useState(false)

  const [hasPremiumAccess, setHasPremiumAccess] = useState(false)
  const [friends, setFriends] = useState<Friend[]>([])
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set())
  const [inviteStatus, setInviteStatus] = useState<Record<string, 'sending' | 'sent' | 'error'>>({})
  const [inviteErrorMsg, setInviteErrorMsg] = useState<Record<string, string>>({})

  const gameIdRef = useRef<string | null>(null)
  const supabaseRef = useRef(createClient())

  const isHost = !!game && !!myUserId && game.host_id === myUserId

  const reloadPlayers = useCallback(async (gameId: string) => {
    const rows = await fetchRoomPlayers(supabaseRef.current, gameId)
    setPlayers(rows as Player[])
  }, [])

  useEffect(() => {
    let cancelled = false
    const supabase = supabaseRef.current

    const init = async () => {
      if (!code) return
      try {
        const identity = await getMultiplayerIdentity()
        if (cancelled) return
        setMyUserId(identity.user.id)

        const { data: gameData, error: gameError } = await supabase
          .from('multiplayer_games')
          .select('id, code, status, host_id, max_players, config')
          .eq('code', code)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (gameError || !gameData) {
          setClosed("Cette salle n'existe pas ou n'est plus disponible.")
          setLoading(false)
          return
        }

        if (gameData.status === 'annulee') {
          setClosed('Cette salle a été fermée.')
          setLoading(false)
          return
        }

        const { data: existingPlayer } = await supabase
          .from('multiplayer_players')
          .select('id')
          .eq('game_id', gameData.id)
          .eq('user_id', identity.user.id)
          .maybeSingle()

        if (!existingPlayer) {
          if (gameData.status !== 'attente') {
            setClosed("La partie a déjà commencé, tu ne peux plus rejoindre cette salle.")
            setLoading(false)
            return
          }
          const { data: joinedPlayer, error: joinError } = await supabase
            .from('multiplayer_players')
            .insert({
              game_id: gameData.id,
              user_id: identity.user.id,
              is_guest: identity.isGuest,
              pseudo: identity.pseudo,
              avatar_url: identity.avatarUrl,
            })
            .select('id')
            .single()
          if (joinError) {
            setClosed('Cette salle est complète.')
            setLoading(false)
            return
          }
          if (joinedPlayer) setMyPlayerId(joinedPlayer.id)
        } else {
          setMyPlayerId(existingPlayer.id)
          if (gameData.status !== 'attente') {
            // Déjà membre, la partie est déjà lancée : on rejoint la phase en cours.
            if (gameData.status === 'en_cours') { router.replace(`/multijoueur/quiz/${code}`); return }
            if (gameData.status === 'correction') { router.replace(`/multijoueur/correction/${code}`); return }
            if (gameData.status === 'terminee') { router.replace(`/multijoueur/resultats/${code}`); return }
          }
        }

        if (cancelled) return
        setGame(gameData as Game)
        gameIdRef.current = gameData.id
        await reloadPlayers(gameData.id)

        if (gameData.config?.category_ids?.length) {
          const { data: cats } = await supabase
            .from('categories')
            .select('id, name')
            .in('id', gameData.config.category_ids)
          if (cats) {
            const map: Record<string, string> = {}
            cats.forEach((c: { id: string; name: string }) => { map[c.id] = c.name })
            setCategoryNames(map)
          }
        }

        setLoading(false)
      } catch {
        setClosed("Impossible de rejoindre cette salle.")
        setLoading(false)
      }
    }

    init()
    return () => { cancelled = true }
  }, [code, reloadPlayers, router])

  // Realtime : état de la salle + liste des joueurs + présence (déconnexions)
  useEffect(() => {
    if (!game?.id || !myUserId) return
    const supabase = supabaseRef.current
    const gameId = game.id

    const cleanup = subscribeRoomRealtime(supabase, {
      gameId,
      myUserId,
      onGameChange: (newGame: Game) => {
        setGame(prev => prev ? { ...prev, ...newGame } : newGame)
        if (newGame.status === 'en_cours') router.replace(`/multijoueur/quiz/${code}`)
        if (newGame.status === 'annulee') setClosed('Cette salle a été fermée.')
      },
      onPlayersChange: (payload: PlayersChangePayload) => {
        reloadPlayers(gameId)
        // Mon propre statut vient de passer à "abandonne" alors que j'étais
        // encore actif : je viens d'être expulsé par l'hôte (un abandon
        // volontaire ne me laisse pas en train d'écouter ce canal, puisque
        // handleQuitter navigue immédiatement ailleurs).
        if (payload?.new?.user_id === myUserId && payload?.new?.status === 'abandonne' && payload?.old?.status === 'actif') {
          setClosed("Tu as été expulsé de cette salle par l'hôte.")
        }
      },
      onAnswersChange: () => {},
    })

    return cleanup
  }, [game?.id, myUserId, code, router, reloadPlayers])

  // Présence site-wide (pour savoir quels amis sont en ligne, cf. panneau
  // d'invitation) — abonnement bon marché, autant l'avoir tout le temps
  // plutôt que de le conditionner à isHost avec un effet en plus.
  useEffect(() => {
    const unsub = onSitePresenceChange((ids: Set<string>) => setOnlineIds(ids))
    return unsub
  }, [])

  // Amis à inviter — chargé une fois qu'on sait qu'on est l'hôte d'une salle
  // encore ouverte, et seulement effectivement utilisé si le compte est
  // premium/admin.
  useEffect(() => {
    if (!isHost || !myUserId || game?.status !== 'attente') return
    let cancelled = false
    const supabase = supabaseRef.current

    const loadInvitePanel = async () => {
      const { data: premiumAccess } = await supabase.rpc('has_premium_access')
      if (cancelled) return
      setHasPremiumAccess(!!premiumAccess)
      if (!premiumAccess) return

      const { data: friendRows } = await supabase
        .from('friend_requests')
        .select('requester_id, recipient_id')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${myUserId},recipient_id.eq.${myUserId}`)

      if (cancelled || !friendRows) return
      const friendIds = friendRows.map((r: any) => r.requester_id === myUserId ? r.recipient_id : r.requester_id)
      if (friendIds.length === 0) { setFriends([]); return }

      const results = await Promise.all(
        friendIds.map((id: string) => supabase.rpc('get_user_public_identity', { p_user_id: id }))
      )
      if (cancelled) return
      const list: Friend[] = []
      results.forEach((res: any, i: number) => {
        const row = res.data && res.data.length > 0 ? res.data[0] : null
        if (row) list.push({ id: friendIds[i], pseudo: row.pseudo, avatar_url: row.avatar_url, role: row.role ?? null, is_premium: row.is_premium ?? null })
      })
      setFriends(list)
    }

    loadInvitePanel()
    return () => { cancelled = true }
  }, [isHost, myUserId, game?.status])

  const handleInvite = async (friendId: string) => {
    if (!game) return
    setInviteStatus(prev => ({ ...prev, [friendId]: 'sending' }))
    setInviteErrorMsg(prev => {
      const next = { ...prev }
      delete next[friendId]
      return next
    })
    const supabase = supabaseRef.current
    const { error: inviteError } = await supabase.rpc('send_room_invite', { p_recipient_id: friendId, p_game_id: game.id })
    if (inviteError) {
      setInviteStatus(prev => ({ ...prev, [friendId]: 'error' }))
      setInviteErrorMsg(prev => ({ ...prev, [friendId]: inviteError.message || "Impossible d'envoyer l'invitation." }))
      return
    }
    setInviteStatus(prev => ({ ...prev, [friendId]: 'sent' }))
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  // Lien d'invitation direct : ouvrable par n'importe qui, même sans compte
  // (la page de salle crée automatiquement une session invité au besoin).
  const handleShare = async () => {
    const url = `${window.location.origin}/multijoueur/salle/${code}`
    const nav = typeof navigator !== 'undefined' ? (navigator as NavigatorWithShare) : null
    if (nav?.share) {
      try {
        await nav.share({
          title: 'Coolos Quiz',
          text: `Rejoins ma salle multijoueur sur Coolos Quiz (code ${code}) !`,
          url,
        })
        return
      } catch {
        // Partage annulé par l'utilisateur ou non supporté au final : on
        // retombe sur la copie du lien plutôt que de laisser un état bloqué.
      }
    }
    navigator.clipboard.writeText(url)
    setShared(true)
    setTimeout(() => setShared(false), 1500)
  }

  const handleQuitter = async () => {
    const supabase = supabaseRef.current
    if (gameIdRef.current && myUserId) {
      await supabase.rpc('handle_player_left_presence', { p_game_id: gameIdRef.current, p_left_user_id: myUserId })
    }
    router.push('/multijoueur')
  }

  const handleLancer = async () => {
    if (!game) return
    setError('')
    setLaunching(true)
    const supabase = supabaseRef.current

    const categoryIds = game.config?.category_ids || []
    const difficulty = game.config?.difficulty || ['facile', 'moyen', 'difficile', 'hardcore']
    const nb = game.config?.questions_count || 20

    let query = supabase
      .from('questions')
      .select('id')
      .eq('active', true)

    if (categoryIds.length > 0) query = query.in('category_id', categoryIds)
    if (difficulty.length > 0) query = query.in('difficulty', difficulty)

    const { data: questionsData } = await query

    if (!questionsData || questionsData.length === 0) {
      setError('Aucune question ne correspond à cette configuration.')
      setLaunching(false)
      return
    }

    const shuffled = [...questionsData].sort(() => Math.random() - 0.5)
    const questionIds = shuffled.slice(0, nb).map((q: { id: string }) => q.id)

    const { error: launchError } = await supabase.rpc('launch_multiplayer_game', {
      p_game_id: game.id,
      p_question_ids: questionIds,
    })

    if (launchError) {
      setError("Impossible de lancer la partie. Réessaie.")
      setLaunching(false)
      return
    }
    // La redirection se fait normalement via l'abonnement Realtime (UPDATE de
    // multiplayer_games). Filet de sécurité : si cet évènement n'arrive pas
    // (raté, latence...), on force quand même la redirection après un court
    // délai plutôt que de laisser l'hôte bloqué sur "Lancement...".
    setTimeout(() => {
      router.replace(`/multijoueur/quiz/${code}`)
    }, 4000)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0f0e17]" style={{ padding: '32px 24px 80px' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <div className="flex items-center gap-3">
            <Spinner size={20} />
            <p className="font-fredoka text-[#9b96b8] text-lg">Connexion à la salle...</p>
          </div>
          <Skeleton height={160} radius="16px" />
          <Skeleton height={48} radius="9999px" width="60%" />
          <SkeletonList count={3} />
        </div>
      </main>
    )
  }

  if (closed) {
    return (
      <main className="min-h-screen bg-[#0f0e17] flex flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="font-fredoka text-[#ff6b6b] text-xl">{closed}</p>
        <Link href="/multijoueur" className="bg-[#ffd93d] text-[#0f0e17] rounded-2xl py-3 px-8 font-fredoka text-lg hover:opacity-90 transition">
          Retour au multijoueur
        </Link>
      </main>
    )
  }

  if (!game) return null

  const activePlayers = players.filter(p => p.status === 'actif')
  const activePlayerIds = new Set(activePlayers.map(p => p.user_id))
  const onlineFriendsToInvite = friends.filter(f => onlineIds.has(f.id) && !activePlayerIds.has(f.id))
  const nb = game.config?.questions_count || 20
  const timerDuration = game.config?.timer_duration || 20
  const themesLabel = (game.config?.category_ids?.length || 0) === 0
    ? 'Tous les thèmes'
    : (game.config!.category_ids as string[]).map(id => categoryNames[id] || '…').join(', ')
  const diffLabel = (game.config?.difficulty?.length || 4) >= 4
    ? 'Toutes difficultés'
    : (game.config!.difficulty as string[]).map(d => difficulteLabels[d] || d).join(' + ')

  return (
    <main className="min-h-screen bg-[#0f0e17]" style={{ padding: '32px 24px 80px' }}>
      <div className="coolos-card-transition" style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <BackButton />
            <Link href="/" className="font-fredoka text-2xl">
              <span className="text-[#ff6b6b]">C</span><span className="text-[#ff9f43]">o</span><span className="text-[#ffd93d]">o</span><span className="text-[#6bcb77]">l</span><span className="text-[#4ecdc4]">o</span><span className="text-[#a78bfa]">s</span>
              <span className="text-[#c9c4e0]"> Quiz</span>
            </Link>
          </div>
          <button onClick={handleQuitter} className="text-[#827f97] text-sm font-semibold hover:text-[#ff6b6b] transition">
            Quitter la salle
          </button>
        </div>

        {/* Code de la salle */}
        <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-8 flex flex-col items-center gap-4 text-center">
          <p className="font-fredoka text-[#9b96b8] text-sm uppercase tracking-widest">Code de la salle</p>
          <p className="font-fredoka text-5xl text-[#ffd93d] tracking-widest">{code}</p>
          <div className="flex gap-3 flex-wrap justify-center">
            <button
              onClick={handleCopyCode}
              className="border border-[#3a3650] text-[#c9c4e0] rounded-full px-5 py-2 text-sm font-fredoka hover:bg-[#1e1c2e] transition"
            >
              {copied ? 'Copié !' : 'Copier le code'}
            </button>
            <button
              onClick={handleShare}
              className="border border-[#a78bfa] text-[#a78bfa] rounded-full px-5 py-2 text-sm font-fredoka hover:bg-[#2a1f3d] transition"
            >
              {shared ? 'Lien copié !' : 'Partager →'}
            </button>
          </div>
        </div>

        {/* Config */}
        <div className="bg-[#1e1c2e] border border-[#2a2830] rounded-2xl p-5 flex flex-wrap gap-3">
          <span className="bg-[#2a2830] rounded-full px-4 py-2 font-fredoka text-sm text-[#ffd93d]">{themesLabel}</span>
          <span className="bg-[#2a2830] rounded-full px-4 py-2 font-fredoka text-sm text-[#ffd93d]">{diffLabel}</span>
          <span className="bg-[#2a2830] rounded-full px-4 py-2 font-fredoka text-sm text-[#4ecdc4]">{nb} questions</span>
          <span className="bg-[#2a2830] rounded-full px-4 py-2 font-fredoka text-sm text-[#ff9f43]">{timerDuration}s / question</span>
        </div>

        {/* Joueurs */}
        <div>
          <p className="font-fredoka text-[#c9c4e0] text-xl mb-4">
            Joueurs <span className="text-[#827f97] text-base">({activePlayers.length}/{game.max_players})</span>
          </p>
          <div className="flex flex-col gap-3">
            {activePlayers.map(p => (
              <div key={p.id} className="coolos-card-transition bg-[#1a1828] border border-[#2a2830] rounded-xl px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar url={p.avatar_url} size={36} border="accent" />
                  <span className="font-fredoka text-[#eeeaf8] text-base">{p.pseudo}</span>
                  {p.user_id === myUserId && (
                    <span className="text-[#827f97] text-xs">(toi)</span>
                  )}
                  <RoleBadge role={p.role} isPremium={p.is_premium} />
                </div>
                <div className="flex items-center gap-2">
                  {p.is_guest && (
                    <span className="bg-[#2a2830] text-[#9b96b8] rounded-full px-3 py-1 text-xs font-fredoka">Invité</span>
                  )}
                  {p.user_id === game.host_id && (
                    <span className="bg-[#1f1e10] border border-[#ffd93d] text-[#ffd93d] rounded-full px-3 py-1 text-xs font-fredoka">Hôte</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Invitation d'amis — hôte uniquement, tant que la salle est ouverte */}
        {isHost && (
          <div>
            <p className="font-fredoka text-[#c9c4e0] text-xl mb-4">★ Inviter des amis</p>
            {!hasPremiumAccess ? (
              <p className="text-[#ffd93d] text-sm">★ Passe premium pour voir tes amis en ligne et les inviter directement dans cette salle.</p>
            ) : onlineFriendsToInvite.length === 0 ? (
              <p className="text-[#827f97] text-sm">Aucun ami en ligne pour le moment.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {onlineFriendsToInvite.map(f => {
                  const status = inviteStatus[f.id]
                  return (
                    <div key={f.id} className="bg-[#1a1828] border border-[#2a2830] rounded-xl px-5 py-4 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <Avatar url={f.avatar_url} size={36} border="subtle" />
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-fredoka text-[#eeeaf8] text-base">{f.pseudo}</span>
                          <RoleBadge role={f.role} isPremium={f.is_premium} />
                          <span className="inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full" style={{ background: '#6bcb77' }}></span>
                            <span className="text-[#6bcb77] text-xs font-fredoka">En ligne</span>
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <button
                          onClick={() => handleInvite(f.id)}
                          disabled={status === 'sending' || status === 'sent'}
                          className="font-fredoka text-xs rounded-full px-4 py-2 disabled:opacity-50"
                          style={{
                            background: status === 'sent' ? '#1a2e1f' : '#2a1f3d',
                            color: status === 'sent' ? '#6bcb77' : '#a78bfa',
                            border: `1px solid ${status === 'sent' ? '#6bcb77' : '#a78bfa'}`,
                          }}
                        >
                          {status === 'sending' ? 'Envoi...' : status === 'sent' ? '✓ Invité' : 'Inviter'}
                        </button>
                        {status === 'error' && inviteErrorMsg[f.id] && (
                          <span className="text-[#ff6b6b] text-xs" style={{ maxWidth: '180px', textAlign: 'right' }}>{inviteErrorMsg[f.id]}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="bg-[#2e1a1a] border border-[#ff6b6b] rounded-xl px-4 py-3">
            <p className="text-[#ff6b6b] text-sm">{error}</p>
          </div>
        )}

        {isHost ? (
          <button
            onClick={handleLancer}
            disabled={launching}
            className="w-full bg-[#ffd93d] text-[#0f0e17] rounded-2xl py-5 font-fredoka text-xl hover:opacity-90 transition disabled:opacity-50"
          >
            {launching ? 'Lancement...' : 'Lancer la partie →'}
          </button>
        ) : (
          <div className="bg-[#1e1c2e] border border-[#2a2830] rounded-2xl py-5 flex items-center justify-center gap-3">
            <Spinner size={18} />
            <p className="font-fredoka text-[#9b96b8] text-base">En attente que l&apos;hôte lance la partie...</p>
          </div>
        )}

      </div>

      {myPlayerId && myUserId && (
        <ChatPanel
          gameId={game.id}
          gameStatus={game.status}
          myPlayerId={myPlayerId}
          myUserId={myUserId}
          isHost={isHost}
          players={players}
        />
      )}
    </main>
  )
}

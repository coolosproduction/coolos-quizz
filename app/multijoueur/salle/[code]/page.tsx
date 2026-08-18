'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '../../../../lib/supabase'
import { getMultiplayerIdentity, subscribeRoomRealtime } from '../../../../lib/multiplayer'

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
  status: 'actif' | 'abandonne'
  joined_at: string
}

const difficulteLabels: Record<string, string> = {
  facile: 'Facile', moyen: 'Moyen', difficile: 'Difficile', hardcore: 'Hardcore',
}

export default function SalleAttente() {
  const params = useParams()
  const router = useRouter()
  const code = (params.code as string || '').toUpperCase()

  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [closed, setClosed] = useState<string | null>(null)
  const [game, setGame] = useState<Game | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({})
  const [launching, setLaunching] = useState(false)
  const [copied, setCopied] = useState(false)

  const gameIdRef = useRef<string | null>(null)
  const supabaseRef = useRef(createClient())

  const isHost = !!game && !!myUserId && game.host_id === myUserId

  const reloadPlayers = useCallback(async (gameId: string) => {
    const supabase = supabaseRef.current
    const { data } = await supabase
      .from('multiplayer_players')
      .select('id, user_id, pseudo, is_guest, status, joined_at')
      .eq('game_id', gameId)
      .order('joined_at', { ascending: true })
    if (data) setPlayers(data as Player[])
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
          const { error: joinError } = await supabase
            .from('multiplayer_players')
            .insert({
              game_id: gameData.id,
              user_id: identity.user.id,
              is_guest: identity.isGuest,
              pseudo: identity.pseudo,
            })
          if (joinError) {
            setClosed('Cette salle est complète.')
            setLoading(false)
            return
          }
        } else if (gameData.status !== 'attente') {
          // Déjà membre, la partie est déjà lancée : on rejoint la phase en cours.
          if (gameData.status === 'en_cours') { router.replace(`/multijoueur/quiz/${code}`); return }
          if (gameData.status === 'correction') { router.replace(`/multijoueur/correction/${code}`); return }
          if (gameData.status === 'terminee') { router.replace(`/multijoueur/resultats/${code}`); return }
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
            cats.forEach((c: any) => { map[c.id] = c.name })
            setCategoryNames(map)
          }
        }

        setLoading(false)
      } catch (e) {
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
      onPlayersChange: () => reloadPlayers(gameId),
      onAnswersChange: () => {},
    })

    return cleanup
  }, [game?.id, myUserId, code, router, reloadPlayers])

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
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
    const questionIds = shuffled.slice(0, nb).map((q: any) => q.id)

    const { error: launchError } = await supabase.rpc('launch_multiplayer_game', {
      p_game_id: game.id,
      p_question_ids: questionIds,
    })

    if (launchError) {
      setError("Impossible de lancer la partie. Réessaie.")
      setLaunching(false)
      return
    }
    // La redirection se fait via l'abonnement Realtime (UPDATE de multiplayer_games)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0f0e17] flex items-center justify-center">
        <p className="font-fredoka text-[#9b96b8] text-xl">Chargement...</p>
      </main>
    )
  }

  if (closed) {
    return (
      <main className="min-h-screen bg-[#0f0e17] flex flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="font-fredoka text-[#ff6b6b] text-xl">{closed}</p>
        <Link href="/multijoueur" className="bg-[#ffd93d] text-[#0f0e17] rounded-2xl py-3 px-8 font-fredoka text-lg">
          Retour au multijoueur
        </Link>
      </main>
    )
  }

  if (!game) return null

  const activePlayers = players.filter(p => p.status === 'actif')
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
      <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>

        <div className="flex justify-between items-center">
          <Link href="/" className="font-fredoka text-2xl">
            <span className="text-[#ff6b6b]">C</span><span className="text-[#ff9f43]">o</span><span className="text-[#ffd93d]">o</span><span className="text-[#6bcb77]">l</span><span className="text-[#4ecdc4]">o</span><span className="text-[#a78bfa]">s</span>
            <span className="text-[#c9c4e0]"> Quiz</span>
          </Link>
          <button onClick={handleQuitter} className="text-[#6b6880] text-sm font-semibold hover:text-[#ff6b6b] transition">
            Quitter la salle
          </button>
        </div>

        {/* Code de la salle */}
        <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-8 flex flex-col items-center gap-4 text-center">
          <p className="font-fredoka text-[#9b96b8] text-sm uppercase tracking-widest">Code de la salle</p>
          <p className="font-fredoka text-5xl text-[#ffd93d] tracking-widest">{code}</p>
          <button
            onClick={handleCopyCode}
            className="border border-[#3a3650] text-[#c9c4e0] rounded-full px-5 py-2 text-sm font-fredoka hover:bg-[#1e1c2e] transition"
          >
            {copied ? 'Copié !' : 'Copier le code'}
          </button>
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
            Joueurs <span className="text-[#6b6880] text-base">({activePlayers.length}/{game.max_players})</span>
          </p>
          <div className="flex flex-col gap-3">
            {activePlayers.map(p => (
              <div key={p.id} className="bg-[#1a1828] border border-[#2a2830] rounded-xl px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#2a1f3d] border-2 border-[#a78bfa] flex items-center justify-center">
                    <div className="w-4 h-4 rounded-full bg-[#a78bfa]"></div>
                  </div>
                  <span className="font-fredoka text-[#eeeaf8] text-base">{p.pseudo}</span>
                  {p.user_id === myUserId && (
                    <span className="text-[#6b6880] text-xs">(toi)</span>
                  )}
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
          <div className="bg-[#1e1c2e] border border-[#2a2830] rounded-2xl py-5 text-center">
            <p className="font-fredoka text-[#9b96b8] text-base">En attente que l'hôte lance la partie...</p>
          </div>
        )}

      </div>
    </main>
  )
}

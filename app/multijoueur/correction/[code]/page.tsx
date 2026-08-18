'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '../../../../lib/supabase'
import { getMultiplayerIdentity, subscribeRoomRealtime, roomPathForStatus, fetchRoomPlayers } from '../../../../lib/multiplayer'
import BackButton from '@/components/BackButton'
import Avatar from '@/components/Avatar'
import ChatPanel from '@/components/ChatPanel'

type Game = {
  id: string
  code: string
  status: 'attente' | 'en_cours' | 'correction' | 'terminee' | 'annulee'
  host_id: string
}

type Eval = 'oui' | 'en_partie' | 'non' | null

type ChatPlayer = {
  id: string
  user_id: string
  pseudo: string
  is_guest: boolean
  avatar_url: string | null
  status: 'actif' | 'abandonne'
  muted: boolean
}

// Forme minimale du payload postgres_changes utile côté client (on ne lit
// jamais que .new/.old.user_id et .status pour détecter une expulsion).
type PlayersChangePayload = {
  new?: { user_id?: string; status?: string } | null
  old?: { status?: string } | null
}

type AnswerRow = {
  id: string
  player_id: string
  question_index: number
  user_answer: string | null
  timed_out: boolean
  self_eval: Eval
  player: { user_id: string, pseudo: string, is_guest: boolean, avatar_url: string | null, joined_at: string } | null
  question: { question_text: string, answer_text: string, category: { name: string } | null } | null
}

const evalConfig: Record<'oui' | 'en_partie' | 'non', { label: string, color: string, bg: string }> = {
  oui: { label: 'Oui', color: '#6bcb77', bg: '#1a2e1f' },
  en_partie: { label: 'En partie', color: '#ffd93d', bg: '#1f1e10' },
  non: { label: 'Non', color: '#ff6b6b', bg: '#2e1a1a' },
}

const ANSWERS_SELECT = `
  id, player_id, question_index, user_answer, timed_out, self_eval,
  player:multiplayer_players(user_id, pseudo, is_guest, avatar_url, joined_at),
  question:questions(question_text, answer_text, category:categories(name))
`

export default function CorrectionMultijoueur() {
  const params = useParams()
  const router = useRouter()
  const code = (params.code as string || '').toUpperCase()

  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [closedMsg, setClosedMsg] = useState<string | null>(null)
  const [game, setGame] = useState<Game | null>(null)
  const [answers, setAnswers] = useState<AnswerRow[]>([])
  const [evaluating, setEvaluating] = useState(false)
  const [players, setPlayers] = useState<ChatPlayer[]>([])

  const supabaseRef = useRef(createClient())
  const evaluatingRef = useRef(false)
  const finalizingRef = useRef(false)
  const answersRef = useRef<AnswerRow[]>([])

  const isHost = !!game && !!myUserId && game.host_id === myUserId

  useEffect(() => { answersRef.current = answers }, [answers])

  const sortAnswers = (rows: AnswerRow[]) => {
    return [...rows].sort((a, b) => {
      if (a.question_index !== b.question_index) return a.question_index - b.question_index
      const ja = a.player?.joined_at ? new Date(a.player.joined_at).getTime() : 0
      const jb = b.player?.joined_at ? new Date(b.player.joined_at).getTime() : 0
      return ja - jb
    })
  }

  const reloadAnswers = useCallback(async (gameId: string) => {
    const supabase = supabaseRef.current
    const { data } = await supabase
      .from('multiplayer_answers')
      .select(ANSWERS_SELECT)
      .eq('game_id', gameId)
    if (data) setAnswers(sortAnswers(data as unknown as AnswerRow[]))
  }, [])

  // Roster complet de la salle (au-delà des seuls joueurs ayant déjà une
  // réponse à corriger) — nécessaire pour le chat : résoudre pseudo/avatar
  // par player_id, et donner à l'hôte la liste des joueurs à modérer.
  const reloadPlayers = useCallback(async (gameId: string, myUid?: string | null) => {
    const rows = await fetchRoomPlayers(supabaseRef.current, gameId)
    setPlayers(rows as ChatPlayer[])
    const uid = myUid ?? myUserId
    const mine = rows.find((p: ChatPlayer) => p.user_id === uid)
    if (mine) setMyPlayerId(mine.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // amIHost est passé explicitement par l'appelant plutôt que lu depuis un
  // ref mis à jour au rendu : au moment précis d'un transfert de host (event
  // temps réel), le ref refléterait encore l'ancien host tant que React n'a
  // pas re-rendu le composant, ce qui ferait manquer la finalisation si la
  // file de correction est déjà vide pile à cet instant.
  const maybeFinalize = useCallback(async (gameId: string, rows: AnswerRow[], amIHost: boolean) => {
    const remaining = rows.filter(a => !a.self_eval)
    if (remaining.length === 0 && amIHost && !finalizingRef.current) {
      finalizingRef.current = true
      await supabaseRef.current.rpc('finalize_multiplayer_game', { p_game_id: gameId })
    }
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
          .select('id, code, status, host_id')
          .eq('code', code)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (gameError || !gameData) {
          setClosedMsg("Cette salle n'existe pas ou n'est plus disponible.")
          setLoading(false)
          return
        }

        if (gameData.status !== 'correction') {
          if (gameData.status === 'annulee') {
            setClosedMsg('Cette salle a été fermée.')
            setLoading(false)
            return
          }
          const path = roomPathForStatus(gameData.status, code)
          if (path) { router.replace(path); return }
        }

        const { data: answersData } = await supabase
          .from('multiplayer_answers')
          .select(ANSWERS_SELECT)
          .eq('game_id', gameData.id)

        const sorted = sortAnswers((answersData || []) as unknown as AnswerRow[])
        if (cancelled) return
        setAnswers(sorted)
        await reloadPlayers(gameData.id, identity.user.id)
        if (cancelled) return
        setGame(gameData as Game)
        setLoading(false)

        if (gameData.host_id === identity.user.id) {
          await maybeFinalize(gameData.id, sorted, true)
        }
      } catch {
        setClosedMsg('Impossible de charger la correction.')
        setLoading(false)
      }
    }

    init()
    return () => { cancelled = true }
  }, [code, router, maybeFinalize, reloadPlayers])

  useEffect(() => {
    if (!game?.id || !myUserId) return
    const supabase = supabaseRef.current
    const gameId = game.id

    const cleanup = subscribeRoomRealtime(supabase, {
      gameId,
      myUserId,
      onGameChange: (newGame: Game) => {
        setGame(prev => prev ? { ...prev, ...newGame } : newGame)
        if (newGame.status === 'terminee') router.replace(`/multijoueur/resultats/${code}`)
        if (newGame.status === 'annulee') setClosedMsg('Cette salle a été fermée.')
        // Le host peut changer suite à une déconnexion (transfert automatique
        // côté serveur). Si je deviens host pile au moment où la file de
        // correction est déjà vide (ex: l'ancien host a quitté juste après
        // avoir évalué la dernière réponse sans que la finalisation se
        // déclenche), c'est ici qu'on rattrape la finalisation.
        if (newGame.status === 'correction' && newGame.host_id === myUserId) {
          maybeFinalize(gameId, answersRef.current, true)
        }
      },
      onPlayersChange: (payload: PlayersChangePayload) => {
        reloadPlayers(gameId, myUserId)
        // Cf. page salle : je viens d'être expulsé par l'hôte en pleine correction.
        if (payload?.new?.user_id === myUserId && payload?.new?.status === 'abandonne' && payload?.old?.status === 'actif') {
          setClosedMsg("Tu as été expulsé de cette salle par l'hôte.")
        }
      },
      onAnswersChange: () => reloadAnswers(gameId),
    })

    return cleanup
  }, [game?.id, myUserId, code, router, reloadAnswers, reloadPlayers, maybeFinalize])

  const handleEvaluer = async (item: AnswerRow, verdict: 'oui' | 'en_partie' | 'non') => {
    if (evaluatingRef.current || !game) return
    evaluatingRef.current = true
    setEvaluating(true)
    const supabase = supabaseRef.current

    const { error } = await supabase
      .from('multiplayer_answers')
      .update({ self_eval: verdict })
      .eq('id', item.id)

    evaluatingRef.current = false
    setEvaluating(false)

    if (!error) {
      const updated = answers.map(a => a.id === item.id ? { ...a, self_eval: verdict } : a)
      setAnswers(updated)
      await maybeFinalize(game.id, updated, true)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0f0e17] flex items-center justify-center">
        <p className="font-fredoka text-[#9b96b8] text-xl">Chargement...</p>
      </main>
    )
  }

  if (closedMsg) {
    return (
      <main className="min-h-screen bg-[#0f0e17] flex flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="font-fredoka text-[#ff6b6b] text-xl">{closedMsg}</p>
        <Link href="/multijoueur" className="bg-[#ffd93d] text-[#0f0e17] rounded-2xl py-3 px-8 font-fredoka text-lg">
          Retour au multijoueur
        </Link>
      </main>
    )
  }

  if (!game) return null

  const total = answers.length
  const done = answers.filter(a => a.self_eval).length
  const current = answers.find(a => !a.self_eval) || null
  const evaluated = answers.filter(a => a.self_eval)

  return (
    <main className="min-h-screen bg-[#0f0e17]" style={{ padding: '32px 24px 80px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <BackButton />
            <span className="font-fredoka text-[#9b96b8] text-base">
              Correction <span className="text-[#eeeaf8]">{done}</span> / {total}
            </span>
          </div>
          <span className="bg-[#1e1c2e] border border-[#3a3650] rounded-full px-4 py-2 font-fredoka text-sm text-[#a78bfa]">
            {isHost ? 'Tu corriges cette partie' : "Correction en direct par l'hôte"}
          </span>
        </div>

        <div className="w-full bg-[#1e1c2e] rounded-full" style={{ height: '6px' }}>
          <div
            className="rounded-full"
            style={{ height: '6px', width: total > 0 ? `${(done / total) * 100}%` : '0%', background: '#a78bfa', transition: 'width 0.3s' }}
          ></div>
        </div>

        {current ? (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="inline-flex items-center gap-2 bg-[#1e1c2e] border border-[#2a2830] rounded-full px-4 py-2">
                <div className="w-2 h-2 rounded-full bg-[#ff6b6b]"></div>
                <span className="font-fredoka text-[#9b96b8] text-sm">{current.question?.category?.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Avatar url={current.player?.avatar_url ?? null} size={28} border="accent" />
                <span className="font-fredoka text-[#eeeaf8] text-base">{current.player?.pseudo}</span>
                {current.player?.is_guest && (
                  <span className="bg-[#2a2830] text-[#9b96b8] rounded-full px-3 py-1 text-xs font-fredoka">Invité</span>
                )}
              </div>
            </div>

            <h2 className="font-fredoka text-2xl text-[#eeeaf8] leading-tight">
              {current.question?.question_text}
            </h2>

            <div className="bg-[#1a2e1f] border border-[#1f3a28] rounded-2xl px-5 py-4">
              <p className="font-fredoka text-[#6bcb77] text-sm mb-2">La bonne réponse</p>
              <p className="text-[#eeeaf8] text-base font-semibold">{current.question?.answer_text}</p>
            </div>

            {current.timed_out && !current.user_answer ? (
              <div className="inline-flex items-center gap-2 bg-[#2e1a1a] border border-[#ff6b6b] rounded-full px-4 py-2" style={{ width: 'fit-content' }}>
                <div className="w-2 h-2 rounded-full bg-[#ff6b6b]"></div>
                <span className="font-fredoka text-[#ff6b6b] text-sm">Temps écoulé — pas de réponse</span>
              </div>
            ) : (
              <div className="bg-[#1e1c2e] border border-[#2a2830] rounded-2xl px-5 py-4">
                <div className="flex items-center gap-2 mb-2">
                  <p className="font-fredoka text-[#9b96b8] text-sm">Réponse de {current.player?.pseudo}</p>
                  {current.timed_out && (
                    <span className="font-fredoka text-xs rounded-full px-2 py-0.5" style={{ background: '#2e1a1a', color: '#ff6b6b' }}>
                      Temps écoulé
                    </span>
                  )}
                </div>
                <p className="text-[#c9c4e0] text-base font-semibold">{current.user_answer}</p>
              </div>
            )}

            {isHost ? (
              <div>
                <p className="font-fredoka text-[#c9c4e0] text-lg mb-4">{current.player?.pseudo} a eu bon ?</p>
                <div className="flex gap-4">
                  {(Object.entries(evalConfig) as [Exclude<Eval, null>, typeof evalConfig[keyof typeof evalConfig]][]).map(([key, val]) => (
                    <button
                      key={key}
                      onClick={() => handleEvaluer(current, key)}
                      disabled={evaluating}
                      className="flex-1 rounded-xl py-4 font-fredoka text-base disabled:opacity-50"
                      style={{ background: val.bg, border: `2px solid ${val.color}`, color: val.color }}
                    >
                      {val.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-[#1e1c2e] border border-[#2a2830] rounded-2xl py-5 text-center">
                <p className="font-fredoka text-[#9b96b8] text-base">L&apos;hôte évalue cette réponse...</p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-[#1e1c2e] border border-[#2a2830] rounded-2xl py-8 text-center">
            <p className="font-fredoka text-[#6bcb77] text-lg">Correction terminée !</p>
            <p className="text-[#9b96b8] text-sm mt-2">Calcul des résultats...</p>
          </div>
        )}

        {/* Historique de la correction */}
        {evaluated.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="font-fredoka text-[#6b6880] text-sm uppercase tracking-widest">Déjà corrigé</p>
            <div className="flex flex-col gap-2" style={{ maxHeight: '360px', overflowY: 'auto' }}>
              {[...evaluated].reverse().map(a => {
                const cfg = a.self_eval ? evalConfig[a.self_eval] : null
                return (
                  <div key={a.id} className="bg-[#1a1828] border border-[#2a2830] rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-[#6b6880] text-xs font-fredoka flex-shrink-0">Q{a.question_index + 1}</span>
                      <span className="text-[#9b96b8] text-sm font-fredoka flex-shrink-0">{a.player?.pseudo}</span>
                      <span className="text-[#4a4760] text-xs truncate">{a.question?.question_text}</span>
                    </div>
                    {cfg && (
                      <span className="rounded-full px-3 py-1 text-xs font-fredoka flex-shrink-0" style={{ background: cfg.bg, color: cfg.color }}>
                        {cfg.label}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
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

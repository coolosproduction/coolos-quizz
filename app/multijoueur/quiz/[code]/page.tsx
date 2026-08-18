'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '../../../../lib/supabase'
import { getMultiplayerIdentity, subscribeRoomRealtime, roomPathForStatus } from '../../../../lib/multiplayer'

type Game = {
  id: string
  code: string
  status: 'attente' | 'en_cours' | 'correction' | 'terminee' | 'annulee'
  host_id: string
  question_ids: string[]
  current_question_index: number
  current_question_answered_count: number
  question_started_at: string | null
  config: { timer_duration?: number }
}

type QuestionData = {
  id: string
  question_text: string
  category_name: string
  images: { url: string, position: number }[]
}

export default function QuizMultijoueur() {
  const params = useParams()
  const router = useRouter()
  const code = (params.code as string || '').toUpperCase()

  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [closedMsg, setClosedMsg] = useState<string | null>(null)
  const [game, setGame] = useState<Game | null>(null)
  const [questionsById, setQuestionsById] = useState<Record<string, QuestionData>>({})
  const [activePlayersCount, setActivePlayersCount] = useState(0)
  const [reponse, setReponse] = useState('')
  const [answered, setAnswered] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)

  const supabaseRef = useRef(createClient())
  const reponseRef = useRef('')
  const answeredRef = useRef(false)
  const submittingRef = useRef(false)
  const currentIndexRef = useRef<number | null>(null)
  const lastTimerCheckRef = useRef(0)

  const refreshActiveCount = useCallback(async (gameId: string) => {
    const supabase = supabaseRef.current
    const { count } = await supabase
      .from('multiplayer_players')
      .select('id', { count: 'exact', head: true })
      .eq('game_id', gameId)
      .eq('status', 'actif')
    setActivePlayersCount(count || 0)
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
          .select('id, code, status, host_id, question_ids, current_question_index, current_question_answered_count, question_started_at, config')
          .eq('code', code)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (gameError || !gameData) {
          setClosedMsg("Cette salle n'existe pas ou n'est plus disponible.")
          setLoading(false)
          return
        }

        if (gameData.status !== 'en_cours') {
          if (gameData.status === 'annulee') {
            setClosedMsg('Cette salle a été fermée.')
            setLoading(false)
            return
          }
          const path = roomPathForStatus(gameData.status, code)
          if (path) { router.replace(path); return }
        }

        const { data: playerRow } = await supabase
          .from('multiplayer_players')
          .select('id, status')
          .eq('game_id', gameData.id)
          .eq('user_id', identity.user.id)
          .maybeSingle()

        if (!playerRow) {
          setClosedMsg("Tu n'as pas rejoint cette salle avant le lancement de la partie.")
          setLoading(false)
          return
        }
        if (playerRow.status === 'abandonne') {
          setClosedMsg('Tu as été marqué comme ayant quitté cette partie.')
          setLoading(false)
          return
        }

        setMyPlayerId(playerRow.id)

        const questionIds: string[] = gameData.question_ids || []
        if (questionIds.length > 0) {
          const { data: qData } = await supabase
            .from('questions')
            .select('id, question_text, category:categories(name)')
            .in('id', questionIds)

          const { data: imagesData } = await supabase
            .from('question_images')
            .select('question_id, file_path, position')
            .in('question_id', questionIds)
            .order('position', { ascending: true })

          const imagesByQuestion: Record<string, { url: string, position: number }[]> = {}
          if (imagesData) {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
            imagesData.forEach((img: any) => {
              if (!imagesByQuestion[img.question_id]) imagesByQuestion[img.question_id] = []
              imagesByQuestion[img.question_id].push({
                url: `${supabaseUrl}/storage/v1/object/public/question-images/${img.file_path}`,
                position: img.position,
              })
            })
          }

          const map: Record<string, QuestionData> = {}
          if (qData) {
            qData.forEach((q: any) => {
              map[q.id] = {
                id: q.id,
                question_text: q.question_text,
                category_name: q.category?.name || '',
                images: imagesByQuestion[q.id] || [],
              }
            })
          }
          setQuestionsById(map)
        }

        const { data: existingAnswer } = await supabase
          .from('multiplayer_answers')
          .select('id, user_answer')
          .eq('player_id', playerRow.id)
          .eq('question_index', gameData.current_question_index)
          .maybeSingle()

        if (existingAnswer) {
          setAnswered(true)
          answeredRef.current = true
        }

        await refreshActiveCount(gameData.id)

        currentIndexRef.current = gameData.current_question_index
        setGame(gameData as Game)
        setLoading(false)
      } catch (e) {
        setClosedMsg('Impossible de charger cette partie.')
        setLoading(false)
      }
    }

    init()
    return () => { cancelled = true }
  }, [code, router, refreshActiveCount])

  // Applique un nouvel état de partie reçu (par Realtime ou par une relecture
  // manuelle de la DB) — factorisé pour être utilisé par les deux canaux.
  const applyGameUpdate = useCallback((newGame: Game) => {
    if (newGame.status !== 'en_cours') {
      if (newGame.status === 'annulee') {
        setClosedMsg('Cette salle a été fermée.')
      } else {
        const path = roomPathForStatus(newGame.status, code)
        if (path) router.replace(path)
      }
      return
    }
    if (currentIndexRef.current !== null && newGame.current_question_index !== currentIndexRef.current) {
      setAnswered(false)
      answeredRef.current = false
      setReponse('')
      reponseRef.current = ''
      lastTimerCheckRef.current = 0
    }
    currentIndexRef.current = newGame.current_question_index
    setGame(prev => prev ? { ...prev, ...newGame } : newGame)
  }, [code, router])

  // Realtime : avancement de question, changement de phase, présence
  useEffect(() => {
    if (!game?.id || !myUserId) return
    const supabase = supabaseRef.current
    const gameId = game.id

    const cleanup = subscribeRoomRealtime(supabase, {
      gameId,
      myUserId,
      onGameChange: applyGameUpdate,
      onPlayersChange: () => refreshActiveCount(gameId),
      onAnswersChange: () => {},
    })

    return cleanup
  }, [game?.id, myUserId, code, router, refreshActiveCount, applyGameUpdate])

  // Minuteur local, recalculé depuis l'heure serveur (question_started_at) —
  // jamais depuis un décompte purement client, pour rester synchronisé avec
  // les autres joueurs même en cas de latence.
  useEffect(() => {
    if (!game || game.status !== 'en_cours' || !game.question_started_at) return
    const timerDuration = game.config?.timer_duration || 20
    const startedAt = new Date(game.question_started_at).getTime()

    const tick = () => {
      const remaining = timerDuration - Math.floor((Date.now() - startedAt) / 1000)
      setTimeLeft(Math.max(0, remaining))
      if (remaining <= 0) {
        // On réessaie régulièrement plutôt qu'une seule fois : si le premier
        // appel est manqué (onglet mobile mis en veille, aléa réseau...), la
        // partie ne doit pas rester bloquée dès qu'un client redevient actif.
        // On relit aussi directement la ligne de la partie en DB : si un
        // évènement Realtime d'avancement a été manqué (les deux joueurs
        // avaient déjà changé de question côté serveur sans que ce client ne
        // le voie), on se resynchronise nous-mêmes plutôt que de dépendre
        // uniquement d'un flux d'évènements qui peut être raté.
        const now = Date.now()
        if (now - lastTimerCheckRef.current > 3000) {
          lastTimerCheckRef.current = now
          const gameId = game.id
          supabaseRef.current.rpc('check_question_timer', { p_game_id: gameId }).then(() => {
            supabaseRef.current
              .from('multiplayer_games')
              .select('id, code, status, host_id, question_ids, current_question_index, current_question_answered_count, question_started_at, config')
              .eq('id', gameId)
              .maybeSingle()
              .then(({ data }) => {
                if (data) applyGameUpdate(data as Game)
              })
          })
        }
        if (!answeredRef.current && !submittingRef.current) {
          handleRepondre(true)
        }
      }
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.question_started_at, game?.status, game?.id, game?.current_question_index])

  const handleRepondre = async (timedOut = false) => {
    if (!game || !myPlayerId || answeredRef.current || submittingRef.current) return
    submittingRef.current = true
    const supabase = supabaseRef.current
    const currentQuestionId = game.question_ids[game.current_question_index]

    const { error } = await supabase.from('multiplayer_answers').insert({
      game_id: game.id,
      player_id: myPlayerId,
      question_id: currentQuestionId,
      question_index: game.current_question_index,
      user_answer: reponseRef.current,
      timed_out: timedOut,
    })

    submittingRef.current = false
    if (!error) {
      setAnswered(true)
      answeredRef.current = true
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

  const total = game.question_ids.length
  const index = game.current_question_index
  const currentQuestionId = game.question_ids[index]
  const question = questionsById[currentQuestionId]
  const timerDuration = game.config?.timer_duration || 20
  const circumference = 2 * Math.PI * 22
  const strokeDashoffset = circumference * (1 - timeLeft / timerDuration)
  const timerColor = timeLeft <= 5 ? '#ff6b6b' : '#ffd93d'
  const answeredCount = Math.min(game.current_question_answered_count, activePlayersCount)

  if (!question) {
    return (
      <main className="min-h-screen bg-[#0f0e17] flex items-center justify-center">
        <p className="font-fredoka text-[#9b96b8] text-xl">Chargement de la question...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#0f0e17]" style={{ padding: '32px 24px' }}>

      <div className="flex justify-between items-center" style={{ maxWidth: '900px', margin: '0 auto 32px' }}>
        <span className="font-fredoka text-[#9b96b8] text-base">
          Question <span className="text-[#eeeaf8]">{index + 1}</span> / {total}
        </span>
        <div className="relative w-14 h-14">
          <svg width="56" height="56" viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="28" cy="28" r="22" fill="none" stroke="#1e1c2e" strokeWidth="4" />
            <circle
              cx="28" cy="28" r="22"
              fill="none"
              stroke={timerColor}
              strokeWidth="4"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center font-fredoka text-lg" style={{ color: timerColor }}>
            {timeLeft}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>

        <div className="w-full bg-[#1e1c2e] rounded-full" style={{ height: '6px' }}>
          <div
            className="rounded-full"
            style={{ height: '6px', width: `${((index + 1) / total) * 100}%`, background: '#ffd93d', transition: 'width 0.3s' }}
          ></div>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="inline-flex items-center gap-2 bg-[#1e1c2e] border border-[#2a2830] rounded-full px-4 py-2">
            <div className="w-2 h-2 rounded-full bg-[#ff6b6b]"></div>
            <span className="font-fredoka text-[#9b96b8] text-sm">{question.category_name}</span>
          </div>
          <span className="bg-[#1e1c2e] border border-[#3a3650] rounded-full px-4 py-2 font-fredoka text-sm text-[#4ecdc4]">
            {answeredCount}/{activePlayersCount} ont répondu
          </span>
        </div>

        <h2 className="font-fredoka text-3xl text-[#eeeaf8] leading-tight">
          {question.question_text}
        </h2>

        {question.images.length > 0 && (
          <div className="flex gap-3 flex-wrap">
            {question.images.map((img, i) => (
              <img
                key={i}
                src={img.url}
                alt={`image ${i + 1}`}
                className="rounded-2xl object-cover"
                style={{ maxHeight: '240px', maxWidth: '100%', border: '2px solid #2a2830' }}
              />
            ))}
          </div>
        )}

        {answered ? (
          <div className="bg-[#1e1c2e] border border-[#2a2830] rounded-2xl py-8 text-center flex flex-col gap-2">
            <p className="font-fredoka text-[#6bcb77] text-lg">Réponse envoyée !</p>
            <p className="text-[#9b96b8] text-sm">En attente des autres joueurs ou de la fin du temps imparti...</p>
          </div>
        ) : (
          <>
            <div>
              <label className="block font-fredoka text-[#9b96b8] text-base mb-3">Ta réponse</label>
              <textarea
                value={reponse}
                onChange={(e) => {
                  setReponse(e.target.value)
                  reponseRef.current = e.target.value
                }}
                placeholder="Écris ta réponse ici..."
                rows={4}
                className="w-full bg-[#1a1828] border border-[#3a3650] rounded-2xl px-5 py-4 text-[#eeeaf8] text-base outline-none resize-none"
                style={{ borderColor: reponse ? '#a78bfa' : '#3a3650' }}
              />
            </div>

            <button
              onClick={() => handleRepondre(false)}
              className="w-full rounded-2xl py-5 font-fredoka text-xl transition text-center"
              style={{
                background: reponse ? '#a78bfa' : '#2a2830',
                color: reponse ? '#0f0e17' : '#4a4760',
                cursor: reponse ? 'pointer' : 'not-allowed',
              }}
            >
              Valider ma réponse →
            </button>
          </>
        )}

      </div>
    </main>
  )
}

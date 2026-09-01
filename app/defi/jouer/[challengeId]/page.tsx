'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '../../../../lib/supabase'
import Avatar from '@/components/Avatar'
import BackButton from '@/components/BackButton'
import Skeleton from '@/components/Skeleton'
import Spinner from '@/components/Spinner'

type Question = { id: string, question_text: string, answer_text: string, category_name: string }
type SelfEval = 'oui' | 'en_partie' | 'non' | null
type Answer = { questionId: string, userAnswer: string, timedOut: boolean }

const evalConfig: Record<'oui' | 'en_partie' | 'non', { label: string, color: string, bg: string, points: string }> = {
  oui: { label: 'Oui', color: '#6bcb77', bg: '#1a2e1f', points: '1 point' },
  en_partie: { label: 'En partie', color: '#ffd93d', bg: '#1f1e10', points: '0,5 point' },
  non: { label: 'Non', color: '#ff6b6b', bg: '#2e1a1a', points: '0 point' },
}
const pointsMap = { oui: 1, en_partie: 0.5, non: 0 }

type Challenge = {
  id: string
  challenger_id: string
  opponent_id: string
  question_ids: string[]
  questions_count: number
  timer_duration: number
  status: 'pending' | 'declined' | 'completed'
  challenger_score: number | null
  opponent_score: number | null
  challenger_answered_at: string | null
  opponent_answered_at: string | null
}

type Phase = 'loading' | 'notfound' | 'accept' | 'declined' | 'jouer' | 'correction' | 'submitting' | 'resultat' | 'attente_adversaire'

export default function JouerDefi() {
  const params = useParams()
  const router = useRouter()
  const challengeId = params.challengeId as string

  const [phase, setPhase] = useState<Phase>('loading')
  const [meId, setMeId] = useState<string | null>(null)
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [isChallenger, setIsChallenger] = useState(false)
  const [otherPseudo, setOtherPseudo] = useState('')
  const [otherAvatarUrl, setOtherAvatarUrl] = useState<string | null>(null)

  const [questions, setQuestions] = useState<Question[]>([])
  const [index, setIndex] = useState(0)
  const [reponse, setReponse] = useState('')
  const [timeLeft, setTimeLeft] = useState(20)
  const reponseRef = useRef('')
  const timerRef = useRef(20)
  const answersRef = useRef<Answer[]>([])

  const [evals, setEvals] = useState<SelfEval[]>([])
  const [myScore, setMyScore] = useState<number | null>(null)
  const [finalStatus, setFinalStatus] = useState<'pending' | 'completed'>('pending')
  const [finalChallengerScore, setFinalChallengerScore] = useState<number | null>(null)
  const [finalOpponentScore, setFinalOpponentScore] = useState<number | null>(null)

  const [declining, setDeclining] = useState(false)
  const [error, setError] = useState('')

  const circumference = 2 * Math.PI * 22

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/connexion'); return }
      setMeId(user.id)

      const { data } = await supabase
        .from('quiz_challenges')
        .select('id, challenger_id, opponent_id, question_ids, questions_count, timer_duration, status, challenger_score, opponent_score, challenger_answered_at, opponent_answered_at')
        .eq('id', challengeId)
        .maybeSingle()

      if (!data) { setPhase('notfound'); return }
      const c = data as Challenge
      setChallenge(c)
      const amChallenger = c.challenger_id === user.id
      setIsChallenger(amChallenger)

      const otherId = amChallenger ? c.opponent_id : c.challenger_id
      const { data: idData } = await supabase.rpc('get_user_public_identity', { p_user_id: otherId })
      if (idData && idData.length > 0) {
        setOtherPseudo(idData[0].pseudo)
        setOtherAvatarUrl(idData[0].avatar_url)
      }

      if (c.status === 'declined') { setPhase('declined'); return }

      const myAnsweredAt = amChallenger ? c.challenger_answered_at : c.opponent_answered_at
      if (myAnsweredAt) {
        // Déjà joué : soit résultat complet si les deux ont fini, soit écran d'attente.
        setMyScore(amChallenger ? c.challenger_score : c.opponent_score)
        setFinalStatus(c.status)
        setFinalChallengerScore(c.challenger_score)
        setFinalOpponentScore(c.opponent_score)
        setPhase(c.status === 'completed' ? 'resultat' : 'attente_adversaire')
        return
      }

      // Pas encore répondu — l'adversaire (destinataire) voit un écran d'acceptation,
      // le challenger enchaîne directement puisqu'il a déjà lancé le défi lui-même.
      if (!amChallenger) {
        setPhase('accept')
        return
      }

      await chargerQuestions(c)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeId])

  const chargerQuestions = async (c: Challenge) => {
    const supabase = createClient()
    const { data: qData } = await supabase
      .from('questions')
      .select('id, question_text, answer_text, categories(name)')
      .in('id', c.question_ids)

    if (!qData) { setPhase('notfound'); return }
    const byId: Record<string, Question> = {}
    qData.forEach((q: any) => {
      byId[q.id] = { id: q.id, question_text: q.question_text, answer_text: q.answer_text, category_name: q.categories?.name || '' }
    })
    const ordered = c.question_ids.map(id => byId[id]).filter(Boolean)
    setQuestions(ordered)
    timerRef.current = c.timer_duration
    setTimeLeft(c.timer_duration)
    setPhase('jouer')
  }

  const handleAccepter = async () => {
    if (!challenge) return
    await chargerQuestions(challenge)
  }

  const handleRefuser = async () => {
    setDeclining(true)
    const supabase = createClient()
    await supabase.rpc('decline_quiz_challenge', { p_challenge_id: challengeId })
    setDeclining(false)
    setPhase('declined')
  }

  // Timer de jeu
  useEffect(() => {
    if (phase !== 'jouer' || questions.length === 0) return
    setTimeLeft(timerRef.current)
    setReponse('')
    reponseRef.current = ''
  }, [index, phase, questions.length])

  useEffect(() => {
    if (phase !== 'jouer' || questions.length === 0) return
    if (timeLeft <= 0) {
      handleNextQuestion(true)
      return
    }
    const interval = setInterval(() => setTimeLeft(prev => prev - 1), 1000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, phase, questions.length])

  const handleNextQuestion = (timedOut = false) => {
    const q = questions[index]
    answersRef.current = [...answersRef.current, { questionId: q.id, userAnswer: reponseRef.current, timedOut }]
    if (index + 1 >= questions.length) {
      setEvals(Array(questions.length).fill(null))
      setIndex(0)
      setPhase('correction')
      return
    }
    setIndex(prev => prev + 1)
  }

  const setEval = (val: SelfEval) => {
    const next = [...evals]
    next[index] = val
    setEvals(next)
  }

  const handleNextCorrection = async () => {
    if (index + 1 < questions.length) {
      setIndex(prev => prev + 1)
      return
    }
    // Dernière question corrigée — on soumet.
    setPhase('submitting')
    setError('')
    const supabase = createClient()
    const payload = questions.map((q, i) => ({
      question_id: q.id,
      user_answer: answersRef.current[i]?.userAnswer || '',
      self_eval: evals[i],
      position: i + 1,
      timed_out: answersRef.current[i]?.timedOut || false,
    }))

    const { data, error: submitError } = await supabase.rpc('submit_challenge_answers', {
      p_challenge_id: challengeId,
      p_answers: payload,
    })

    if (submitError || !data || data.length === 0) {
      setError("Impossible d'envoyer tes réponses. Réessaie.")
      setPhase('correction')
      return
    }

    const result = data[0]
    setMyScore(result.my_score)
    setFinalStatus(result.challenge_status)
    setFinalChallengerScore(result.challenger_score)
    setFinalOpponentScore(result.opponent_score)
    setPhase(result.challenge_status === 'completed' ? 'resultat' : 'attente_adversaire')
  }

  // ---- Rendus ----

  if (phase === 'loading') {
    return (
      <main className="min-h-screen bg-[#0f0e17]" style={{ padding: '32px 24px 60px' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="flex items-center gap-3"><BackButton /><Skeleton width="200px" height={32} /></div>
          <Skeleton height={220} radius="16px" />
        </div>
      </main>
    )
  }

  if (phase === 'notfound') {
    return (
      <main className="min-h-screen bg-[#0f0e17] flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-fredoka text-[#ff6b6b] text-xl">Ce défi est introuvable.</p>
        <Link href="/defi" className="font-fredoka text-sm text-[#a78bfa]">← Retour à mes défis</Link>
      </main>
    )
  }

  if (phase === 'declined') {
    return (
      <main className="min-h-screen bg-[#0f0e17] flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-fredoka text-[#9b96b8] text-xl">Ce défi a été refusé.</p>
        <Link href="/defi" className="font-fredoka text-sm text-[#a78bfa]">← Retour à mes défis</Link>
      </main>
    )
  }

  if (phase === 'accept') {
    return (
      <main className="min-h-screen bg-[#0f0e17] flex flex-col items-center justify-center gap-6 px-6 text-center">
        <Avatar url={otherAvatarUrl} size={72} border="accent" />
        <div>
          <p className="font-fredoka text-2xl text-[#eeeaf8] mb-2">{otherPseudo} te défie !</p>
          <p className="text-[#9b96b8] text-sm">
            {challenge?.questions_count} questions · {challenge?.timer_duration}s par question · vous répondez tous les deux aux mêmes questions
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleAccepter} className="rounded-2xl py-4 px-8 font-fredoka text-lg hover:opacity-90 transition" style={{ background: '#ffd93d', color: '#0f0e17' }}>
            Jouer →
          </button>
          <button onClick={handleRefuser} disabled={declining} className="rounded-2xl py-4 px-8 font-fredoka text-lg disabled:opacity-50 transition hover:bg-[#1e1c2e]" style={{ background: 'transparent', color: '#9b96b8', border: '1px solid #3a3650' }}>
            Refuser
          </button>
        </div>
      </main>
    )
  }

  if (phase === 'attente_adversaire') {
    return (
      <main className="min-h-screen bg-[#0f0e17] flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-fredoka text-[#ffd93d] text-2xl">Défi envoyé — ton score : {myScore}</p>
        <p className="text-[#9b96b8] text-sm">En attente que {otherPseudo} joue à son tour. Tu seras prévenu par notification.</p>
        <Link href="/defi" className="font-fredoka text-sm text-[#a78bfa] mt-2">← Retour à mes défis</Link>
      </main>
    )
  }

  if (phase === 'resultat') {
    const cScore = finalChallengerScore ?? 0
    const oScore = finalOpponentScore ?? 0
    const myFinal = isChallenger ? cScore : oScore
    const otherFinal = isChallenger ? oScore : cScore
    const victoire = myFinal > otherFinal
    const egalite = myFinal === otherFinal
    return (
      <main className="min-h-screen bg-[#0f0e17] flex flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="font-fredoka text-3xl" style={{ color: egalite ? '#9b96b8' : victoire ? '#6bcb77' : '#ff6b6b' }}>
          {egalite ? 'Égalité !' : victoire ? '🏆 Victoire !' : 'Défaite'}
        </p>
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="font-fredoka text-[#eeeaf8] text-lg">Toi</p>
            <p className="font-fredoka text-3xl text-[#ffd93d]">{myFinal}</p>
          </div>
          <span className="text-[#827f97] text-xl">vs</span>
          <div className="text-center">
            <Avatar url={otherAvatarUrl} size={36} border="accent" className="mx-auto mb-1" />
            <p className="font-fredoka text-[#eeeaf8] text-lg">{otherPseudo}</p>
            <p className="font-fredoka text-3xl text-[#ffd93d]">{otherFinal}</p>
          </div>
        </div>
        <Link href="/defi" className="rounded-2xl py-3 px-8 font-fredoka text-lg hover:opacity-90 transition" style={{ background: '#ffd93d', color: '#0f0e17' }}>
          Retour à mes défis
        </Link>
      </main>
    )
  }

  if (phase === 'submitting') {
    return (
      <main className="min-h-screen bg-[#0f0e17] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Spinner size={20} />
          <p className="font-fredoka text-[#9b96b8] text-xl">Envoi du résultat...</p>
        </div>
      </main>
    )
  }

  const total = questions.length

  if (phase === 'jouer') {
    const question = questions[index]
    if (!question) return null
    const strokeDashoffset = circumference * (1 - timeLeft / (challenge?.timer_duration || 20))
    const timerColor = timeLeft <= 5 ? '#ff6b6b' : '#ffd93d'
    return (
      <main className="min-h-screen bg-[#0f0e17]" style={{ padding: '32px 24px' }}>
        <div className="flex justify-between items-center" style={{ maxWidth: '900px', margin: '0 auto 32px' }}>
          <span className="font-fredoka text-[#9b96b8] text-base">
            Défi vs {otherPseudo} · Question <span className="text-[#eeeaf8]">{index + 1}</span> / {total}
          </span>
          <div className="relative w-14 h-14">
            <svg width="56" height="56" viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="28" cy="28" r="22" fill="none" stroke="#1e1c2e" strokeWidth="4" />
              <circle cx="28" cy="28" r="22" fill="none" stroke={timerColor} strokeWidth="4" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s linear' }} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center font-fredoka text-lg" style={{ color: timerColor }}>{timeLeft}</div>
          </div>
        </div>

        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <div className="w-full bg-[#1e1c2e] rounded-full" style={{ height: '6px' }}>
            <div className="rounded-full" style={{ height: '6px', width: `${((index + 1) / total) * 100}%`, background: '#ffd93d', transition: 'width 0.3s' }}></div>
          </div>

          <div className="inline-flex items-center gap-2 bg-[#1e1c2e] border border-[#2a2830] rounded-full px-4 py-2" style={{ width: 'fit-content' }}>
            <div className="w-2 h-2 rounded-full bg-[#ff6b6b]"></div>
            <span className="font-fredoka text-[#9b96b8] text-sm">{question.category_name}</span>
          </div>

          <h2 className="font-fredoka text-3xl text-[#eeeaf8] leading-tight">{question.question_text}</h2>

          <div>
            <label className="block font-fredoka text-[#9b96b8] text-base mb-3">Ta réponse</label>
            <textarea
              value={reponse}
              onChange={e => { setReponse(e.target.value); reponseRef.current = e.target.value }}
              placeholder="Écris ta réponse ici..."
              rows={4}
              className="w-full bg-[#1a1828] border border-[#3a3650] rounded-2xl px-5 py-4 text-[#eeeaf8] text-base outline-none resize-none"
              style={{ borderColor: reponse ? '#a78bfa' : '#3a3650' }}
            />
          </div>

          <button
            onClick={() => handleNextQuestion()}
            className="w-full rounded-2xl py-5 font-fredoka text-xl transition text-center"
            style={{ background: reponse ? '#a78bfa' : '#2a2830', color: reponse ? '#0f0e17' : '#8480a1', cursor: reponse ? 'pointer' : 'not-allowed' }}
          >
            Question suivante →
          </button>
        </div>
      </main>
    )
  }

  // phase === 'correction'
  const answer = answersRef.current[index]
  const question = questions[index]
  const evalActuelle = evals[index]
  const btnNextLabel = index + 1 >= total ? 'Envoyer mon résultat →' : 'Continuer →'

  return (
    <main className="min-h-screen bg-[#0f0e17]" style={{ padding: '32px 24px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <BackButton />
            <span className="font-fredoka text-[#9b96b8] text-base">Correction <span className="text-[#eeeaf8]">{index + 1}</span> / {total}</span>
          </div>
          <span className="bg-[#1e1c2e] border border-[#3a3650] rounded-full px-4 py-2 font-fredoka text-sm text-[#a78bfa]">Défi vs {otherPseudo}</span>
        </div>

        {error && (
          <div className="bg-[#2e1a1a] border border-[#ff6b6b] rounded-xl px-4 py-3">
            <p className="text-[#ff6b6b] text-sm">{error}</p>
          </div>
        )}

        <div className="w-full bg-[#1e1c2e] rounded-full" style={{ height: '6px' }}>
          <div className="rounded-full" style={{ height: '6px', width: `${((index + 1) / total) * 100}%`, background: '#a78bfa', transition: 'width 0.3s' }}></div>
        </div>

        <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <div className="inline-flex items-center gap-2 bg-[#1e1c2e] border border-[#2a2830] rounded-full px-4 py-2" style={{ width: 'fit-content' }}>
            <div className="w-2 h-2 rounded-full bg-[#ff6b6b]"></div>
            <span className="font-fredoka text-[#9b96b8] text-sm">{question.category_name}</span>
          </div>

          <h2 className="font-fredoka text-3xl text-[#eeeaf8] leading-tight">{question.question_text}</h2>

          <div className="bg-[#1a2e1f] border border-[#1f3a28] rounded-2xl px-5 py-4">
            <p className="font-fredoka text-[#6bcb77] text-sm mb-2">La bonne réponse</p>
            <p className="text-[#eeeaf8] text-base font-semibold">{question.answer_text}</p>
          </div>

          {answer?.timedOut && !answer.userAnswer ? (
            <div className="inline-flex items-center gap-2 bg-[#2e1a1a] border border-[#ff6b6b] rounded-full px-4 py-2" style={{ width: 'fit-content' }}>
              <div className="w-2 h-2 rounded-full bg-[#ff6b6b]"></div>
              <span className="font-fredoka text-[#ff6b6b] text-sm">Temps écoulé — pas de réponse</span>
            </div>
          ) : (
            <div className="bg-[#1e1c2e] border border-[#2a2830] rounded-2xl px-5 py-4">
              <p className="font-fredoka text-[#9b96b8] text-sm mb-2">Ta réponse</p>
              <p className="text-[#c9c4e0] text-base font-semibold">{answer?.userAnswer}</p>
            </div>
          )}

          <div>
            <p className="font-fredoka text-[#c9c4e0] text-lg mb-4">Tu as eu bon ?</p>
            <div className="flex gap-4">
              {(Object.entries(evalConfig) as [keyof typeof evalConfig, typeof evalConfig[keyof typeof evalConfig]][]).map(([key, val]) => (
                <button
                  key={key}
                  onClick={() => setEval(key)}
                  className="flex-1 rounded-xl py-4 font-fredoka text-base transition hover:opacity-90"
                  style={{
                    background: evalActuelle === key ? val.bg : '#1a1828',
                    border: `2px solid ${evalActuelle === key ? val.color : '#2a2830'}`,
                    color: evalActuelle === key ? val.color : '#9b96b8',
                  }}
                >
                  {val.label}
                  <div className="text-xs font-sans mt-1 opacity-70">{val.points}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={handleNextCorrection}
          disabled={!evalActuelle}
          className="w-full rounded-2xl py-5 font-fredoka text-xl transition text-center hover:opacity-90 disabled:opacity-50"
          style={{ background: evalActuelle ? '#a78bfa' : '#2a2830', color: evalActuelle ? '#0f0e17' : '#8480a1' }}
        >
          {btnNextLabel}
        </button>
      </div>
    </main>
  )
}

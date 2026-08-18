'use client'

import Link from 'next/link'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '../../../../lib/supabase'
import BackButton from '@/components/BackButton'
import Skeleton from '@/components/Skeleton'
import Spinner from '@/components/Spinner'

type Card = { id: string, recto: string, verso: string }
type Mode = 'classique' | 'flashcard'
type SelfEval = 'oui' | 'en_partie' | 'non'
type CardResult = { selfEval: SelfEval, sideShown: 'recto' | 'verso' | null, wasSkippedFirst: boolean }
type Phase = 'etude' | 'correction' | 'resume' | 'saving' | 'termine'

const evalConfig: Record<SelfEval, { label: string, color: string, bg: string, points: string }> = {
  oui: { label: 'Oui', color: '#6bcb77', bg: '#1a2e1f', points: '1 point' },
  en_partie: { label: 'En partie', color: '#ffd93d', bg: '#1f1e10', points: '0,5 point' },
  non: { label: 'Non', color: '#ff6b6b', bg: '#2e1a1a', points: '0 point' },
}
const pointsMap: Record<SelfEval, number> = { oui: 1, en_partie: 0.5, non: 0 }

function EtudierContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const setId = params.setId as string
  const mode: Mode = searchParams.get('mode') === 'flashcard' ? 'flashcard' : 'classique'

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [setName, setSetName] = useState('')
  const [cards, setCards] = useState<Card[]>([])

  const [phase, setPhase] = useState<Phase>('etude')
  const [index, setIndex] = useState(0)
  const [reponse, setReponse] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [evalActuelle, setEvalActuelle] = useState<SelfEval | null>(null)

  const sideShownRef = useRef<Record<string, 'recto' | 'verso'>>({})
  const resultsRef = useRef<Record<string, CardResult>>({})
  const toReviewRef = useRef<string[]>([])
  const answersRef = useRef<Record<string, string>>({}) // classique : réponse tapée par carte, affichée en correction
  const revealedAnswerRef = useRef<Record<string, string>>({}) // flashcard : essai tapé avant révélation, affiché à côté de la vraie réponse

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/connexion'); return }

      const { data: setData } = await supabase
        .from('revision_sets')
        .select('id, name')
        .eq('id', setId)
        .maybeSingle()

      if (!setData) { setNotFound(true); setLoading(false); return }

      const { data: cardsData } = await supabase
        .from('revision_cards')
        .select('id, recto, verso')
        .eq('set_id', setId)

      if (!cardsData || cardsData.length === 0) { setNotFound(true); setLoading(false); return }

      setSetName(setData.name)
      const shuffled = [...cardsData].sort(() => Math.random() - 0.5)
      shuffled.forEach(c => {
        sideShownRef.current[c.id] = Math.random() < 0.5 ? 'recto' : 'verso'
      })
      setCards(shuffled)
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId])

  const currentQueue = phase === 'resume' ? toReviewRef.current : cards.map(c => c.id)
  const currentCardId = currentQueue[index]
  const currentCard = cards.find(c => c.id === currentCardId) || null

  const getPromptAnswer = (card: Card) => {
    if (mode === 'classique') return { prompt: card.recto, answer: card.verso, side: null as 'recto' | 'verso' | null }
    const side = sideShownRef.current[card.id]
    return side === 'verso'
      ? { prompt: card.verso, answer: card.recto, side }
      : { prompt: card.recto, answer: card.verso, side: 'recto' as const }
  }

  const finishSession = async (finalResults: Record<string, CardResult>) => {
    setPhase('saving')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/connexion'); return }

    const score = cards.reduce((acc, c) => acc + pointsMap[finalResults[c.id].selfEval], 0)

    const { data: session, error: sessionError } = await supabase
      .from('revision_sessions')
      .insert({ set_id: setId, user_id: user.id, mode, cards_count: cards.length, score })
      .select()
      .single()

    if (sessionError || !session) {
      setPhase('termine')
      return
    }

    const rows = cards.map((c, i) => ({
      session_id: session.id,
      card_id: c.id,
      side_shown: finalResults[c.id].sideShown,
      self_eval: finalResults[c.id].selfEval,
      was_skipped_first: finalResults[c.id].wasSkippedFirst,
      position: i + 1,
    }))
    await supabase.from('revision_session_cards').insert(rows)

    setPhase('termine')
  }

  // --- Mode classique ---
  const handleClassiqueSuivant = () => {
    if (currentCard) answersRef.current[currentCard.id] = reponse
    if (index + 1 >= cards.length) {
      setIndex(0)
      setReponse('')
      setEvalActuelle(null)
      setPhase('correction')
      return
    }
    setIndex(prev => prev + 1)
    setReponse('')
  }

  const handleClassiqueContinuer = () => {
    if (!currentCard || !evalActuelle) return
    resultsRef.current[currentCard.id] = { selfEval: evalActuelle, sideShown: null, wasSkippedFirst: false }
    if (index + 1 >= cards.length) {
      finishSession(resultsRef.current)
      return
    }
    setIndex(prev => prev + 1)
    setEvalActuelle(null)
  }

  // --- Mode flashcard ---
  const handleFlashcardVoirReponse = () => {
    if (currentCard) revealedAnswerRef.current[currentCard.id] = reponse
    setRevealed(true)
  }

  const avancerFlashcard = () => {
    setReponse('')
    setRevealed(false)
    if (index + 1 >= currentQueue.length) {
      if (phase === 'etude') {
        if (toReviewRef.current.length > 0) {
          setIndex(0)
          setPhase('resume')
        } else {
          finishSession(resultsRef.current)
        }
      } else {
        finishSession(resultsRef.current)
      }
      return
    }
    setIndex(prev => prev + 1)
  }

  const handleFlashcardEval = (val: SelfEval) => {
    if (!currentCard) return
    resultsRef.current[currentCard.id] = {
      selfEval: val,
      sideShown: sideShownRef.current[currentCard.id],
      wasSkippedFirst: phase === 'resume',
    }
    avancerFlashcard()
  }

  const handleFlashcardPasser = () => {
    if (!currentCard) return
    toReviewRef.current.push(currentCard.id)
    avancerFlashcard()
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0f0e17]" style={{ padding: '32px 24px' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <BackButton />
              <Skeleton width={140} height={18} />
            </div>
            <Skeleton width={90} height={30} radius="9999px" />
          </div>
          <Skeleton height={6} radius="9999px" />
          <Skeleton height={38} width="85%" />
          <Skeleton height={120} radius="16px" />
          <Skeleton height={64} radius="16px" />
        </div>
      </main>
    )
  }

  if (notFound) {
    return (
      <main className="min-h-screen bg-[#0f0e17] flex flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="font-fredoka text-[#ff6b6b] text-xl">Ce set est introuvable ou ne contient aucune carte.</p>
        <Link href="/revision" className="bg-[#ffd93d] text-[#0f0e17] rounded-2xl py-3 px-8 font-fredoka text-lg">
          Retour à mes révisions
        </Link>
      </main>
    )
  }

  if (phase === 'saving') {
    return (
      <main className="min-h-screen bg-[#0f0e17] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Spinner size={20} />
          <p className="font-fredoka text-[#9b96b8] text-xl">Sauvegarde en cours...</p>
        </div>
      </main>
    )
  }

  if (phase === 'termine') {
    const finalScore = cards.reduce((acc, c) => acc + pointsMap[resultsRef.current[c.id]?.selfEval || 'non'], 0)
    const evals = cards.map(c => resultsRef.current[c.id]?.selfEval)
    const ouiCount = evals.filter(e => e === 'oui').length
    const enPartieCount = evals.filter(e => e === 'en_partie').length
    const nonCount = evals.filter(e => e === 'non').length

    return (
      <main className="min-h-screen bg-[#0f0e17]" style={{ padding: '32px 24px' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-8 text-center">
            <p className="font-fredoka text-[#9b96b8] text-sm uppercase tracking-widest mb-3">Session terminée</p>
            <h2 className="font-fredoka text-3xl text-[#eeeaf8] mb-2">{setName}</h2>
            <p className="font-fredoka text-5xl text-[#ffd93d] mb-2">{finalScore} <span className="text-2xl text-[#827f97]">/ {cards.length}</span></p>
            <p className="text-[#827f97] text-sm">{mode === 'classique' ? 'Mode classique' : 'Mode flashcard'}</p>
          </div>

          <div className="flex gap-3">
            <div className="flex-1 bg-[#1a2e1f] border border-[#1f3a28] rounded-xl p-4 text-center">
              <p className="font-fredoka text-2xl text-[#6bcb77]">{ouiCount}</p>
              <p className="text-[#827f97] text-xs">Bonnes</p>
            </div>
            <div className="flex-1 bg-[#1f1e10] border border-[#3a3210] rounded-xl p-4 text-center">
              <p className="font-fredoka text-2xl text-[#ffd93d]">{enPartieCount}</p>
              <p className="text-[#827f97] text-xs">En partie</p>
            </div>
            <div className="flex-1 bg-[#2e1a1a] border border-[#3a2020] rounded-xl p-4 text-center">
              <p className="font-fredoka text-2xl text-[#ff6b6b]">{nonCount}</p>
              <p className="text-[#827f97] text-xs">Mauvaises</p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Link href={`/revision/${setId}`} className="block w-full bg-[#ffd93d] text-[#0f0e17] rounded-2xl py-4 font-fredoka text-lg text-center hover:opacity-90 transition">
              Retour au set
            </Link>
            <Link href="/revision" className="block w-full border border-[#3a3650] text-[#c9c4e0] rounded-2xl py-4 font-fredoka text-lg text-center hover:bg-[#1e1c2e] transition">
              Mes révisions
            </Link>
          </div>
        </div>
      </main>
    )
  }

  if (!currentCard) return null

  const total = currentQueue.length
  const phaseLabel = phase === 'etude' ? 'Étude' : phase === 'correction' ? 'Correction' : 'Résumé final'
  const { prompt, answer } = getPromptAnswer(currentCard)

  return (
    <main className="min-h-screen bg-[#0f0e17]" style={{ padding: '32px 24px' }}>
      <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <BackButton />
            <span className="font-fredoka text-[#9b96b8] text-base">
              {phaseLabel} <span className="text-[#eeeaf8]">{index + 1}</span> / {total}
            </span>
          </div>
          <span className="bg-[#1e1c2e] border border-[#3a3650] rounded-full px-4 py-2 font-fredoka text-sm text-[#a78bfa]">
            {setName}
          </span>
        </div>

        <div className="w-full bg-[#1e1c2e] rounded-full" style={{ height: '6px' }}>
          <div
            className="rounded-full"
            style={{ height: '6px', width: `${((index + 1) / total) * 100}%`, background: phase === 'etude' ? '#ffd93d' : '#a78bfa', transition: 'width 0.3s' }}
          ></div>
        </div>

        {/* Mode classique — phase étude : question, réponse libre */}
        {mode === 'classique' && phase === 'etude' && (
          <div key={`classique-etude-${currentCard.id}`} className="coolos-card-transition" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            <h2 className="font-fredoka text-3xl text-[#eeeaf8] leading-tight">{prompt}</h2>
            <div>
              <label className="block font-fredoka text-[#9b96b8] text-base mb-3">Ta réponse</label>
              <textarea
                value={reponse}
                onChange={e => setReponse(e.target.value)}
                placeholder="Écris ta réponse ici..."
                rows={4}
                className="w-full bg-[#1a1828] border border-[#3a3650] rounded-2xl px-5 py-4 text-[#eeeaf8] text-base outline-none resize-none transition"
                style={{ borderColor: reponse ? '#a78bfa' : '#3a3650' }}
              />
            </div>
            <button
              onClick={handleClassiqueSuivant}
              className="w-full rounded-2xl py-5 font-fredoka text-xl transition text-center hover:opacity-90"
              style={{
                background: reponse ? '#a78bfa' : '#2a2830',
                color: reponse ? '#0f0e17' : '#8480a1',
                cursor: reponse ? 'pointer' : 'not-allowed',
              }}
              disabled={!reponse}
            >
              Carte suivante →
            </button>
          </div>
        )}

        {/* Mode classique — phase correction : réponse officielle + auto-éval */}
        {mode === 'classique' && phase === 'correction' && (
          <div key={`classique-correction-${currentCard.id}`} className="coolos-card-transition" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            <h2 className="font-fredoka text-3xl text-[#eeeaf8] leading-tight">{getPromptAnswer(currentCard).prompt}</h2>
            <div className="bg-[#1a2e1f] border border-[#1f3a28] rounded-2xl px-5 py-4">
              <p className="font-fredoka text-[#6bcb77] text-sm mb-2">La bonne réponse</p>
              <p className="text-[#eeeaf8] text-base font-semibold">{getPromptAnswer(currentCard).answer}</p>
            </div>
            {answersRef.current[currentCard.id] ? (
              <div className="bg-[#1e1c2e] border border-[#2a2830] rounded-2xl px-5 py-4">
                <p className="font-fredoka text-[#9b96b8] text-sm mb-2">Ta réponse</p>
                <p className="text-[#c9c4e0] text-base font-semibold">{answersRef.current[currentCard.id]}</p>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-full px-4 py-2" style={{ background: '#2e1a1a', border: '1px solid #ff6b6b', width: 'fit-content' }}>
                <div className="w-2 h-2 rounded-full bg-[#ff6b6b]"></div>
                <span className="font-fredoka text-[#ff6b6b] text-sm">Pas de réponse</span>
              </div>
            )}
            <div>
              <p className="font-fredoka text-[#c9c4e0] text-lg mb-4">Tu as eu bon ?</p>
              <div className="flex gap-4">
                {(Object.entries(evalConfig) as [SelfEval, typeof evalConfig[SelfEval]][]).map(([key, val]) => (
                  <button
                    key={key}
                    onClick={() => setEvalActuelle(key)}
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
            <button
              onClick={handleClassiqueContinuer}
              disabled={!evalActuelle}
              className="w-full rounded-2xl py-5 font-fredoka text-xl transition text-center hover:opacity-90"
              style={{
                background: evalActuelle ? (evalActuelle === 'oui' ? '#6bcb77' : evalActuelle === 'en_partie' ? '#ffd93d' : '#ff6b6b') : '#2a2830',
                color: evalActuelle ? '#0f0e17' : '#8480a1',
                cursor: evalActuelle ? 'pointer' : 'not-allowed',
              }}
            >
              {index + 1 >= cards.length ? 'Voir mon résumé →' : 'Continuer →'}
            </button>
          </div>
        )}

        {/* Mode flashcard — phase étude : recto/verso aléatoire, révéler ou passer */}
        {mode === 'flashcard' && phase === 'etude' && (
          <div key={`flashcard-etude-${currentCard.id}-${revealed}`} className="coolos-card-transition" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            <h2 className="font-fredoka text-3xl text-[#eeeaf8] leading-tight">{prompt}</h2>
            {!revealed ? (
              <>
                <div>
                  <label className="block font-fredoka text-[#9b96b8] text-base mb-3">Essaie de te souvenir...</label>
                  <textarea
                    value={reponse}
                    onChange={e => setReponse(e.target.value)}
                    placeholder="(optionnel — juste pour t'aider à réfléchir avant de révéler)"
                    rows={3}
                    className="w-full bg-[#1a1828] border border-[#3a3650] rounded-2xl px-5 py-4 text-[#eeeaf8] text-base outline-none resize-none transition"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleFlashcardVoirReponse}
                    className="flex-1 rounded-2xl py-5 font-fredoka text-xl transition text-center hover:opacity-90"
                    style={{ background: '#a78bfa', color: '#0f0e17' }}
                  >
                    Voir la réponse →
                  </button>
                  <button
                    onClick={handleFlashcardPasser}
                    className="rounded-2xl py-5 px-6 font-fredoka text-lg transition text-center border border-[#3a3650] text-[#9b96b8] hover:bg-[#1e1c2e]"
                  >
                    Passer
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="bg-[#1a2e1f] border border-[#1f3a28] rounded-2xl px-5 py-4">
                  <p className="font-fredoka text-[#6bcb77] text-sm mb-2">La réponse</p>
                  <p className="text-[#eeeaf8] text-base font-semibold">{answer}</p>
                </div>
                {revealedAnswerRef.current[currentCard.id] && (
                  <div className="bg-[#1e1c2e] border border-[#2a2830] rounded-2xl px-5 py-4">
                    <p className="font-fredoka text-[#9b96b8] text-sm mb-2">Ton essai</p>
                    <p className="text-[#c9c4e0] text-base font-semibold">{revealedAnswerRef.current[currentCard.id]}</p>
                  </div>
                )}
                <div>
                  <p className="font-fredoka text-[#c9c4e0] text-lg mb-4">Tu avais bon ?</p>
                  <div className="flex gap-4">
                    {(Object.entries(evalConfig) as [SelfEval, typeof evalConfig[SelfEval]][]).map(([key, val]) => (
                      <button
                        key={key}
                        onClick={() => handleFlashcardEval(key)}
                        className="flex-1 rounded-xl py-4 font-fredoka text-base transition hover:opacity-90"
                        style={{ background: val.bg, border: `2px solid ${val.color}`, color: val.color }}
                      >
                        {val.label}
                        <div className="text-xs font-sans mt-1 opacity-70">{val.points}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Mode flashcard — résumé final : cartes passées, évaluation obligatoire */}
        {mode === 'flashcard' && phase === 'resume' && (
          <div key={`flashcard-resume-${currentCard.id}`} className="coolos-card-transition" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            <div className="bg-[#1e1c2e] border border-[#a78bfa] rounded-xl px-4 py-3 text-center">
              <p className="font-fredoka text-[#a78bfa] text-sm">Résumé final — évalue les cartes que tu as passées</p>
            </div>
            <h2 className="font-fredoka text-3xl text-[#eeeaf8] leading-tight">{prompt}</h2>
            <div className="bg-[#1a2e1f] border border-[#1f3a28] rounded-2xl px-5 py-4">
              <p className="font-fredoka text-[#6bcb77] text-sm mb-2">La réponse</p>
              <p className="text-[#eeeaf8] text-base font-semibold">{answer}</p>
            </div>
            <div>
              <p className="font-fredoka text-[#c9c4e0] text-lg mb-4">Tu avais bon ?</p>
              <div className="flex gap-4">
                {(Object.entries(evalConfig) as [SelfEval, typeof evalConfig[SelfEval]][]).map(([key, val]) => (
                  <button
                    key={key}
                    onClick={() => handleFlashcardEval(key)}
                    className="flex-1 rounded-xl py-4 font-fredoka text-base transition hover:opacity-90"
                    style={{ background: val.bg, border: `2px solid ${val.color}`, color: val.color }}
                  >
                    {val.label}
                    <div className="text-xs font-sans mt-1 opacity-70">{val.points}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  )
}

export default function EtudierSet() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[#0f0e17] flex items-center justify-center">
        <Spinner size={28} label="Chargement" />
      </main>
    }>
      <EtudierContent />
    </Suspense>
  )
}

'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '../../../../lib/supabase'
import { isAnswerCorrect, type ImageBlank } from '../../../../lib/imageCloze'
import BackButton from '@/components/BackButton'
import Skeleton from '@/components/Skeleton'
import Spinner from '@/components/Spinner'

type ImageCard = { id: string, image_path: string, blanks: ImageBlank[] }
type ImageCardRow = { id: string, image_path: string, revision_image_cloze_blanks: ImageBlank[] }
type ResolvedInfo = { isCorrect: boolean, given: string, attempts: number }
type Phase = 'etude' | 'saving' | 'termine'

async function getSignedImageUrls(paths: (string | null | undefined)[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths.filter((p): p is string => !!p)))
  if (unique.length === 0) return {}
  const supabase = createClient()
  const { data } = await supabase.storage.from('revision-images').createSignedUrls(unique, 3600)
  const map: Record<string, string> = {}
  ;(data || []).forEach(d => { if (d.signedUrl && d.path) map[d.path] = d.signedUrl })
  return map
}

export default function EtudierImage() {
  const params = useParams()
  const router = useRouter()
  const setId = params.setId as string

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [setName, setSetName] = useState('')
  const [cards, setCards] = useState<ImageCard[]>([])
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})

  const [phase, setPhase] = useState<Phase>('etude')
  const [cardIndex, setCardIndex] = useState(0)
  const [activeBlankId, setActiveBlankId] = useState<string | null>(null)
  const [answerInput, setAnswerInput] = useState('')
  const [wrongFlashId, setWrongFlashId] = useState<string | null>(null)
  const [attempts, setAttempts] = useState<Record<string, number>>({})
  const [resolved, setResolved] = useState<Record<string, ResolvedInfo>>({})

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
        .from('revision_image_cloze_cards')
        .select('id, image_path, revision_image_cloze_blanks(id, x, y, width, height, answer)')
        .eq('set_id', setId)
        .order('created_at', { ascending: true })

      const loaded = ((cardsData || []) as ImageCardRow[]).map(c => ({
        id: c.id, image_path: c.image_path, blanks: c.revision_image_cloze_blanks || [],
      }))

      if (loaded.length === 0) { setNotFound(true); setLoading(false); return }

      setSetName(setData.name)
      setCards(loaded)
      const urls = await getSignedImageUrls(loaded.map(c => c.image_path))
      setImageUrls(urls)
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId])

  const currentCard = cards[cardIndex] || null
  const totalBlanksInCard = currentCard ? currentCard.blanks.length : 0
  const resolvedCountInCard = currentCard ? currentCard.blanks.filter(b => resolved[b.id]).length : 0
  const cardFullyResolved = currentCard ? resolvedCountInCard === totalBlanksInCard : false

  const finishSession = async () => {
    setPhase('saving')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/connexion'); return }

    const allBlanks = cards.flatMap(c => c.blanks)
    const score = allBlanks.reduce((acc, b) => acc + (resolved[b.id]?.isCorrect ? 1 : 0), 0)

    const { data: session, error: sessionError } = await supabase
      .from('revision_sessions')
      .insert({ set_id: setId, user_id: user.id, mode: 'image_trous', cards_count: cards.length, score })
      .select()
      .single()

    if (sessionError || !session) { setPhase('termine'); return }

    const rows = allBlanks.map((b, i) => {
      const r = resolved[b.id]
      return {
        session_id: session.id,
        blank_id: b.id,
        position: i + 1,
        given_answer: r?.given || null,
        correct_answer: b.answer,
        is_correct: !!r?.isCorrect,
        attempts: attempts[b.id] || 1,
      }
    })
    await supabase.from('revision_image_cloze_results').insert(rows)
    supabase.rpc('check_and_award_badges', { p_user_id: user.id }).then(() => {})

    setPhase('termine')
  }

  const handleSelectBlank = (blankId: string) => {
    if (resolved[blankId]) return
    setActiveBlankId(blankId)
    setAnswerInput('')
  }

  const handleSubmitAnswer = () => {
    if (!activeBlankId || !currentCard || !answerInput.trim()) return
    const blank = currentCard.blanks.find(b => b.id === activeBlankId)
    if (!blank) return
    const newAttempts = (attempts[activeBlankId] || 0) + 1
    setAttempts(prev => ({ ...prev, [activeBlankId]: newAttempts }))
    if (isAnswerCorrect(answerInput, blank.answer)) {
      setResolved(prev => ({ ...prev, [activeBlankId]: { isCorrect: true, given: answerInput, attempts: newAttempts } }))
      setActiveBlankId(null)
      setAnswerInput('')
    } else {
      setWrongFlashId(activeBlankId)
      setTimeout(() => setWrongFlashId(null), 500)
    }
  }

  const handleReveal = () => {
    if (!activeBlankId) return
    const blank = currentCard?.blanks.find(b => b.id === activeBlankId)
    if (!blank) return
    setResolved(prev => ({ ...prev, [activeBlankId]: { isCorrect: false, given: answerInput, attempts: attempts[activeBlankId] || 0 } }))
    setActiveBlankId(null)
    setAnswerInput('')
  }

  const handleCardSuivante = () => {
    if (cardIndex + 1 >= cards.length) {
      finishSession()
      return
    }
    setCardIndex(prev => prev + 1)
    setActiveBlankId(null)
    setAnswerInput('')
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
          <Skeleton height={280} radius="16px" />
          <Skeleton height={64} radius="16px" />
        </div>
      </main>
    )
  }

  if (notFound) {
    return (
      <main className="min-h-screen bg-[#0f0e17] flex flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="font-fredoka text-[#ff6b6b] text-xl">Ce set est introuvable ou ne contient aucune carte-image à trous.</p>
        <div className="flex flex-col gap-3" style={{ width: '100%', maxWidth: '320px' }}>
          <Link href="/revision" className="bg-[#ffd93d] text-[#0f0e17] rounded-2xl py-3 px-8 font-fredoka text-lg text-center">
            Retour à mes révisions
          </Link>
          <Link href="/profil" className="border border-[#3a3650] text-[#c9c4e0] rounded-2xl py-3 px-8 font-fredoka text-lg text-center hover:bg-[#1e1c2e] transition">
            Retour à mon profil
          </Link>
        </div>
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
    const allBlanks = cards.flatMap(c => c.blanks)
    const total = allBlanks.length
    const correctCount = allBlanks.filter(b => resolved[b.id]?.isCorrect).length
    const incorrectCount = total - correctCount

    return (
      <main className="min-h-screen bg-[#0f0e17]" style={{ padding: '32px 24px' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-8 text-center">
            <p className="font-fredoka text-[#9b96b8] text-sm uppercase tracking-widest mb-3">Session terminée</p>
            <h2 className="font-fredoka text-3xl text-[#eeeaf8] mb-2">{setName}</h2>
            <p className="font-fredoka text-5xl text-[#6bcb77] mb-2">{correctCount} <span className="text-2xl text-[#827f97]">/ {total}</span></p>
            <p className="text-[#827f97] text-sm">Mode carte-image à trous</p>
          </div>

          <div className="flex gap-3">
            <div className="flex-1 bg-[#1a2e1f] border border-[#1f3a28] rounded-xl p-4 text-center">
              <p className="font-fredoka text-2xl text-[#6bcb77]">{correctCount}</p>
              <p className="text-[#827f97] text-xs">Bonnes</p>
            </div>
            <div className="flex-1 bg-[#2e1a1a] border border-[#3a2020] rounded-xl p-4 text-center">
              <p className="font-fredoka text-2xl text-[#ff6b6b]">{incorrectCount}</p>
              <p className="text-[#827f97] text-xs">Révélées / ratées</p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Link href={`/revision/${setId}`} className="block w-full bg-[#6bcb77] text-[#0f0e17] rounded-2xl py-4 font-fredoka text-lg text-center hover:opacity-90 transition">
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

  return (
    <main className="min-h-screen bg-[#0f0e17]" style={{ padding: '32px 24px' }}>
      <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <BackButton />
            <span className="font-fredoka text-[#9b96b8] text-base">
              Carte <span className="text-[#eeeaf8]">{cardIndex + 1}</span> / {cards.length} · {resolvedCountInCard}/{totalBlanksInCard} trous
            </span>
          </div>
          <span className="bg-[#1e1c2e] border border-[#3a3650] rounded-full px-4 py-2 font-fredoka text-sm text-[#6bcb77]">
            {setName}
          </span>
        </div>

        <div className="w-full bg-[#1e1c2e] rounded-full" style={{ height: '6px' }}>
          <div
            className="rounded-full"
            style={{ height: '6px', width: `${((cardIndex + 1) / cards.length) * 100}%`, background: '#6bcb77', transition: 'width 0.3s' }}
          ></div>
        </div>

        <div key={`image-${currentCard.id}`} className="coolos-card-transition" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
            {imageUrls[currentCard.image_path] && (
              <img src={imageUrls[currentCard.image_path]} alt="" draggable={false} style={{ display: 'block', maxWidth: '100%', borderRadius: '16px', userSelect: 'none' }} />
            )}
            {currentCard.blanks.map((b, i) => {
              const r = resolved[b.id]
              if (r?.isCorrect) return null
              const isActive = activeBlankId === b.id
              const isWrongFlash = wrongFlashId === b.id
              return (
                <div
                  key={b.id}
                  onClick={() => handleSelectBlank(b.id)}
                  style={{
                    position: 'absolute',
                    left: `${b.x}%`, top: `${b.y}%`, width: `${b.width}%`, height: `${b.height}%`,
                    background: r ? 'rgba(255,107,107,0.6)' : (isActive ? 'rgba(255,217,61,0.6)' : 'rgba(15,14,23,0.92)'),
                    border: `2px solid ${r ? '#ff6b6b' : (isActive ? '#ffd93d' : '#6bcb77')}`,
                    borderRadius: '4px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: r ? 'default' : 'pointer',
                    transform: isWrongFlash ? 'scale(0.95)' : 'scale(1)',
                    transition: 'transform 0.15s',
                    overflow: 'hidden',
                    padding: '2px',
                  }}
                >
                  {r ? (
                    <span className="font-fredoka text-xs text-center" style={{ color: '#eeeaf8', lineHeight: '1.2' }}>{b.answer}</span>
                  ) : (
                    <span className="font-fredoka text-xs" style={{ color: '#0f0e17', background: isActive ? '#ffd93d' : '#6bcb77', borderRadius: '9999px', padding: '1px 6px' }}>
                      {i + 1}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {activeBlankId && (
            <div className="bg-[#1a1828] border border-[#3a3650] rounded-2xl px-5 py-4" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p className="font-fredoka text-[#c9c4e0] text-sm">
                Réponse pour le trou {(currentCard.blanks.findIndex(b => b.id === activeBlankId) + 1)}
              </p>
              <div className="flex gap-3 flex-wrap">
                <input
                  type="text"
                  value={answerInput}
                  onChange={e => setAnswerInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmitAnswer()}
                  autoFocus
                  placeholder="Tape ta réponse..."
                  className="flex-1 bg-[#0f0e17] border border-[#3a3650] rounded-xl px-4 py-3 text-[#eeeaf8] text-base outline-none focus:border-[#6bcb77]"
                  style={{ minWidth: '200px' }}
                />
                <button
                  onClick={handleSubmitAnswer}
                  disabled={!answerInput.trim()}
                  className="font-fredoka text-base rounded-xl px-6 py-3 hover:opacity-90 transition disabled:opacity-50"
                  style={{ background: '#6bcb77', color: '#0f0e17' }}
                >
                  Valider
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#827f97] text-xs">
                  {(attempts[activeBlankId] || 0) > 0 ? `${attempts[activeBlankId]} tentative${(attempts[activeBlankId] || 0) > 1 ? 's' : ''}` : ''}
                </span>
                <button onClick={handleReveal} className="font-fredoka text-xs text-[#827f97] hover:text-[#ff6b6b] transition">
                  Je ne sais pas — révéler la réponse
                </button>
              </div>
            </div>
          )}

          {cardFullyResolved && (
            <button
              onClick={handleCardSuivante}
              className="w-full rounded-2xl py-5 font-fredoka text-xl transition text-center hover:opacity-90"
              style={{ background: '#6bcb77', color: '#0f0e17' }}
            >
              {cardIndex + 1 >= cards.length ? 'Terminer la session →' : 'Carte suivante →'}
            </button>
          )}
        </div>

      </div>
    </main>
  )
}

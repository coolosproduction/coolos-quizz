'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '../../../../lib/supabase'
import { parseCloze } from '../../../../lib/cloze'
import BackButton from '@/components/BackButton'
import Skeleton from '@/components/Skeleton'
import Spinner from '@/components/Spinner'

type ClozeCard = { id: string, content: string }
type SelfEval = 'oui' | 'en_partie' | 'non'
type Phase = 'etude' | 'correction' | 'saving' | 'termine'

type BlankItem = {
  position: number       // position globale (1-indexée), utilisée aussi comme clé de tri/correction
  cardId: string
  cardIndex: number
  blankIndexInCard: number
  correctAnswer: string
  given: string
}

const evalConfig: Record<SelfEval, { label: string, color: string, bg: string, points: string }> = {
  oui: { label: 'Oui', color: '#6bcb77', bg: '#1a2e1f', points: '1 point' },
  en_partie: { label: 'En partie', color: '#ffd93d', bg: '#1f1e10', points: '0,5 point' },
  non: { label: 'Non', color: '#ff6b6b', bg: '#2e1a1a', points: '0 point' },
}
const pointsMap: Record<SelfEval, number> = { oui: 1, en_partie: 0.5, non: 0 }

export default function EtudierTrous() {
  const params = useParams()
  const router = useRouter()
  const setId = params.setId as string

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [setName, setSetName] = useState('')
  const [cards, setCards] = useState<ClozeCard[]>([])

  const [phase, setPhase] = useState<Phase>('etude')
  const [index, setIndex] = useState(0)
  const [blankInputs, setBlankInputs] = useState<Record<number, string>>({})
  const [blankList, setBlankList] = useState<BlankItem[]>([])
  const [blankPos, setBlankPos] = useState(0)

  const answersRef = useRef<Record<string, Record<number, string>>>({})
  const resultsRef = useRef<Record<number, SelfEval>>({})

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
        .from('revision_cloze_cards')
        .select('id, content')
        .eq('set_id', setId)
        .order('created_at', { ascending: true })

      if (!cardsData || cardsData.length === 0) { setNotFound(true); setLoading(false); return }

      setSetName(setData.name)
      setCards([...cardsData].sort(() => Math.random() - 0.5))
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId])

  useEffect(() => {
    setBlankInputs({})
  }, [index])

  const currentCard = cards[index] || null

  const buildBlankList = (): BlankItem[] => {
    const list: BlankItem[] = []
    let position = 0
    cards.forEach((card, cardIndex) => {
      parseCloze(card.content).forEach(seg => {
        if (seg.type === 'blank') {
          position++
          list.push({
            position,
            cardId: card.id,
            cardIndex,
            blankIndexInCard: seg.index,
            correctAnswer: seg.value,
            given: answersRef.current[card.id]?.[seg.index] || '',
          })
        }
      })
    })
    return list
  }

  const finishSession = async (finalList: BlankItem[], finalResults: Record<number, SelfEval>) => {
    setPhase('saving')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/connexion'); return }

    const score = finalList.reduce((acc, b) => acc + pointsMap[finalResults[b.position] || 'non'], 0)

    const { data: session, error: sessionError } = await supabase
      .from('revision_sessions')
      .insert({ set_id: setId, user_id: user.id, mode: 'trous', cards_count: cards.length, score })
      .select()
      .single()

    if (sessionError || !session) { setPhase('termine'); return }

    const rows = finalList.map(b => ({
      session_id: session.id,
      cloze_card_id: b.cardId,
      position: b.position,
      given_answer: b.given || null,
      correct_answer: b.correctAnswer,
      self_eval: finalResults[b.position] || 'non',
      answered_at: new Date().toISOString(),
    }))
    await supabase.from('revision_cloze_results').insert(rows)
    supabase.rpc('check_and_award_badges', { p_user_id: user.id }).then(() => {})

    setPhase('termine')
  }

  const handleBlankInputChange = (blankIndex: number, value: string) => {
    setBlankInputs(prev => ({ ...prev, [blankIndex]: value }))
  }

  const handleEtudeSuivant = () => {
    if (currentCard) answersRef.current[currentCard.id] = { ...blankInputs }
    if (index + 1 >= cards.length) {
      const list = buildBlankList()
      if (list.length === 0) {
        finishSession([], {})
        return
      }
      setBlankList(list)
      setBlankPos(0)
      setPhase('correction')
      return
    }
    setIndex(prev => prev + 1)
  }

  const handleCorrectionEval = (val: SelfEval) => {
    const current = blankList[blankPos]
    if (!current) return
    resultsRef.current[current.position] = val
    if (blankPos + 1 >= blankList.length) {
      finishSession(blankList, resultsRef.current)
      return
    }
    setBlankPos(prev => prev + 1)
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
          <Skeleton height={160} radius="16px" />
          <Skeleton height={64} radius="16px" />
        </div>
      </main>
    )
  }

  if (notFound) {
    return (
      <main className="min-h-screen bg-[#0f0e17] flex flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="font-fredoka text-[#ff6b6b] text-xl">Ce set est introuvable ou ne contient aucune carte à trous.</p>
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
    const totalBlanks = blankList.length
    const finalScore = blankList.reduce((acc, b) => acc + pointsMap[resultsRef.current[b.position] || 'non'], 0)
    const evals = blankList.map(b => resultsRef.current[b.position])
    const ouiCount = evals.filter(e => e === 'oui').length
    const enPartieCount = evals.filter(e => e === 'en_partie').length
    const nonCount = evals.filter(e => e === 'non').length

    return (
      <main className="min-h-screen bg-[#0f0e17]" style={{ padding: '32px 24px' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-8 text-center">
            <p className="font-fredoka text-[#9b96b8] text-sm uppercase tracking-widest mb-3">Session terminée</p>
            <h2 className="font-fredoka text-3xl text-[#eeeaf8] mb-2">{setName}</h2>
            <p className="font-fredoka text-5xl text-[#6bcb77] mb-2">{finalScore} <span className="text-2xl text-[#827f97]">/ {totalBlanks}</span></p>
            <p className="text-[#827f97] text-sm">Mode cartes à trous</p>
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

  // --- Phase étude ---
  if (phase === 'etude') {
    if (!currentCard) return null
    const segments = parseCloze(currentCard.content)
    return (
      <main className="min-h-screen bg-[#0f0e17]" style={{ padding: '32px 24px' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>

          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <BackButton />
              <span className="font-fredoka text-[#9b96b8] text-base">
                Étude <span className="text-[#eeeaf8]">{index + 1}</span> / {cards.length}
              </span>
            </div>
            <span className="bg-[#1e1c2e] border border-[#3a3650] rounded-full px-4 py-2 font-fredoka text-sm text-[#6bcb77]">
              {setName}
            </span>
          </div>

          <div className="w-full bg-[#1e1c2e] rounded-full" style={{ height: '6px' }}>
            <div
              className="rounded-full"
              style={{ height: '6px', width: `${((index + 1) / cards.length) * 100}%`, background: '#6bcb77', transition: 'width 0.3s' }}
            ></div>
          </div>

          <div key={`etude-${currentCard.id}`} className="coolos-card-transition" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl px-5 py-6">
              <p className="text-[#eeeaf8] text-lg" style={{ lineHeight: '2.4' }}>
                {segments.map((seg, i) => seg.type === 'text'
                  ? <span key={i}>{seg.value}</span>
                  : (
                    <input
                      key={i}
                      type="text"
                      value={blankInputs[seg.index] || ''}
                      onChange={e => handleBlankInputChange(seg.index, e.target.value)}
                      placeholder="..."
                      className="bg-[#0f0e17] text-[#6bcb77] text-center font-fredoka outline-none mx-1 px-2 py-1 rounded-lg"
                      style={{ border: '1px solid #3a3650', minWidth: '90px', width: `${Math.max(70, seg.value.length * 12)}px` }}
                    />
                  )
                )}
              </p>
            </div>
            <button
              onClick={handleEtudeSuivant}
              className="w-full rounded-2xl py-5 font-fredoka text-xl transition text-center hover:opacity-90"
              style={{ background: '#6bcb77', color: '#0f0e17' }}
            >
              {index + 1 >= cards.length ? 'Voir la correction →' : 'Carte suivante →'}
            </button>
          </div>

        </div>
      </main>
    )
  }

  // --- Phase correction ---
  const currentBlank = blankList[blankPos]
  if (!currentBlank) return null
  const correctionSegments = parseCloze(cards[currentBlank.cardIndex].content)

  return (
    <main className="min-h-screen bg-[#0f0e17]" style={{ padding: '32px 24px' }}>
      <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <BackButton />
            <span className="font-fredoka text-[#9b96b8] text-base">
              Correction <span className="text-[#eeeaf8]">{blankPos + 1}</span> / {blankList.length}
            </span>
          </div>
          <span className="bg-[#1e1c2e] border border-[#3a3650] rounded-full px-4 py-2 font-fredoka text-sm text-[#6bcb77]">
            {setName}
          </span>
        </div>

        <div className="w-full bg-[#1e1c2e] rounded-full" style={{ height: '6px' }}>
          <div
            className="rounded-full"
            style={{ height: '6px', width: `${((blankPos + 1) / blankList.length) * 100}%`, background: '#a78bfa', transition: 'width 0.3s' }}
          ></div>
        </div>

        <div key={`correction-${currentBlank.position}`} className="coolos-card-transition" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          <div className="bg-[#1e1c2e] border border-[#2a2830] rounded-2xl px-5 py-6">
            <p className="text-[#c9c4e0] text-lg" style={{ lineHeight: '2.4' }}>
              {correctionSegments.map((seg, i) => {
                if (seg.type === 'text') return <span key={i}>{seg.value}</span>
                const item = blankList.find(b => b.cardIndex === currentBlank.cardIndex && b.blankIndexInCard === seg.index)
                if (!item) return null
                if (item.position < currentBlank.position) {
                  return <span key={i} className="font-fredoka" style={{ color: '#6bcb77', fontWeight: 700 }}>{seg.value}</span>
                }
                if (item.position === currentBlank.position) {
                  return <span key={i} className="font-fredoka" style={{ color: '#ffd93d', fontWeight: 700, borderBottom: '2px solid #ffd93d' }}>▁▁▁▁▁</span>
                }
                return <span key={i} className="font-fredoka" style={{ color: '#4a4758' }}>▁▁▁▁▁</span>
              })}
            </p>
          </div>

          {currentBlank.given ? (
            <div className="bg-[#1e1c2e] border border-[#2a2830] rounded-2xl px-5 py-4">
              <p className="font-fredoka text-[#9b96b8] text-sm mb-2">Ta réponse</p>
              <p className="text-[#c9c4e0] text-base font-semibold">{currentBlank.given}</p>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-2" style={{ background: '#2e1a1a', border: '1px solid #ff6b6b', width: 'fit-content' }}>
              <div className="w-2 h-2 rounded-full bg-[#ff6b6b]"></div>
              <span className="font-fredoka text-[#ff6b6b] text-sm">Pas de réponse</span>
            </div>
          )}

          <div className="bg-[#1a2e1f] border border-[#1f3a28] rounded-2xl px-5 py-4">
            <p className="font-fredoka text-[#6bcb77] text-sm mb-2">La bonne réponse</p>
            <p className="text-[#eeeaf8] text-base font-semibold">{currentBlank.correctAnswer}</p>
          </div>

          <div>
            <p className="font-fredoka text-[#c9c4e0] text-lg mb-4">Tu avais bon ?</p>
            <div className="flex gap-4">
              {(Object.entries(evalConfig) as [SelfEval, typeof evalConfig[SelfEval]][]).map(([key, val]) => (
                <button
                  key={key}
                  onClick={() => handleCorrectionEval(key)}
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

      </div>
    </main>
  )
}

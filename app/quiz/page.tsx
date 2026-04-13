'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import { Suspense } from 'react'

type Question = {
  id: string
  question_text: string
  answer_text: string
  category: { name: string }
}

type ReponsePartie = {
  questionId: string
  question: string
  reponseOfficielle: string
  reponseUtilisateur: string
  category: string
  timedOut: boolean
}

function QuizContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [questions, setQuestions] = useState<Question[]>([])
  const [index, setIndex] = useState(0)
  const [reponse, setReponse] = useState('')
  const [timeLeft, setTimeLeft] = useState(20)
  const [loading, setLoading] = useState(true)
  const reponsesRef = useRef<ReponsePartie[]>([])
  const timerRef = useRef(20)
  const reponseRef = useRef('') // Ref pour capturer la réponse en temps réel

  const nb = parseInt(searchParams.get('nb') || '20')
  const timerDuration = parseInt(searchParams.get('timer') || '20')
  const categoriesParam = searchParams.get('categories') || ''
  const difficultiesParam = searchParams.get('difficulties') || ''

  const circumference = 2 * Math.PI * 22

  useEffect(() => {
    const loadQuestions = async () => {
      const supabase = createClient()
      const categoryIds = categoriesParam.split(',').filter(Boolean)
      const difficulties = difficultiesParam.split(',').filter(Boolean)

      let query = supabase
        .from('questions')
        .select('id, question_text, answer_text, category:categories(name)')
        .eq('active', true)

      if (categoryIds.length > 0) {
        query = query.in('category_id', categoryIds)
      }
      if (difficulties.length > 0) {
        query = query.in('difficulty', difficulties)
      }

      const { data } = await query
      if (data && data.length > 0) {
        const shuffled = data.sort(() => Math.random() - 0.5).slice(0, nb)
        setQuestions(shuffled as any)
      }
      setLoading(false)
      timerRef.current = timerDuration
      setTimeLeft(timerDuration)
    }
    loadQuestions()
  }, [])

  useEffect(() => {
    if (loading || questions.length === 0) return
    setTimeLeft(timerDuration)
    timerRef.current = timerDuration
    setReponse('')
    reponseRef.current = '' // Reset la ref aussi
  }, [index, loading])

  useEffect(() => {
    if (loading || questions.length === 0) return
    if (timeLeft <= 0) {
      handleNext(true)
      return
    }
    const interval = setInterval(() => {
      setTimeLeft(prev => prev - 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [timeLeft, loading, questions])

  const handleNext = (timedOut = false) => {
    if (questions.length === 0) return
    const q = questions[index]
    const nouvelleReponse: ReponsePartie = {
      questionId: q.id,
      question: q.question_text,
      reponseOfficielle: q.answer_text,
      reponseUtilisateur: reponseRef.current, // Toujours la vraie valeur, même si timedOut
      category: (q.category as any)?.name || '',
      timedOut,
    }
    reponsesRef.current = [...reponsesRef.current, nouvelleReponse]

    if (index + 1 >= questions.length) {
      sessionStorage.setItem('reponses_partie', JSON.stringify(reponsesRef.current))
      sessionStorage.setItem('timer_partie', timerDuration.toString())
      router.push('/correction')
      return
    }
    setIndex(prev => prev + 1)
    setReponse('')
    reponseRef.current = ''
  }

  const strokeDashoffset = circumference * (1 - timeLeft / timerDuration)
  const timerColor = timeLeft <= 5 ? '#ff6b6b' : '#ffd93d'
  const total = questions.length
  const question = questions[index]

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0f0e17] flex items-center justify-center">
        <p className="font-fredoka text-[#9b96b8] text-xl">Chargement des questions...</p>
      </main>
    )
  }

  if (questions.length === 0) {
    return (
      <main className="min-h-screen bg-[#0f0e17] flex flex-col items-center justify-center gap-6">
        <p className="font-fredoka text-[#ff6b6b] text-xl">Aucune question trouvée pour cette configuration.</p>
        <button
          onClick={() => router.push('/configuration')}
          className="bg-[#ffd93d] text-[#0f0e17] rounded-2xl py-3 px-8 font-fredoka text-lg"
        >
          Changer la configuration
        </button>
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
            <circle cx="28" cy="28" r="22" fill="none" stroke="#1e1c2e" strokeWidth="4"/>
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

        <div className="inline-flex items-center gap-2 bg-[#1e1c2e] border border-[#2a2830] rounded-full px-4 py-2" style={{ width: 'fit-content' }}>
          <div className="w-2 h-2 rounded-full bg-[#ff6b6b]"></div>
          <span className="font-fredoka text-[#9b96b8] text-sm">{(question.category as any)?.name}</span>
        </div>

        <h2 className="font-fredoka text-3xl text-[#eeeaf8] leading-tight">
          {question.question_text}
        </h2>

        <div>
          <label className="block font-fredoka text-[#9b96b8] text-base mb-3">Ta réponse</label>
          <textarea
            value={reponse}
            onChange={(e) => {
              setReponse(e.target.value)
              reponseRef.current = e.target.value // Sync la ref à chaque frappe
            }}
            placeholder="Écris ta réponse ici..."
            rows={4}
            className="w-full bg-[#1a1828] border border-[#3a3650] rounded-2xl px-5 py-4 text-[#eeeaf8] text-base outline-none resize-none"
            style={{ borderColor: reponse ? '#a78bfa' : '#3a3650' }}
          />
        </div>

        <button
          onClick={() => handleNext()}
          className="w-full rounded-2xl py-5 font-fredoka text-xl transition text-center"
          style={{
            background: reponse ? '#a78bfa' : '#2a2830',
            color: reponse ? '#0f0e17' : '#4a4760',
            cursor: reponse ? 'pointer' : 'not-allowed',
          }}
        >
          Question suivante →
        </button>

      </div>
    </main>
  )
}

export default function Quiz() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[#0f0e17] flex items-center justify-center">
        <p className="font-fredoka text-[#9b96b8] text-xl">Chargement...</p>
      </main>
    }>
      <QuizContent />
    </Suspense>
  )
}
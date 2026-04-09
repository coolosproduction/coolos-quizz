'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'

type ReponsePartie = {
  questionId: string
  question: string
  reponseOfficielle: string
  reponseUtilisateur: string
  category: string
  timedOut: boolean
}

type Eval = 'oui' | 'en_partie' | 'non' | null

const evalConfig = {
  oui: { label: 'Oui', color: '#6bcb77', bg: '#1a2e1f', points: '1 point' },
  en_partie: { label: 'En partie', color: '#ffd93d', bg: '#1f1e10', points: '0,5 point' },
  non: { label: 'Non', color: '#ff6b6b', bg: '#2e1a1a', points: '0 point' },
}

const pointsMap = { oui: 1, en_partie: 0.5, non: 0 }

export default function Correction() {
  const router = useRouter()
  const [questions, setQuestions] = useState<ReponsePartie[]>([])
  const [index, setIndex] = useState(0)
  const [evals, setEvals] = useState<Eval[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)

  useEffect(() => {
    const data = sessionStorage.getItem('reponses_partie')
    if (!data) {
      router.push('/configuration')
      return
    }
    const parsed = JSON.parse(data)
    setQuestions(parsed)
    setEvals(Array(parsed.length).fill(null))
    setLoading(false)
  }, [])

  const question = questions[index]
  const evalActuelle = evals[index]
  const total = questions.length

  const setEval = (val: Eval) => {
    const newEvals = [...evals]
    newEvals[index] = val
    setEvals(newEvals)
  }

  const handleNext = async () => {
    if (!evalActuelle) return
    if (savingRef.current) return

    if (index + 1 >= total) {
      savingRef.current = true
      setSaving(true)

      const finalEvals = [...evals]
      finalEvals[index] = evalActuelle
      const score = finalEvals.reduce((acc, e) => acc + (e ? pointsMap[e] : 0), 0)

      const resultats = {
        score,
        scoreMax: total,
        oui: finalEvals.filter(e => e === 'oui').length,
        enPartie: finalEvals.filter(e => e === 'en_partie').length,
        non: finalEvals.filter(e => e === 'non').length,
        questions: questions.map((q, i) => ({ ...q, eval: finalEvals[i] })),
      }

      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        const timerData = sessionStorage.getItem('timer_partie')

        if (user) {
          const { data: game } = await supabase
            .from('games')
            .insert({
              user_id: user.id,
              score,
              score_max: total,
              questions_count: total,
              timer_duration: timerData ? parseInt(timerData) : 20,
            })
            .select()
            .single()

          if (game) {
            const answers = questions.map((q, i) => ({
              game_id: game.id,
              question_id: q.questionId,
              user_answer: q.reponseUtilisateur,
              self_eval: finalEvals[i],
              points: finalEvals[i] ? pointsMap[finalEvals[i] as keyof typeof pointsMap] : 0,
              position: i + 1,
              timed_out: q.timedOut,
            }))
            await supabase.from('game_answers').insert(answers)
          }
        }
      } catch (e) {
        console.error('Erreur sauvegarde:', e)
      }

      sessionStorage.setItem('resultats_partie', JSON.stringify(resultats))
      sessionStorage.removeItem('reponses_partie')
      sessionStorage.removeItem('timer_partie')
      router.push('/resultats')
      return
    }
    setIndex(prev => prev + 1)
  }

  if (loading || !question) {
    return (
      <main className="min-h-screen bg-[#0f0e17] flex items-center justify-center">
        <p className="font-fredoka text-[#9b96b8] text-xl">Chargement...</p>
      </main>
    )
  }

  if (saving) {
    return (
      <main className="min-h-screen bg-[#0f0e17] flex items-center justify-center">
        <p className="font-fredoka text-[#9b96b8] text-xl">Sauvegarde en cours...</p>
      </main>
    )
  }

  const btnNextLabel = index + 1 >= total ? 'Voir mes résultats →' : 'Continuer →'

  return (
    <main className="min-h-screen bg-[#0f0e17]" style={{ padding: '32px 24px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>

        <div className="flex justify-between items-center">
          <span className="font-fredoka text-[#9b96b8] text-base">
            Correction <span className="text-[#eeeaf8]">{index + 1}</span> / {total}
          </span>
          <span className="bg-[#1e1c2e] border border-[#3a3650] rounded-full px-4 py-2 font-fredoka text-sm text-[#a78bfa]">
            Phase de correction
          </span>
        </div>

        <div className="w-full bg-[#1e1c2e] rounded-full" style={{ height: '6px' }}>
          <div
            className="rounded-full"
            style={{ height: '6px', width: `${((index + 1) / total) * 100}%`, background: '#a78bfa', transition: 'width 0.3s' }}
          ></div>
        </div>

        <div className="inline-flex items-center gap-2 bg-[#1e1c2e] border border-[#2a2830] rounded-full px-4 py-2" style={{ width: 'fit-content' }}>
          <div className="w-2 h-2 rounded-full bg-[#ff6b6b]"></div>
          <span className="font-fredoka text-[#9b96b8] text-sm">{question.category}</span>
        </div>

        <h2 className="font-fredoka text-3xl text-[#eeeaf8] leading-tight">
          {question.question}
        </h2>

        <div className="bg-[#1a2e1f] border border-[#1f3a28] rounded-2xl px-5 py-4">
          <p className="font-fredoka text-[#6bcb77] text-sm mb-2">La bonne réponse</p>
          <p className="text-[#eeeaf8] text-base font-semibold">{question.reponseOfficielle}</p>
        </div>

        {question.timedOut ? (
          <div className="inline-flex items-center gap-2 bg-[#2e1a1a] border border-[#ff6b6b] rounded-full px-4 py-2" style={{ width: 'fit-content' }}>
            <div className="w-2 h-2 rounded-full bg-[#ff6b6b]"></div>
            <span className="font-fredoka text-[#ff6b6b] text-sm">Temps écoulé — pas de réponse</span>
          </div>
        ) : (
          <div className="bg-[#1e1c2e] border border-[#2a2830] rounded-2xl px-5 py-4">
            <p className="font-fredoka text-[#9b96b8] text-sm mb-2">Ta réponse</p>
            <p className="text-[#c9c4e0] text-base font-semibold">{question.reponseUtilisateur}</p>
          </div>
        )}

        <div>
          <p className="font-fredoka text-[#c9c4e0] text-lg mb-4">Tu as eu bon ?</p>
          <div className="flex gap-4">
            {(Object.entries(evalConfig) as [Eval, typeof evalConfig[keyof typeof evalConfig]][]).map(([key, val]) => (
              <button
                key={key}
                onClick={() => setEval(key)}
                className="flex-1 rounded-xl py-4 font-fredoka text-base"
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
          onClick={handleNext}
          disabled={saving}
          className="w-full rounded-2xl py-5 font-fredoka text-xl transition text-center"
          style={{
            background: evalActuelle ? (evalActuelle === 'oui' ? '#6bcb77' : evalActuelle === 'en_partie' ? '#ffd93d' : '#ff6b6b') : '#2a2830',
            color: evalActuelle ? '#0f0e17' : '#4a4760',
            cursor: evalActuelle ? 'pointer' : 'not-allowed',
          }}
        >
          {btnNextLabel}
        </button>

      </div>
    </main>
  )
}
'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'

type Question = {
  question: string
  reponseOfficielle: string
  reponseUtilisateur: string
  eval: string
}

type Partie = {
  id: string
  score: number
  scoreMax: number
  nbQuestions: number
  timer: number
  oui: number
  enPartie: number
  non: number
  date: string
  questions: Question[]
}

const evalConfig = {
  oui: { label: 'Oui', color: '#6bcb77', bg: '#1a2e1f' },
  en_partie: { label: 'En partie', color: '#ffd93d', bg: '#1f1e10' },
  non: { label: 'Non', color: '#ff6b6b', bg: '#2e1a1a' },
}

const themeColors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4ecdc4', '#a78bfa', '#ff9f43']

export default function Historique() {
  const [parties, setParties] = useState<Partie[]>([])
  const [loading, setLoading] = useState(true)
  const [ouvert, setOuvert] = useState<string | null>(null)

  useEffect(() => {
    const loadHistorique = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const { data: games } = await supabase
        .from('games')
        .select('*')
        .eq('user_id', user.id)
        .order('played_at', { ascending: false })

      if (!games) {
        setLoading(false)
        return
      }

      const partiesAvecReponses = await Promise.all(games.map(async (game) => {
        const { data: answers } = await supabase
          .from('game_answers')
          .select('*, question:questions(question_text, answer_text)')
          .eq('game_id', game.id)
          .order('position', { ascending: true })

        const questions: Question[] = (answers || []).map((a: any) => ({
          question: a.question?.question_text || '',
          reponseOfficielle: a.question?.answer_text || '',
          reponseUtilisateur: a.user_answer || '',
          eval: a.self_eval || 'non',
        }))

        const date = new Date(game.played_at)
        const now = new Date()
        const diff = now.getTime() - date.getTime()
        const jours = Math.floor(diff / (1000 * 60 * 60 * 24))
        let dateStr = ''
        if (jours === 0) dateStr = `Aujourd'hui à ${date.getHours()}h${String(date.getMinutes()).padStart(2, '0')}`
        else if (jours === 1) dateStr = `Hier à ${date.getHours()}h${String(date.getMinutes()).padStart(2, '0')}`
        else dateStr = `${date.toLocaleDateString('fr-FR')} à ${date.getHours()}h${String(date.getMinutes()).padStart(2, '0')}`

        return {
          id: game.id,
          score: game.score,
          scoreMax: game.score_max,
          nbQuestions: game.questions_count,
          timer: game.timer_duration,
          oui: questions.filter(q => q.eval === 'oui').length,
          enPartie: questions.filter(q => q.eval === 'en_partie').length,
          non: questions.filter(q => q.eval === 'non').length,
          date: dateStr,
          questions,
        }
      }))

      setParties(partiesAvecReponses)
      setLoading(false)
    }
    loadHistorique()
  }, [])

  const totalQuestions = parties.reduce((acc, p) => acc + p.nbQuestions, 0)
  const tauxReussite = parties.length === 0 ? 0 : Math.round(
    (parties.reduce((acc, p) => acc + p.score, 0) /
    parties.reduce((acc, p) => acc + p.scoreMax, 0)) * 100
  )
  const scoreMoyen = parties.length === 0 ? '0.0' : (
    parties.reduce((acc, p) => acc + p.score / p.scoreMax * 20, 0) / parties.length
  ).toFixed(1)

  const getScoreColor = (score: number, max: number) => {
    const pct = score / max
    if (pct >= 0.8) return '#6bcb77'
    if (pct >= 0.5) return '#ffd93d'
    return '#ff6b6b'
  }

  const toggleOuvert = (id: string) => {
    setOuvert(prev => prev === id ? null : id)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0f0e17] flex items-center justify-center">
        <p className="font-fredoka text-[#9b96b8] text-xl">Chargement...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#0f0e17]" style={{ padding: '32px 24px' }}>

      <nav className="flex justify-between items-center" style={{ maxWidth: '900px', margin: '0 auto 40px' }}>
        <Link href="/" className="font-fredoka text-2xl">
          <span className="text-[#ff6b6b]">C</span>
          <span className="text-[#ff9f43]">o</span>
          <span className="text-[#ffd93d]">o</span>
          <span className="text-[#6bcb77]">l</span>
          <span className="text-[#4ecdc4]">o</span>
          <span className="text-[#a78bfa]">s</span>
          <span className="text-[#c9c4e0]"> Quiz</span>
        </Link>
        <Link href="/profil" className="w-10 h-10 rounded-full bg-[#2a1f3d] border-2 border-[#a78bfa] flex items-center justify-center cursor-pointer">
          <div className="w-5 h-5 rounded-full bg-[#a78bfa]"></div>
        </Link>
      </nav>

      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>

        <div>
          <h2 className="font-fredoka text-4xl text-[#eeeaf8] mb-2">Mon historique</h2>
          <p className="text-[#9b96b8] text-base">Toutes tes parties enregistrées</p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-5 text-center">
            <div className="font-fredoka text-3xl text-[#ffd93d] mb-1">{totalQuestions}</div>
            <div className="text-[#6b6880] text-sm">Questions répondues</div>
          </div>
          <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-5 text-center">
            <div className="font-fredoka text-3xl text-[#6bcb77] mb-1">{tauxReussite}%</div>
            <div className="text-[#6b6880] text-sm">Taux de réussite</div>
          </div>
          <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-5 text-center">
            <div className="font-fredoka text-3xl text-[#4ecdc4] mb-1">{scoreMoyen}</div>
            <div className="text-[#6b6880] text-sm">Score moyen</div>
          </div>
        </div>

        {parties.length === 0 ? (
          <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-10 text-center">
            <p className="font-fredoka text-[#9b96b8] text-xl mb-2">Aucune partie pour l'instant</p>
            <p className="text-[#6b6880] text-sm mb-6">Lance ton premier quiz pour voir ton historique ici !</p>
            <Link href="/configuration" className="bg-[#ffd93d] text-[#0f0e17] rounded-2xl px-8 py-3 font-fredoka text-base hover:opacity-90 transition">
              Jouer maintenant
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {parties.map((p, idx) => (
              <div
                key={p.id}
                className="bg-[#1a1828] border rounded-2xl"
                style={{ borderColor: ouvert === p.id ? '#a78bfa' : '#2a2830', padding: '10px 15px' }}
              >
                <div className="cursor-pointer" onClick={() => toggleOuvert(p.id)}>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: themeColors[idx % themeColors.length] }}></div>
                      <span className="font-fredoka text-[#eeeaf8] text-lg">{p.nbQuestions} questions</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="font-fredoka text-2xl" style={{ color: getScoreColor(p.score, p.scoreMax) }}>{p.score}</span>
                        <span className="font-fredoka text-sm text-[#6b6880]"> / {p.scoreMax}</span>
                      </div>
                      <div style={{ transform: ouvert === p.id ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s' }}>
                        <div className="w-0 h-0 border-l-4 border-r-4 border-t-8 border-l-transparent border-r-transparent border-t-[#9b96b8]"></div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap mb-3">
                    <span className="bg-[#0f0e17] rounded-full px-3 py-1 font-fredoka text-xs text-[#9b96b8]">{p.nbQuestions} questions</span>
                    <span className="bg-[#0f0e17] rounded-full px-3 py-1 font-fredoka text-xs text-[#9b96b8]">{p.timer}s / q.</span>
                  </div>
                  <div className="flex h-2 rounded-full overflow-hidden gap-0.5 mb-2">
                    <div style={{ width: `${(p.oui / p.nbQuestions) * 100}%`, background: '#6bcb77', borderRadius: '4px 0 0 4px' }}></div>
                    <div style={{ width: `${(p.enPartie / p.nbQuestions) * 100}%`, background: '#ffd93d' }}></div>
                    <div style={{ width: `${(p.non / p.nbQuestions) * 100}%`, background: '#ff6b6b', borderRadius: '0 4px 4px 0' }}></div>
                  </div>
                  <div className="text-[#4a4760] text-xs font-semibold" style={{ marginTop: '3px' }}>{p.date}</div>
                </div>

                {ouvert === p.id && (
                  <div style={{ marginTop: '16px', borderTop: '1px solid #2a2830', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {p.questions.map((q, i) => {
                      const e = evalConfig[q.eval as keyof typeof evalConfig] || evalConfig.non
                      return (
                        <div key={i} className="rounded-xl" style={{ background: '#0f0e17', padding: '14px 16px' }}>
                          <div className="flex justify-between items-start mb-3">
                            <span className="font-fredoka text-[#9b96b8] text-xs">Question {i + 1}</span>
                            <span className="rounded-full px-3 py-1 font-fredoka text-xs" style={{ background: e.bg, color: e.color, border: `1px solid ${e.color}` }}>
                              {e.label}
                            </span>
                          </div>
                          <p className="text-[#eeeaf8] text-sm font-semibold mb-3">{q.question}</p>
                          <div className="rounded-lg p-3 mb-2" style={{ background: '#1a2e1f' }}>
                            <p className="font-fredoka text-[#6bcb77] text-xs mb-1">Bonne réponse</p>
                            <p className="text-[#eeeaf8] text-sm">{q.reponseOfficielle}</p>
                          </div>
                          {q.reponseUtilisateur ? (
                            <div className="rounded-lg p-3" style={{ background: '#1e1c2e' }}>
                              <p className="font-fredoka text-[#9b96b8] text-xs mb-1">Ta réponse</p>
                              <p className="text-[#c9c4e0] text-sm">{q.reponseUtilisateur}</p>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1" style={{ background: '#2e1a1a', border: '1px solid #ff6b6b' }}>
                              <div className="w-2 h-2 rounded-full bg-[#ff6b6b]"></div>
                              <span className="font-fredoka text-[#ff6b6b] text-xs">Temps écoulé</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      </div>
    </main>
  )
}
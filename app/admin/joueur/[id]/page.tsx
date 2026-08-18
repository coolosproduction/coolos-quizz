'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '../../../../lib/supabase'
import Avatar from '@/components/Avatar'
import BackButton from '@/components/BackButton'

type Question = {
  question: string
  reponseOfficielle: string
  reponseUtilisateur: string
  eval: string
  categorie: string
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

type Joueur = {
  id: string
  pseudo: string
  email: string
  avatar_url: string | null
  role: string
  statut: string
  suspendu_jusqu_au: string | null
  created_at: string
}

const evalConfig = {
  oui: { label: 'Oui', color: '#6bcb77', bg: '#1a2e1f' },
  en_partie: { label: 'En partie', color: '#ffd93d', bg: '#1f1e10' },
  non: { label: 'Non', color: '#ff6b6b', bg: '#2e1a1a' },
}

const themeColors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4ecdc4', '#a78bfa', '#ff9f43']

export default function AdminJoueurDetail() {
  const router = useRouter()
  const params = useParams()
  const targetId = params.id as string

  const [authorized, setAuthorized] = useState(false)
  const [checking, setChecking] = useState(true)
  const [joueur, setJoueur] = useState<Joueur | null>(null)
  const [parties, setParties] = useState<Partie[]>([])
  const [loading, setLoading] = useState(true)
  const [ouvert, setOuvert] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const checkAdmin = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/connexion'); return }

      const { data } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      if (data?.role !== 'admin') { router.push('/'); return }
      setAuthorized(true)
      setChecking(false)
      loadJoueur()
    }
    checkAdmin()
  }, [])

  const loadJoueur = async () => {
    const supabase = createClient()

    const { data: userData } = await supabase
      .from('users')
      .select('id, pseudo, email, avatar_url, role, statut, suspendu_jusqu_au, created_at')
      .eq('id', targetId)
      .single()

    if (!userData) {
      setNotFound(true)
      setLoading(false)
      return
    }

    setJoueur(userData as Joueur)

    const { data: games } = await supabase
      .from('games')
      .select('*')
      .eq('user_id', targetId)
      .order('played_at', { ascending: false })

    if (!games) {
      setLoading(false)
      return
    }

    const partiesAvecReponses = await Promise.all(games.map(async (game) => {
      const { data: answers } = await supabase
        .from('game_answers')
        .select('*, question:questions(question_text, answer_text, categories(name))')
        .eq('game_id', game.id)
        .order('position', { ascending: true })

      const questions: Question[] = (answers || []).map((a: any) => ({
        question: a.question?.question_text || '',
        reponseOfficielle: a.question?.answer_text || '',
        reponseUtilisateur: a.user_answer || '',
        eval: a.self_eval || 'non',
        categorie: a.question?.categories?.name || 'Autre',
      }))

      const date = new Date(game.played_at)
      const dateStr = `${date.toLocaleDateString('fr-FR')} à ${date.getHours()}h${String(date.getMinutes()).padStart(2, '0')}`

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

  const toggleOuvert = (id: string) => {
    setOuvert(prev => prev === id ? null : id)
  }

  const getScoreColor = (score: number, max: number) => {
    if (max === 0) return '#9b96b8'
    const pct = score / max
    if (pct >= 0.8) return '#6bcb77'
    if (pct >= 0.5) return '#ffd93d'
    return '#ff6b6b'
  }

  const totalQuestions = parties.reduce((acc, p) => acc + p.nbQuestions, 0)
  const totalScore = parties.reduce((acc, p) => acc + p.score, 0)
  const totalScoreMax = parties.reduce((acc, p) => acc + p.scoreMax, 0)
  const tauxReussite = totalScoreMax > 0 ? Math.round((totalScore / totalScoreMax) * 100) : 0

  if (checking || (loading && !notFound)) {
    return (
      <main className="min-h-screen bg-[#0f0e17] flex items-center justify-center">
        <p className="font-fredoka text-[#9b96b8] text-xl">Chargement...</p>
      </main>
    )
  }

  if (!authorized) return null

  if (notFound || !joueur) {
    return (
      <main className="min-h-screen bg-[#0f0e17] flex flex-col items-center justify-center gap-4">
        <p className="font-fredoka text-[#9b96b8] text-xl">Joueur introuvable.</p>
        <Link href="/admin" className="font-fredoka text-sm text-[#a78bfa]">← Retour à l'admin</Link>
      </main>
    )
  }

  const badge = joueur.statut === 'banni'
    ? { label: 'Banni', color: '#ff6b6b', bg: '#2e1a1a' }
    : joueur.statut === 'suspendu' && joueur.suspendu_jusqu_au && new Date(joueur.suspendu_jusqu_au) > new Date()
      ? { label: 'Suspendu', color: '#ff9f43', bg: '#2d1f10' }
      : null

  return (
    <main className="min-h-screen bg-[#0f0e17]" style={{ padding: '32px 24px' }}>

      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        <Link href="/admin" className="font-fredoka text-sm text-[#a78bfa] hover:opacity-80 transition">
          ← Retour à l'admin
        </Link>

        <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl" style={{ padding: '24px' }}>
          <div className="flex items-center gap-5 flex-wrap">
            <BackButton />
            <Avatar url={joueur.avatar_url} size={64} border="accent" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-fredoka text-2xl text-[#eeeaf8]">{joueur.pseudo}</h1>
                {joueur.role === 'admin' && (
                  <span className="font-fredoka text-xs rounded-full px-2 py-0.5" style={{ background: '#2a1f3d', color: '#a78bfa' }}>Admin</span>
                )}
                {badge && (
                  <span className="font-fredoka text-xs rounded-full px-2 py-0.5" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
                )}
              </div>
              <p className="text-[#6b6880] text-sm">{joueur.email}</p>
              <p className="text-[#4a4760] text-xs" style={{ marginTop: '4px' }}>
                Inscrit le {new Date(joueur.created_at).toLocaleDateString('fr-FR')} · ID {joueur.id}
              </p>
            </div>
          </div>
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
            <div className="font-fredoka text-3xl text-[#4ecdc4] mb-1">{parties.length}</div>
            <div className="text-[#6b6880] text-sm">Parties jouées</div>
          </div>
        </div>

        <p className="text-[#6b6880] text-xs" style={{ marginTop: '-8px' }}>
          Historique détaillé — visible uniquement par les administrateurs, pour vérifier la cohérence des auto-évaluations.
        </p>

        {parties.length === 0 ? (
          <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-10 text-center">
            <p className="font-fredoka text-[#9b96b8] text-xl">Ce joueur n'a encore joué aucune partie.</p>
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
                    <div style={{ width: `${p.nbQuestions > 0 ? (p.oui / p.nbQuestions) * 100 : 0}%`, background: '#6bcb77', borderRadius: '4px 0 0 4px' }}></div>
                    <div style={{ width: `${p.nbQuestions > 0 ? (p.enPartie / p.nbQuestions) * 100 : 0}%`, background: '#ffd93d' }}></div>
                    <div style={{ width: `${p.nbQuestions > 0 ? (p.non / p.nbQuestions) * 100 : 0}%`, background: '#ff6b6b', borderRadius: '0 4px 4px 0' }}></div>
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
                            <span className="font-fredoka text-[#9b96b8] text-xs">Question {i + 1} · {q.categorie}</span>
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
                              <p className="font-fredoka text-[#9b96b8] text-xs mb-1">Réponse du joueur</p>
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

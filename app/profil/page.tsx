'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'

type Stats = {
  pseudo: string
  depuis: string
  totalQuestions: number
  tauxReussite: number
  totalParties: number
  oui: number
  enPartie: number
  non: number
}

export default function Profil() {
  const router = useRouter()
  const [onglet, setOnglet] = useState<'stats' | 'categories'>('stats')
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadStats = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/connexion')
        return
      }

      const { data: games } = await supabase
        .from('games')
        .select('*')
        .eq('user_id', user.id)

      const { data: answers } = await supabase
        .from('game_answers')
        .select('self_eval, game:games!inner(user_id)')
        .eq('game.user_id', user.id)

      const totalQuestions = games?.reduce((acc, g) => acc + g.questions_count, 0) || 0
      const totalParties = games?.length || 0
      const totalScore = games?.reduce((acc, g) => acc + g.score, 0) || 0
      const totalScoreMax = games?.reduce((acc, g) => acc + g.score_max, 0) || 0
      const tauxReussite = totalScoreMax > 0 ? Math.round((totalScore / totalScoreMax) * 100) : 0

      const totalAnswers = answers?.length || 0
      const ouiCount = answers?.filter(a => a.self_eval === 'oui').length || 0
      const enPartieCount = answers?.filter(a => a.self_eval === 'en_partie').length || 0
      const nonCount = answers?.filter(a => a.self_eval === 'non').length || 0

      const ouiPct = totalAnswers > 0 ? Math.round((ouiCount / totalAnswers) * 100) : 0
      const enPartiePct = totalAnswers > 0 ? Math.round((enPartieCount / totalAnswers) * 100) : 0
      const nonPct = totalAnswers > 0 ? Math.round((nonCount / totalAnswers) * 100) : 0

      const createdAt = new Date(user.created_at)
      const depuis = createdAt.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

      const pseudo = user.user_metadata?.pseudo || user.email?.split('@')[0] || 'Joueur'

      setStats({
        pseudo,
        depuis,
        totalQuestions,
        tauxReussite,
        totalParties,
        oui: ouiPct,
        enPartie: enPartiePct,
        non: nonPct,
      })
      setLoading(false)
    }
    loadStats()
  }, [])

  const handleDeconnexion = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0f0e17] flex items-center justify-center">
        <p className="font-fredoka text-[#9b96b8] text-xl">Chargement...</p>
      </main>
    )
  }

  if (!stats) return null

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
      </nav>

      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>

        {/* Header profil */}
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-[#2a1f3d] flex items-center justify-center" style={{ border: '3px solid #a78bfa' }}>
              <div className="w-10 h-10 rounded-full bg-[#a78bfa]"></div>
            </div>
          </div>
          <div>
            <h2 className="font-fredoka text-3xl text-[#eeeaf8]">{stats.pseudo}</h2>
            <p className="text-[#6b6880] text-sm">Membre depuis {stats.depuis}</p>
            <div className="flex gap-2 mt-2">
              <button className="border border-[#3a3650] text-[#9b96b8] rounded-full px-4 py-1 font-fredoka text-sm hover:bg-[#1e1c2e] transition">
                Modifier le profil
              </button>
            </div>
          </div>
        </div>

        {/* Onglets */}
        <div className="flex bg-[#1a1828] rounded-xl p-1 gap-1">
          <button
            onClick={() => setOnglet('stats')}
            className="flex-1 text-center font-fredoka text-sm py-3 rounded-lg"
            style={{ background: onglet === 'stats' ? '#0f0e17' : 'transparent', color: onglet === 'stats' ? '#eeeaf8' : '#9b96b8' }}
          >
            Statistiques
          </button>
          <button
            onClick={() => setOnglet('categories')}
            className="flex-1 text-center font-fredoka text-sm py-3 rounded-lg"
            style={{ background: onglet === 'categories' ? '#0f0e17' : 'transparent', color: onglet === 'categories' ? '#eeeaf8' : '#9b96b8' }}
          >
            Par catégorie
          </button>
        </div>

        {/* Panel stats globales */}
        {onglet === 'stats' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-5 text-center">
                <div className="font-fredoka text-3xl text-[#ffd93d] mb-1">{stats.totalQuestions}</div>
                <div className="text-[#6b6880] text-sm">Questions</div>
              </div>
              <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-5 text-center">
                <div className="font-fredoka text-3xl text-[#6bcb77] mb-1">{stats.tauxReussite}%</div>
                <div className="text-[#6b6880] text-sm">Réussite</div>
              </div>
              <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-5 text-center">
                <div className="font-fredoka text-3xl text-[#4ecdc4] mb-1">{stats.totalParties}</div>
                <div className="text-[#6b6880] text-sm">Parties</div>
              </div>
            </div>

            <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl" style={{ padding: '10px 15px' }}>
              <p className="font-fredoka text-[#c9c4e0] text-lg mb-5">Répartition des réponses</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-[#6bcb77] flex-shrink-0"></div>
                  <span className="font-fredoka text-[#6bcb77] text-sm w-20">Oui</span>
                  <div className="flex-1 bg-[#0f0e17] rounded-full" style={{ height: '8px' }}>
                    <div className="rounded-full bg-[#6bcb77]" style={{ height: '8px', width: `${stats.oui}%` }}></div>
                  </div>
                  <span className="font-fredoka text-[#6bcb77] text-sm w-12 text-right">{stats.oui}%</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-[#ffd93d] flex-shrink-0"></div>
                  <span className="font-fredoka text-[#ffd93d] text-sm w-20">En partie</span>
                  <div className="flex-1 bg-[#0f0e17] rounded-full" style={{ height: '8px' }}>
                    <div className="rounded-full bg-[#ffd93d]" style={{ height: '8px', width: `${stats.enPartie}%` }}></div>
                  </div>
                  <span className="font-fredoka text-[#ffd93d] text-sm w-12 text-right">{stats.enPartie}%</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-[#ff6b6b] flex-shrink-0"></div>
                  <span className="font-fredoka text-[#ff6b6b] text-sm w-20">Non</span>
                  <div className="flex-1 bg-[#0f0e17] rounded-full" style={{ height: '8px' }}>
                    <div className="rounded-full bg-[#ff6b6b]" style={{ height: '8px', width: `${stats.non}%` }}></div>
                  </div>
                  <span className="font-fredoka text-[#ff6b6b] text-sm w-12 text-right">{stats.non}%</span>
                </div>
              </div>
            </div>

            <Link href="/configuration" className="block w-full bg-[#ffd93d] text-[#0f0e17] rounded-2xl py-4 font-fredoka text-lg text-center hover:opacity-90 transition">
  Lancer un quiz !
</Link>
            
            <Link href="/historique" className="block w-full border rounded-2xl py-4 font-fredoka text-lg text-center hover:bg-[#1f1e10] transition" style={{ borderColor: '#ffd93d', color: '#ffd93d' }}>
              Voir mon historique →
            </Link>
          </div>
        )}

        {/* Panel par catégorie — données de test pour l'instant */}
        {onglet === 'categories' && (
          <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-10 text-center">
            <p className="font-fredoka text-[#9b96b8] text-xl mb-2">Bientôt disponible</p>
            <p className="text-[#6b6880] text-sm">Les stats par catégorie arrivent prochainement.</p>
          </div>
        )}

        {/* Déconnexion */}
        <div style={{ borderTop: '1px solid #1e1c2e', paddingTop: '24px' }}>
          <button
            onClick={handleDeconnexion}
            className="w-full border rounded-2xl py-4 font-fredoka text-lg hover:bg-[#2e1a1a] transition"
            style={{ borderColor: '#2e1a1a', color: '#ff6b6b' }}
          >
            Se déconnecter
          </button>
        </div>

      </div>
    </main>
  )
}
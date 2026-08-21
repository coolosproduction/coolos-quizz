'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import Avatar from '@/components/Avatar'
import BackButton from '@/components/BackButton'
import RoleBadge from '@/components/RoleBadge'
import LineChartScore, { ScorePoint } from '@/components/charts/LineChartScore'
import BarList from '@/components/charts/BarList'
import StatRing from '@/components/charts/StatRing'
import Skeleton, { SkeletonRow } from '@/components/Skeleton'

type Stats = {
  pseudo: string
  avatarUrl: string | null
  role: string | null
  isPremium: boolean | null
  stripeCustomerId: string | null
  depuis: string
  totalQuestions: number
  tauxReussite: number
  totalParties: number
  oui: number
  enPartie: number
  non: number
}

type StatCategorie = {
  nom: string
  total: number
  oui: number
  enPartie: number
  non: number
  taux: number
}

type Notification = {
  id: string
  titre: string
  contenu: string
  lu: boolean
  created_at: string
  type: 'coolos' | 'room_invite'
  action_url: string | null
}

type Category = { id: string, name: string }

const DIFFICULTES = [
  { key: 'facile', label: 'Facile', color: '#6bcb77' },
  { key: 'moyen', label: 'Moyen', color: '#ffd93d' },
  { key: 'difficile', label: 'Difficile', color: '#ff6b6b' },
  { key: 'hardcore', label: 'Hardcore', color: '#a78bfa' },
]

const performanceColor = (rate: number) => (rate >= 70 ? '#6bcb77' : rate >= 40 ? '#ffd93d' : '#ff6b6b')

type PremiumStats = {
  scoreEvolution: ScorePoint[]
  difficulty: { key: string, label: string, color: string, successRate: number, questionsPlayed: number, correctAnswers: number }[]
  subcategories: { id: string, label: string, successRate: number, questionsPlayed: number, correctAnswers: number }[]
  percentile: { rank: number, totalPlayers: number, topPercent: number } | null
  multiplayer: { gamesPlayed: number, gamesWon: number, winRate: number } | null
  questionFrequency: { distinctQuestions: number, totalAnswers: number, mostFrequentText: string | null, mostFrequentCount: number } | null
}

export default function Profil() {
  const router = useRouter()
  const [onglet, setOnglet] = useState<'stats' | 'categories' | 'messages' | 'premium'>('stats')
  const [stats, setStats] = useState<Stats | null>(null)
  const [statsCategories, setStatsCategories] = useState<StatCategorie[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [nbNonLus, setNbNonLus] = useState(0)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [premiumStats, setPremiumStats] = useState<PremiumStats | null>(null)
  const [premiumLoading, setPremiumLoading] = useState(false)
  const [premiumLoaded, setPremiumLoaded] = useState(false)
  const [categoriesList, setCategoriesList] = useState<Category[]>([])
  const [percentileCategory, setPercentileCategory] = useState<string>('')
  const [portalLoading, setPortalLoading] = useState(false)

  const ouvrirPortailAbonnement = async () => {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/stripe/create-portal-session', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setPortalLoading(false)
      }
    } catch {
      setPortalLoading(false)
    }
  }

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
      const avatarUrl = user.user_metadata?.avatar_url || null

      setUserId(user.id)

      const { data: roleData } = await supabase
        .from('users')
        .select('role, is_premium, stripe_customer_id')
        .eq('id', user.id)
        .single()

      setStats({
        pseudo,
        avatarUrl,
        role: roleData?.role ?? null,
        isPremium: roleData?.is_premium ?? null,
        stripeCustomerId: roleData?.stripe_customer_id ?? null,
        depuis,
        totalQuestions,
        tauxReussite,
        totalParties,
        oui: ouiPct,
        enPartie: enPartiePct,
        non: nonPct,
      })

      // Stats par catégorie
      const gameIds = games?.map(g => g.id) || []
      if (gameIds.length > 0) {
        const { data: answersWithCat } = await supabase
          .from('game_answers')
          .select('self_eval, question:questions!inner(categories(name))')
          .in('game_id', gameIds)

        if (answersWithCat) {
          const catMap: Record<string, { total: number, oui: number, enPartie: number, non: number }> = {}
          answersWithCat.forEach((a: any) => {
            const nom = a.question?.categories?.name || 'Autre'
            if (!catMap[nom]) catMap[nom] = { total: 0, oui: 0, enPartie: 0, non: 0 }
            catMap[nom].total++
            if (a.self_eval === 'oui') catMap[nom].oui++
            else if (a.self_eval === 'en_partie') catMap[nom].enPartie++
            else if (a.self_eval === 'non') catMap[nom].non++
          })
          const result = Object.entries(catMap).map(([nom, v]) => ({
            nom,
            total: v.total,
            oui: v.oui,
            enPartie: v.enPartie,
            non: v.non,
            taux: v.total > 0 ? Math.round((v.oui / v.total) * 100) : 0,
          })).sort((a, b) => b.total - a.total)
          setStatsCategories(result)
        }
      }

      // Notifications
      const { data: notifs } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (notifs) {
        setNotifications(notifs as Notification[])
        setNbNonLus(notifs.filter(n => !n.lu).length)
      }

      setLoading(false)
    }
    loadStats()
  }, [])

  const marquerNotifLue = async (id: string) => {
    const supabase = createClient()
    await supabase.from('notifications').update({ lu: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, lu: true } : n))
    setNbNonLus(prev => Math.max(0, prev - 1))
  }

  const hasPremiumAccess = stats?.role === 'admin' || stats?.role === 'owner' || !!stats?.isPremium

  const loadPremiumStats = async (catId?: string) => {
    if (!userId) return
    setPremiumLoading(true)
    const supabase = createClient()
    const categoryFilter = catId || null

    const [
      { data: evolution },
      { data: difficulty },
      { data: subcats },
      { data: percentile },
      { data: multiplayer },
      { data: freq },
      { data: cats },
    ] = await Promise.all([
      supabase.rpc('get_user_score_evolution', { p_user_id: userId }),
      supabase.rpc('get_user_difficulty_stats', { p_user_id: userId }),
      supabase.rpc('get_user_subcategory_stats', { p_user_id: userId, p_category_id: categoryFilter }),
      supabase.rpc('get_user_percentile', { p_user_id: userId, p_category_id: categoryFilter }),
      supabase.rpc('get_user_multiplayer_stats', { p_user_id: userId }),
      supabase.rpc('get_user_question_frequency', { p_user_id: userId }),
      categoriesList.length > 0 ? Promise.resolve({ data: categoriesList }) : supabase.from('categories').select('id, name').order('name'),
    ])

    if (cats && categoriesList.length === 0) setCategoriesList(cats as Category[])

    const scoreEvolution: ScorePoint[] = (evolution || []).map((g: any) => ({
      id: g.game_id,
      date: new Date(g.played_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
      value: g.score_max > 0 ? Math.round((g.score / g.score_max) * 100) : 0,
      source: g.source === 'multiplayer' ? 'multiplayer' : 'solo',
    }))

    const difficultyStats = DIFFICULTES.map(d => {
      const row = (difficulty || []).find((r: any) => r.difficulty === d.key)
      return {
        key: d.key,
        label: d.label,
        color: d.color,
        successRate: row ? Math.round(Number(row.success_rate) || 0) : 0,
        questionsPlayed: row ? Number(row.questions_played) || 0 : 0,
        correctAnswers: row ? Number(row.correct_answers) || 0 : 0,
      }
    })

    const subcategories = (subcats || []).map((r: any) => ({
      id: r.subcategory_id,
      label: r.subcategory_name,
      successRate: Math.round(Number(r.success_rate) || 0),
      questionsPlayed: Number(r.questions_played) || 0,
      correctAnswers: Number(r.correct_answers) || 0,
    }))

    const percentileData = percentile && percentile.length > 0 ? {
      rank: Number(percentile[0].rank),
      totalPlayers: Number(percentile[0].total_players),
      topPercent: Number(percentile[0].top_percent),
    } : null

    const multiplayerData = multiplayer && multiplayer.length > 0 ? {
      gamesPlayed: Number(multiplayer[0].games_played) || 0,
      gamesWon: Number(multiplayer[0].games_won) || 0,
      winRate: Number(multiplayer[0].win_rate) || 0,
    } : null

    const freqData = freq && freq.length > 0 ? {
      distinctQuestions: Number(freq[0].distinct_questions) || 0,
      totalAnswers: Number(freq[0].total_answers) || 0,
      mostFrequentText: freq[0].most_frequent_question_text || null,
      mostFrequentCount: Number(freq[0].most_frequent_count) || 0,
    } : null

    setPremiumStats({
      scoreEvolution,
      difficulty: difficultyStats,
      subcategories,
      percentile: percentileData,
      multiplayer: multiplayerData,
      questionFrequency: freqData,
    })
    setPremiumLoaded(true)
    setPremiumLoading(false)
  }

  const ouvrirOngletPremium = () => {
    setOnglet('premium')
    if (hasPremiumAccess && !premiumLoaded && !premiumLoading) {
      loadPremiumStats()
    }
  }

  const changerCategoriePercentile = (catId: string) => {
    setPercentileCategory(catId)
    if (hasPremiumAccess) loadPremiumStats(catId || undefined)
  }

  const handleDeconnexion = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0f0e17]" style={{ padding: '32px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <div className="flex items-center gap-5">
            <Skeleton width={80} height={80} radius="9999px" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Skeleton width={160} height={22} />
              <Skeleton width={120} height={13} />
            </div>
          </div>
          <Skeleton height={48} radius="12px" />
          <div className="grid grid-cols-3 gap-4">
            <Skeleton height={90} radius="16px" />
            <Skeleton height={90} radius="16px" />
            <Skeleton height={90} radius="16px" />
          </div>
          <SkeletonRow avatar={false} />
          <SkeletonRow avatar={false} />
        </div>
      </main>
    )
  }

  if (!stats) return null

  return (
    <main className="min-h-screen bg-[#0f0e17]" style={{ padding: '32px 24px' }}>

      <nav className="flex justify-between items-center" style={{ maxWidth: '900px', margin: '0 auto 40px' }}>
        <div className="flex items-center gap-3">
          <BackButton />
          <Link href="/" className="font-fredoka text-2xl">
            <span className="text-[#ff6b6b]">C</span>
            <span className="text-[#ff9f43]">o</span>
            <span className="text-[#ffd93d]">o</span>
            <span className="text-[#6bcb77]">l</span>
            <span className="text-[#4ecdc4]">o</span>
            <span className="text-[#a78bfa]">s</span>
            <span className="text-[#c9c4e0]"> Quiz</span>
          </Link>
        </div>
      </nav>

      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>

        {/* Header profil */}
        <div className="flex items-center gap-5">
          <div className="relative">
            <Avatar url={stats.avatarUrl} size={80} border="accent" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-fredoka text-3xl text-[#eeeaf8]">{stats.pseudo}</h2>
              <RoleBadge role={stats.role} isPremium={stats.isPremium} size="sm" />
            </div>
            <p className="text-[#827f97] text-sm">Membre depuis {stats.depuis}</p>
            <div className="flex gap-2 mt-2">
              <Link href="/profil/modifier" className="border border-[#3a3650] text-[#9b96b8] rounded-full px-4 py-1 font-fredoka text-sm hover:bg-[#1e1c2e] transition">
                Modifier le profil
              </Link>
              <Link href="/amis" className="border border-[#3a3650] text-[#9b96b8] rounded-full px-4 py-1 font-fredoka text-sm hover:bg-[#1e1c2e] transition">
                Amis
              </Link>
              {stats.stripeCustomerId && (
                <button
                  onClick={ouvrirPortailAbonnement}
                  disabled={portalLoading}
                  className="border border-[#3a3650] text-[#9b96b8] rounded-full px-4 py-1 font-fredoka text-sm hover:bg-[#1e1c2e] transition"
                  style={{ cursor: portalLoading ? 'not-allowed' : 'pointer', opacity: portalLoading ? 0.6 : 1 }}
                >
                  {portalLoading ? 'Ouverture...' : 'Gérer mon abonnement'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Onglets */}
        <div className="flex bg-[#1a1828] rounded-xl p-1 gap-1">
          <button
            onClick={() => setOnglet('stats')}
            className="flex-1 text-center font-fredoka text-sm py-3 rounded-lg transition hover:opacity-80"
            style={{ background: onglet === 'stats' ? '#0f0e17' : 'transparent', color: onglet === 'stats' ? '#eeeaf8' : '#9b96b8' }}
          >
            Statistiques
          </button>
          <button
            onClick={() => setOnglet('categories')}
            className="flex-1 text-center font-fredoka text-sm py-3 rounded-lg transition hover:opacity-80"
            style={{ background: onglet === 'categories' ? '#0f0e17' : 'transparent', color: onglet === 'categories' ? '#eeeaf8' : '#9b96b8' }}
          >
            Par catégorie
          </button>
          <button
            onClick={() => setOnglet('messages')}
            className="flex-1 text-center font-fredoka text-sm py-3 rounded-lg relative transition hover:opacity-80"
            style={{ background: onglet === 'messages' ? '#0f0e17' : 'transparent', color: onglet === 'messages' ? '#eeeaf8' : '#9b96b8' }}
          >
            Messages
            {nbNonLus > 0 && (
              <span
                className="absolute font-fredoka text-xs rounded-full flex items-center justify-center"
                style={{ background: '#ff6b6b', color: '#fff', width: '18px', height: '18px', top: '4px', right: '8px', fontSize: '10px' }}
              >
                {nbNonLus}
              </span>
            )}
          </button>
          <button
            onClick={ouvrirOngletPremium}
            className="flex-1 text-center font-fredoka text-sm py-3 rounded-lg transition hover:opacity-90"
            style={{ background: onglet === 'premium' ? '#0f0e17' : 'transparent', color: onglet === 'premium' ? '#ffd93d' : '#9b96b8' }}
          >
            ★ Stats avancées
          </button>
        </div>

        {/* Panel stats globales */}
        {onglet === 'stats' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'coolos-fade-in 0.2s ease both' }}>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-5 text-center">
                <div className="font-fredoka text-3xl text-[#ffd93d] mb-1">{stats.totalQuestions}</div>
                <div className="text-[#827f97] text-sm">Questions</div>
              </div>
              <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-5 text-center">
                <div className="font-fredoka text-3xl text-[#6bcb77] mb-1">{stats.tauxReussite}%</div>
                <div className="text-[#827f97] text-sm">Réussite</div>
              </div>
              <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-5 text-center">
                <div className="font-fredoka text-3xl text-[#4ecdc4] mb-1">{stats.totalParties}</div>
                <div className="text-[#827f97] text-sm">Parties</div>
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

            <Link href="/classement" className="block w-full border rounded-2xl py-4 font-fredoka text-lg text-center hover:bg-[#2a1f3d] transition" style={{ borderColor: '#a78bfa', color: '#a78bfa' }}>
              Voir le classement →
            </Link>

            <Link href="/amis" className="block w-full border rounded-2xl py-4 font-fredoka text-lg text-center hover:bg-[#1a2e1f] transition" style={{ borderColor: '#6bcb77', color: '#6bcb77' }}>
              Voir mes amis →
            </Link>

            <Link href="/revision" className="block w-full border rounded-2xl py-4 font-fredoka text-lg text-center hover:bg-[#2a1f3d] transition" style={{ borderColor: '#a78bfa', color: '#a78bfa' }}>
              ★ Mes révisions →
            </Link>
          </div>
        )}

        {/* Panel par catégorie */}
        {onglet === 'categories' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', animation: 'coolos-fade-in 0.2s ease both' }}>
            {statsCategories.length === 0 ? (
              <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-10 text-center">
                <p className="font-fredoka text-[#9b96b8] text-xl mb-2">Aucune donnée</p>
                <p className="text-[#827f97] text-sm">Joue quelques parties pour voir tes stats par catégorie.</p>
              </div>
            ) : (
              statsCategories.map((cat) => (
                <div key={cat.nom} className="bg-[#1a1828] border border-[#2a2830] rounded-2xl" style={{ padding: '16px 20px' }}>
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-fredoka text-[#eeeaf8] text-base">{cat.nom}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[#827f97] text-xs">{cat.total} questions</span>
                      <span className="font-fredoka text-sm" style={{ color: cat.taux >= 70 ? '#6bcb77' : cat.taux >= 40 ? '#ffd93d' : '#ff6b6b' }}>
                        {cat.taux}%
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1" style={{ height: '8px' }}>
                    <div className="rounded-full bg-[#6bcb77]" style={{ width: `${cat.total > 0 ? (cat.oui / cat.total) * 100 : 0}%` }}></div>
                    <div className="rounded-full bg-[#ffd93d]" style={{ width: `${cat.total > 0 ? (cat.enPartie / cat.total) * 100 : 0}%` }}></div>
                    <div className="rounded-full bg-[#ff6b6b]" style={{ width: `${cat.total > 0 ? (cat.non / cat.total) * 100 : 0}%` }}></div>
                  </div>
                  <div className="flex gap-4 mt-2">
                    <span className="text-[#6bcb77] text-xs font-fredoka">{cat.oui} oui</span>
                    <span className="text-[#ffd93d] text-xs font-fredoka">{cat.enPartie} en partie</span>
                    <span className="text-[#ff6b6b] text-xs font-fredoka">{cat.non} non</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Panel messages */}
        {onglet === 'messages' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', animation: 'coolos-fade-in 0.2s ease both' }}>
            {notifications.length === 0 ? (
              <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-10 text-center">
                <p className="font-fredoka text-[#9b96b8] text-xl mb-2">Aucun message</p>
                <p className="text-[#827f97] text-sm">Tu recevras ici les messages de l'équipe Coolos.</p>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  style={{
                    background: n.lu ? '#141320' : '#1a1828',
                    border: `1px solid ${n.lu ? '#1e1c2e' : '#a78bfa'}`,
                    borderRadius: '16px',
                    padding: '20px',
                    opacity: n.lu ? 0.7 : 1,
                  }}
                >
                  <div className="flex items-start justify-between gap-3" style={{ marginBottom: '10px' }}>
                    <div className="flex items-center gap-2">
                      {n.type === 'room_invite' ? (
                        <span className="font-fredoka text-xs rounded-full px-3 py-1" style={{ background: '#1a2a2d', color: '#4ecdc4' }}>
                          🎮 Invitation
                        </span>
                      ) : (
                        <span className="font-fredoka text-xs rounded-full px-3 py-1" style={{ background: '#2a1f3d', color: '#a78bfa' }}>
                          ✉ Coolos
                        </span>
                      )}
                      {!n.lu && (
                        <span className="font-fredoka text-xs rounded-full px-2 py-0.5" style={{ background: '#a78bfa', color: '#0f0e17' }}>
                          Nouveau
                        </span>
                      )}
                    </div>
                    <span className="text-[#8480a1] text-xs flex-shrink-0">
                      {new Date(n.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="font-fredoka text-[#eeeaf8] text-base" style={{ marginBottom: '8px' }}>{n.titre}</p>
                  <p className="text-[#9b96b8] text-sm leading-relaxed" style={{ marginBottom: '12px' }}>{n.contenu}</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    {n.action_url && (
                      <Link
                        href={n.action_url}
                        onClick={() => { if (!n.lu) marquerNotifLue(n.id) }}
                        className="font-fredoka text-xs rounded-lg px-3 py-1.5 hover:opacity-80 transition"
                        style={{ background: '#1a2a2d', color: '#4ecdc4', border: '1px solid #2a4a4d' }}
                      >
                        Rejoindre la salle →
                      </Link>
                    )}
                    {!n.lu && (
                      <button
                        onClick={() => marquerNotifLue(n.id)}
                        className="font-fredoka text-xs rounded-lg px-3 py-1.5 hover:opacity-80 transition"
                        style={{ background: '#2a1f3d', color: '#a78bfa', border: '1px solid #3a2d5a' }}
                      >
                        ✓ Marquer comme lu
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Panel stats avancées (premium) */}
        {onglet === 'premium' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'coolos-fade-in 0.2s ease both' }}>
            {!hasPremiumAccess ? (
              <div className="bg-[#1a1828] border rounded-2xl p-10 text-center" style={{ borderColor: '#4a3a10' }}>
                <p className="font-fredoka text-[#ffd93d] text-xl mb-2">★ Fonctionnalité Premium</p>
                <p className="text-[#9b96b8] text-sm leading-relaxed mb-6">
                  Les statistiques avancées (courbe d'évolution, détail par difficulté et sous-catégorie,
                  comparaison aux autres joueurs, stats multijoueur, question la plus rencontrée...) sont
                  réservées aux comptes premium.
                </p>
                <Link
                  href="/premium"
                  className="inline-block rounded-2xl py-3 px-8 font-fredoka text-base transition hover:opacity-90"
                  style={{ background: '#ffd93d', color: '#0f0e17' }}
                >
                  Devenir Premium →
                </Link>
              </div>
            ) : premiumLoading && !premiumLoaded ? (
              <>
                <Skeleton height={220} radius="16px" />
                <Skeleton height={160} radius="16px" />
                <Skeleton height={160} radius="16px" />
                <Skeleton height={180} radius="16px" />
              </>
            ) : premiumStats ? (
              <>
                <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl" style={{ padding: '18px 20px' }}>
                  <p className="font-fredoka text-[#c9c4e0] text-lg mb-4">Évolution du score</p>
                  <LineChartScore points={premiumStats.scoreEvolution} />
                </div>

                <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl" style={{ padding: '18px 20px' }}>
                  <p className="font-fredoka text-[#c9c4e0] text-lg mb-4">Réussite par difficulté</p>
                  <BarList
                    emptyLabel="Pas encore de parties jouées."
                    items={premiumStats.difficulty
                      .filter(d => d.questionsPlayed > 0)
                      .map(d => ({
                        id: d.key,
                        label: d.label,
                        value: d.successRate,
                        color: d.color,
                        detail: `${Math.round(d.correctAnswers)}/${d.questionsPlayed} bonnes réponses`,
                      }))}
                  />
                </div>

                <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl" style={{ padding: '18px 20px' }}>
                  <p className="font-fredoka text-[#c9c4e0] text-lg mb-4">Réussite par sous-catégorie</p>
                  <BarList
                    emptyLabel="Pas encore de données par sous-catégorie."
                    items={premiumStats.subcategories.slice(0, 12).map(s => ({
                      id: s.id,
                      label: s.label,
                      value: s.successRate,
                      color: performanceColor(s.successRate),
                      detail: `${Math.round(s.correctAnswers)}/${s.questionsPlayed} bonnes réponses`,
                    }))}
                  />
                </div>

                <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl" style={{ padding: '18px 20px' }}>
                  <div className="flex items-center justify-between flex-wrap gap-2" style={{ marginBottom: '16px' }}>
                    <p className="font-fredoka text-[#c9c4e0] text-lg">Comparaison aux autres joueurs</p>
                    <select
                      value={percentileCategory}
                      onChange={(e) => changerCategoriePercentile(e.target.value)}
                      className="bg-[#0f0e17] border border-[#3a3650] rounded-lg text-[#c9c4e0] text-sm"
                      style={{ padding: '6px 10px' }}
                    >
                      <option value="">Toutes catégories</option>
                      {categoriesList.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  {premiumStats.percentile ? (
                    <div className="flex justify-center">
                      <StatRing
                        value={100 - premiumStats.percentile.topPercent}
                        label={`Top ${premiumStats.percentile.topPercent}%`}
                        sublabel={`${premiumStats.percentile.rank}e sur ${premiumStats.percentile.totalPlayers} joueurs`}
                        color={performanceColor(100 - premiumStats.percentile.topPercent)}
                        size={140}
                      />
                    </div>
                  ) : (
                    <p className="text-[#827f97] text-sm text-center">Pas encore assez de données pour te classer.</p>
                  )}
                </div>

                <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl" style={{ padding: '18px 20px' }}>
                  <p className="font-fredoka text-[#c9c4e0] text-lg mb-4">Statistiques multijoueur</p>
                  {premiumStats.multiplayer && premiumStats.multiplayer.gamesPlayed > 0 ? (
                    <div className="flex items-center justify-center gap-8 flex-wrap">
                      <StatRing
                        value={premiumStats.multiplayer.winRate}
                        label={`${Math.round(premiumStats.multiplayer.winRate)}%`}
                        sublabel="Taux de victoire"
                        color={performanceColor(premiumStats.multiplayer.winRate)}
                      />
                      <div className="flex flex-col gap-3 text-center">
                        <div>
                          <div className="font-fredoka text-2xl text-[#4ecdc4]">{premiumStats.multiplayer.gamesPlayed}</div>
                          <div className="text-[#827f97] text-sm">Parties jouées</div>
                        </div>
                        <div>
                          <div className="font-fredoka text-2xl text-[#6bcb77]">{premiumStats.multiplayer.gamesWon}</div>
                          <div className="text-[#827f97] text-sm">Victoires</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[#827f97] text-sm text-center">Pas encore de partie multijoueur jouée.</p>
                  )}
                </div>

                <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl" style={{ padding: '18px 20px' }}>
                  <p className="font-fredoka text-[#c9c4e0] text-lg mb-4">Questions rencontrées</p>
                  {premiumStats.questionFrequency ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center">
                          <div className="font-fredoka text-2xl text-[#ffd93d]">{premiumStats.questionFrequency.distinctQuestions}</div>
                          <div className="text-[#827f97] text-sm">Questions distinctes</div>
                        </div>
                        <div className="text-center">
                          <div className="font-fredoka text-2xl text-[#a78bfa]">{premiumStats.questionFrequency.totalAnswers}</div>
                          <div className="text-[#827f97] text-sm">Réponses au total</div>
                        </div>
                      </div>
                      {premiumStats.questionFrequency.mostFrequentText && premiumStats.questionFrequency.mostFrequentCount > 1 && (
                        <div className="bg-[#0f0e17] rounded-xl" style={{ padding: '12px 16px' }}>
                          <p className="text-[#827f97] text-xs mb-1">Question la plus rencontrée ({premiumStats.questionFrequency.mostFrequentCount} fois)</p>
                          <p className="text-[#c9c4e0] text-sm">{premiumStats.questionFrequency.mostFrequentText}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-[#827f97] text-sm text-center">Pas encore de données.</p>
                  )}
                </div>

                <Link href="/historique" className="block w-full border rounded-2xl py-4 font-fredoka text-lg text-center hover:bg-[#1f1e10] transition" style={{ borderColor: '#ffd93d', color: '#ffd93d' }}>
                  Voir mon historique détaillé →
                </Link>
              </>
            ) : null}
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

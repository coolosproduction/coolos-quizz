'use client'

import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '../../lib/supabase'

type Category = { id: string, name: string, color: string, bg: string }

type LeaderboardRow = {
  rank: number
  user_id: string
  pseudo: string
  avatar_url: string | null
  total_score: number
  questions_played: number
  correct_answers: number
  success_rate: number | string
}

const themeColors = [
  '#ff6b6b', '#ffd93d', '#6bcb77', '#4ecdc4', '#a78bfa', '#ff9f43',
  '#4ecdc4', '#ff6b6b', '#6bcb77', '#ffd93d',
]
const themeBgs = [
  '#2d1f1f', '#1f1e10', '#1a2e1f', '#1a2a2d', '#2a1f3d', '#2d2010',
  '#1a2a2d', '#2d1f1f', '#1a2e1f', '#1f1e10',
]

const rankColor = (rank: number) => {
  if (rank === 1) return '#ffd93d'
  if (rank === 2) return '#9b96b8'
  if (rank === 3) return '#ff9f43'
  return '#4a4760'
}

const formatScore = (n: number) => (Number.isInteger(n) ? n.toString() : n.toFixed(1))
const formatRate = (n: number | string) => `${Number(n).toFixed(1)}%`

// PostgREST sérialise parfois bigint/numeric en chaînes JSON : on normalise dès la réception.
const normalizeRow = (r: any): LeaderboardRow => ({
  rank: Number(r.rank),
  user_id: r.user_id,
  pseudo: r.pseudo,
  avatar_url: r.avatar_url,
  total_score: Number(r.total_score),
  questions_played: Number(r.questions_played),
  correct_answers: Number(r.correct_answers),
  success_rate: Number(r.success_rate),
})

export default function Classement() {
  const [connecte, setConnecte] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)

  const [categories, setCategories] = useState<Category[]>([])
  const [categorieSelec, setCategorieSelec] = useState<string | null>(null)

  const [top, setTop] = useState<LeaderboardRow[]>([])
  const [maPosition, setMaPosition] = useState<LeaderboardRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [posLoading, setPosLoading] = useState(false)

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setConnecte(!!user)
      setUserId(user?.id || null)
      setCheckingAuth(false)

      const { data: catsData } = await supabase
        .from('categories')
        .select('id, name')
        .eq('active', true)
        .order('name')

      if (catsData) {
        setCategories(catsData.map((c, i) => ({
          id: c.id,
          name: c.name,
          color: themeColors[i % themeColors.length],
          bg: themeBgs[i % themeBgs.length],
        })))
      }
    }
    init()
  }, [])

  const loadClassement = useCallback(async (categoryId: string | null, uid: string | null) => {
    setLoading(true)
    const supabase = createClient()

    const { data: leaderboard, error } = await supabase
      .rpc('get_leaderboard', { p_category_id: categoryId, p_limit: 100 })

    if (!error && leaderboard) {
      setTop((leaderboard as any[]).map(normalizeRow))
    } else {
      setTop([])
    }
    setLoading(false)

    if (uid) {
      setPosLoading(true)
      const { data: rankData, error: rankError } = await supabase
        .rpc('get_user_rank', { p_user_id: uid, p_category_id: categoryId })
      if (!rankError && rankData && rankData.length > 0) {
        setMaPosition(normalizeRow(rankData[0]))
      } else {
        setMaPosition(null)
      }
      setPosLoading(false)
    } else {
      setMaPosition(null)
    }
  }, [])

  useEffect(() => {
    if (checkingAuth) return
    loadClassement(categorieSelec, userId)
  }, [checkingAuth, categorieSelec, userId, loadClassement])

  const suisJeDansLeTop = maPosition ? top.some(r => r.user_id === maPosition.user_id) : false

  return (
    <main className="min-h-screen bg-[#0f0e17]">

      <nav className="fixed top-0 left-0 right-0 flex justify-between items-center bg-[#0f0e17] border-b border-[#1e1c2e] z-10 px-4 md:px-8 py-4">
        <Link href="/" className="font-fredoka text-xl md:text-2xl">
          <span className="text-[#ff6b6b]">C</span>
          <span className="text-[#ff9f43]">o</span>
          <span className="text-[#ffd93d]">o</span>
          <span className="text-[#6bcb77]">l</span>
          <span className="text-[#4ecdc4]">o</span>
          <span className="text-[#a78bfa]">s</span>
          <span className="text-[#c9c4e0]"> Quiz</span>
        </Link>
        {!checkingAuth && (
          connecte ? (
            <div className="flex items-center gap-3">
              <Link href="/configuration" className="bg-[#ffd93d] text-[#0f0e17] rounded-full px-4 py-2 font-fredoka text-sm hover:opacity-90 transition">
                Jouer →
              </Link>
              <Link href="/profil" className="w-9 h-9 rounded-full bg-[#2a1f3d] border-2 border-[#a78bfa] flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-[#a78bfa]"></div>
              </Link>
            </div>
          ) : (
            <Link href="/connexion" className="border border-[#3a3650] text-[#c9c4e0] rounded-full px-4 py-2 text-sm hover:bg-[#1e1c2e] transition">
              Connexion
            </Link>
          )
        )}
      </nav>

      <div className="px-4 md:px-8 pb-16" style={{ paddingTop: '100px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

          <div>
            <h1 className="font-fredoka text-3xl md:text-4xl text-[#eeeaf8] mb-2">Classement</h1>
            <p className="text-[#9b96b8] text-base">Les meilleurs joueurs de Coolos Quiz</p>
          </div>

          {/* Sélecteur de catégorie */}
          <div className="flex gap-2 overflow-x-auto" style={{ paddingBottom: '4px' }}>
            <button
              onClick={() => setCategorieSelec(null)}
              className="font-fredoka text-sm rounded-full px-4 py-2 flex-shrink-0 transition"
              style={{
                background: categorieSelec === null ? '#ffd93d' : '#1a1828',
                color: categorieSelec === null ? '#0f0e17' : '#9b96b8',
                border: `1px solid ${categorieSelec === null ? '#ffd93d' : '#2a2830'}`,
              }}
            >
              Général
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setCategorieSelec(cat.id)}
                className="font-fredoka text-sm rounded-full px-4 py-2 flex-shrink-0 transition flex items-center gap-2"
                style={{
                  background: categorieSelec === cat.id ? cat.color : '#1a1828',
                  color: categorieSelec === cat.id ? '#0f0e17' : '#9b96b8',
                  border: `1px solid ${categorieSelec === cat.id ? cat.color : '#2a2830'}`,
                }}
              >
                {categorieSelec !== cat.id && <div className="w-2 h-2 rounded-full" style={{ background: cat.color }}></div>}
                {cat.name}
              </button>
            ))}
          </div>

          {/* Bandeau invitation à se connecter */}
          {!checkingAuth && !connecte && (
            <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl flex items-center justify-between gap-4 flex-wrap" style={{ padding: '16px 20px' }}>
              <p className="text-[#9b96b8] text-sm">Connecte-toi pour voir ta position dans le classement.</p>
              <Link href="/connexion" className="font-fredoka text-sm rounded-full px-4 py-2 flex-shrink-0" style={{ background: '#a78bfa', color: '#0f0e17' }}>
                Connexion
              </Link>
            </div>
          )}

          {/* Ma position */}
          {connecte && !posLoading && (
            maPosition ? (
              <div className="rounded-2xl" style={{ background: '#2a1f3d', border: '2px solid #a78bfa', padding: '16px 20px' }}>
                <p className="font-fredoka text-xs text-[#a78bfa] uppercase tracking-widest" style={{ marginBottom: '10px' }}>Ta position</p>
                <LigneClassement row={maPosition} highlight />
              </div>
            ) : (
              <div className="rounded-2xl text-center" style={{ background: '#1a1828', border: '1px solid #2a2830', padding: '20px' }}>
                <p className="font-fredoka text-[#9b96b8] text-base mb-3">
                  {categorieSelec ? "Tu n'as pas encore joué dans cette catégorie." : "Tu n'as pas encore joué de partie."}
                </p>
                <Link href="/configuration" className="inline-block font-fredoka text-sm rounded-full px-5 py-2" style={{ background: '#ffd93d', color: '#0f0e17' }}>
                  Lancer un quiz !
                </Link>
              </div>
            )
          )}

          {/* Top 100 */}
          {loading ? (
            <p className="font-fredoka text-[#9b96b8] text-lg text-center" style={{ padding: '40px 0' }}>Chargement...</p>
          ) : top.length === 0 ? (
            <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-10 text-center">
              <p className="font-fredoka text-[#9b96b8] text-xl mb-2">Personne n'a encore joué {categorieSelec ? 'dans cette catégorie' : ''}</p>
              <p className="text-[#6b6880] text-sm">Sois le premier à apparaître dans ce classement !</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="flex items-center gap-3 md:gap-4" style={{ padding: '0 16px' }}>
                <div className="w-7 flex-shrink-0"></div>
                <div style={{ width: '32px' }} className="flex-shrink-0"></div>
                <div className="flex-1 min-w-0"></div>
                <p className="text-[#4a4760] text-xs uppercase tracking-wide w-14 text-center flex-shrink-0">Score</p>
                <p className="hidden sm:block text-[#4a4760] text-xs uppercase tracking-wide w-16 text-center flex-shrink-0">Questions</p>
                <p className="hidden sm:block text-[#4a4760] text-xs uppercase tracking-wide w-16 text-center flex-shrink-0">Bonnes rép.</p>
                <p className="text-[#4a4760] text-xs uppercase tracking-wide w-14 text-center flex-shrink-0">Réussite</p>
              </div>
              {top.map(row => (
                <LigneClassement key={row.user_id} row={row} highlight={row.user_id === userId} />
              ))}
              {connecte && maPosition && !suisJeDansLeTop && (
                <p className="text-[#4a4760] text-xs text-center" style={{ marginTop: '8px' }}>
                  Tu n'es pas dans le top 100 — ta position est affichée ci-dessus.
                </p>
              )}
            </div>
          )}

        </div>
      </div>
    </main>
  )
}

function LigneClassement({ row, highlight }: { row: LeaderboardRow, highlight?: boolean }) {
  return (
    <div
      style={{
        background: highlight ? '#231f38' : row.rank === 1 ? '#1f1e10' : '#1a1828',
        border: `1px solid ${highlight ? '#a78bfa' : row.rank === 1 ? '#ffd93d' : '#2a2830'}`,
        borderRadius: '12px',
        padding: '12px 16px',
      }}
    >
      <div className="flex items-center gap-3 md:gap-4">
        <div className="font-fredoka text-sm w-7 flex-shrink-0 text-center" style={{ color: rankColor(row.rank) }}>
          {row.rank}
        </div>
        <div className="rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ width: '32px', height: '32px', border: '2px solid #2a2830', background: '#2a1f3d' }}>
          {row.avatar_url ? (
            <img src={row.avatar_url} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            <div className="w-4 h-4 rounded-full bg-[#a78bfa]"></div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-fredoka text-[#eeeaf8] text-sm truncate">
            {row.pseudo}
            {highlight && <span className="text-[#a78bfa] text-xs"> (toi)</span>}
          </p>
        </div>
        <div className="font-fredoka text-sm w-14 text-center flex-shrink-0" style={{ color: '#ffd93d' }}>
          {formatScore(row.total_score)}
        </div>
        <div className="hidden sm:block font-fredoka text-sm w-16 text-center flex-shrink-0" style={{ color: '#c9c4e0' }}>
          {row.questions_played}
        </div>
        <div className="hidden sm:block font-fredoka text-sm w-16 text-center flex-shrink-0" style={{ color: '#6bcb77' }}>
          {formatScore(row.correct_answers)}
        </div>
        <div className="font-fredoka text-sm w-14 text-center flex-shrink-0" style={{ color: Number(row.success_rate) >= 70 ? '#6bcb77' : Number(row.success_rate) >= 40 ? '#ffd93d' : '#ff6b6b' }}>
          {formatRate(row.success_rate)}
        </div>
      </div>
    </div>
  )
}

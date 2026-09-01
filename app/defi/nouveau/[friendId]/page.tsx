'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '../../../../lib/supabase'
import Avatar from '@/components/Avatar'
import BackButton from '@/components/BackButton'
import Skeleton from '@/components/Skeleton'

const difficultes = [
  { id: 'facile', label: 'Facile', color: '#6bcb77', bg: '#1a2e1f' },
  { id: 'moyen', label: 'Moyen', color: '#ffd93d', bg: '#1f1e10' },
  { id: 'difficile', label: 'Difficile', color: '#ff6b6b', bg: '#2e1a1a' },
  { id: 'hardcore', label: 'Hardcore', color: '#a78bfa', bg: '#2a1f3d' },
]
const nbQuestions = [5, 10, 15, 20]
const timers = [10, 15, 20, 30, 45, 60]

const themeColors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4ecdc4', '#a78bfa', '#ff9f43']
const themeBgs = ['#2d1f1f', '#1f1e10', '#1a2e1f', '#1a2a2d', '#2a1f3d', '#2d2010']

type Category = { id: string, name: string, color: string, bg: string }
type Identite = { pseudo: string, avatar_url: string | null }

export default function NouveauDefi() {
  const params = useParams()
  const router = useRouter()
  const friendId = params.friendId as string

  const [loading, setLoading] = useState(true)
  const [hasPremiumAccess, setHasPremiumAccess] = useState(false)
  const [friend, setFriend] = useState<Identite | null>(null)
  const [notFriend, setNotFriend] = useState(false)

  const [themes, setThemes] = useState<Category[]>([])
  const [themesSelec, setThemesSelec] = useState<string[]>([])
  const [diffSelec, setDiffSelec] = useState<string[]>([])
  const [nb, setNb] = useState(10)
  const [timer, setTimer] = useState(20)

  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/connexion'); return }

      const { data: premiumAccess } = await supabase.rpc('has_premium_access')
      setHasPremiumAccess(!!premiumAccess)

      const { data: friendRow } = await supabase
        .from('friend_requests')
        .select('id')
        .eq('status', 'accepted')
        .or(`and(requester_id.eq.${user.id},recipient_id.eq.${friendId}),and(requester_id.eq.${friendId},recipient_id.eq.${user.id})`)
        .maybeSingle()

      if (!friendRow) { setNotFriend(true); setLoading(false); return }

      const { data: idData } = await supabase.rpc('get_user_public_identity', { p_user_id: friendId })
      if (idData && idData.length > 0) {
        setFriend({ pseudo: idData[0].pseudo, avatar_url: idData[0].avatar_url })
      }

      if (premiumAccess) {
        const { data: catsData } = await supabase
          .from('categories')
          .select('id, name')
          .eq('active', true)
          .order('name')
        if (catsData) {
          setThemes(catsData.map((c, i) => ({
            id: c.id, name: c.name,
            color: themeColors[i % themeColors.length],
            bg: themeBgs[i % themeBgs.length],
          })))
        }
      }

      setLoading(false)
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendId])

  const toggleTheme = (id: string) => {
    setThemesSelec(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
  }
  const toggleDiff = (id: string) => {
    setDiffSelec(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id])
  }

  const handleCreerDefi = async () => {
    setError('')
    setCreating(true)
    const supabase = createClient()

    const categoryIds = themesSelec.length === 0 ? themes.map(t => t.id) : themesSelec
    const difficulty = diffSelec.length === 0 ? ['facile', 'moyen', 'difficile', 'hardcore'] : diffSelec

    let query = supabase.from('questions').select('id').eq('active', true)
    if (categoryIds.length > 0) query = query.in('category_id', categoryIds)
    if (difficulty.length > 0) query = query.in('difficulty', difficulty)
    const { data: questionsData } = await query

    if (!questionsData || questionsData.length === 0) {
      setError('Aucune question ne correspond à cette configuration.')
      setCreating(false)
      return
    }

    const shuffled = [...questionsData].sort(() => Math.random() - 0.5)
    const questionIds = shuffled.slice(0, nb).map((q: { id: string }) => q.id)

    const { data: challengeId, error: createError } = await supabase.rpc('create_quiz_challenge', {
      p_opponent_id: friendId,
      p_question_ids: questionIds,
      p_timer_duration: timer,
    })

    if (createError || !challengeId) {
      setError(createError?.message || 'Impossible de créer le défi. Réessaie.')
      setCreating(false)
      return
    }

    router.push(`/defi/jouer/${challengeId}`)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0f0e17]" style={{ padding: '32px 24px 60px' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="flex items-center gap-3">
            <BackButton />
            <Skeleton width="200px" height={32} />
          </div>
          <Skeleton height={200} radius="16px" />
        </div>
      </main>
    )
  }

  if (notFriend) {
    return (
      <main className="min-h-screen bg-[#0f0e17] flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-fredoka text-[#ff6b6b] text-xl">Tu dois être ami avec ce joueur pour le défier.</p>
        <Link href="/amis" className="font-fredoka text-sm text-[#a78bfa]">← Retour à mes amis</Link>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#0f0e17]" style={{ padding: '32px 24px 60px' }}>
      <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>

        <div className="flex items-center gap-3">
          <BackButton />
          <div className="flex items-center gap-3">
            {friend && <Avatar url={friend.avatar_url} size={44} border="accent" />}
            <div>
              <h1 className="font-fredoka text-2xl text-[#eeeaf8]">Défier {friend?.pseudo || '...'}</h1>
              <p className="text-[#9b96b8] text-sm">Vous répondrez tous les deux exactement aux mêmes questions</p>
            </div>
          </div>
        </div>

        {!hasPremiumAccess ? (
          <div className="bg-[#1a1828] border rounded-2xl p-10 text-center" style={{ borderColor: '#4a3a10' }}>
            <p className="font-fredoka text-[#ffd93d] text-xl mb-2">★ Fonctionnalité Premium</p>
            <p className="text-[#9b96b8] text-sm leading-relaxed">
              Envoyer un défi est réservé aux comptes premium — mais n'importe qui peut en recevoir et y jouer.
            </p>
          </div>
        ) : (
          <>
            {error && (
              <div className="bg-[#2e1a1a] border border-[#ff6b6b] rounded-xl px-4 py-3">
                <p className="text-[#ff6b6b] text-sm">{error}</p>
              </div>
            )}

            <div>
              <p className="font-fredoka text-[#c9c4e0] text-lg mb-3">Thèmes</p>
              <div className="flex flex-wrap gap-3">
                {themes.map(t => (
                  <button
                    key={t.id}
                    onClick={() => toggleTheme(t.id)}
                    className="font-fredoka text-sm rounded-xl px-4 py-3 transition hover:opacity-80"
                    style={{
                      background: themesSelec.includes(t.id) ? t.bg : '#1a1828',
                      border: `2px solid ${themesSelec.includes(t.id) ? t.color : '#2a2830'}`,
                      color: themesSelec.includes(t.id) ? t.color : '#9b96b8',
                    }}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
              {themesSelec.length === 0 && (
                <p className="text-[#827f97] text-sm mt-2">Aucune sélection = tous les thèmes inclus</p>
              )}
            </div>

            <div>
              <p className="font-fredoka text-[#c9c4e0] text-lg mb-3">Difficulté</p>
              <div className="flex gap-3 flex-wrap">
                {difficultes.map(d => (
                  <button
                    key={d.id}
                    onClick={() => toggleDiff(d.id)}
                    className="rounded-xl py-3 px-5 font-fredoka text-sm transition hover:opacity-80"
                    style={{
                      background: diffSelec.includes(d.id) ? d.bg : '#1a1828',
                      border: `2px solid ${diffSelec.includes(d.id) ? d.color : '#2a2830'}`,
                      color: diffSelec.includes(d.id) ? d.color : '#9b96b8',
                    }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              {diffSelec.length === 0 && (
                <p className="text-[#827f97] text-sm mt-2">Aucune sélection = toutes les difficultés incluses</p>
              )}
            </div>

            <div>
              <p className="font-fredoka text-[#c9c4e0] text-lg mb-3">Nombre de questions</p>
              <div className="flex gap-3">
                {nbQuestions.map(n => (
                  <button
                    key={n}
                    onClick={() => setNb(n)}
                    className="flex-1 rounded-xl py-3 font-fredoka text-lg transition hover:opacity-80"
                    style={{
                      background: nb === n ? '#1a2a2d' : '#1a1828',
                      border: `2px solid ${nb === n ? '#4ecdc4' : '#2a2830'}`,
                      color: nb === n ? '#4ecdc4' : '#9b96b8',
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="font-fredoka text-[#c9c4e0] text-lg mb-3">Temps par question</p>
              <div className="flex gap-2 flex-wrap">
                {timers.map(t => (
                  <button
                    key={t}
                    onClick={() => setTimer(t)}
                    className="flex-1 rounded-xl py-3 font-fredoka text-sm transition hover:opacity-80"
                    style={{
                      background: timer === t ? '#2a1e10' : '#1a1828',
                      border: `2px solid ${timer === t ? '#ff9f43' : '#2a2830'}`,
                      color: timer === t ? '#ff9f43' : '#9b96b8',
                      minWidth: '60px',
                    }}
                  >
                    {t}s
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleCreerDefi}
              disabled={creating}
              className="block w-full rounded-2xl py-5 font-fredoka text-xl hover:opacity-90 transition text-center disabled:opacity-50"
              style={{ background: '#ffd93d', color: '#0f0e17' }}
            >
              {creating ? 'Préparation...' : '🎯 Envoyer le défi et jouer →'}
            </button>
            <p className="text-[#827f97] text-xs text-center">
              Tu joueras en premier pour lancer le défi — {friend?.pseudo} recevra une notification pour jouer à son tour.
            </p>
          </>
        )}

      </div>
    </main>
  )
}

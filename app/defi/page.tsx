'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import Avatar from '@/components/Avatar'
import BackButton from '@/components/BackButton'
import { SkeletonList } from '@/components/Skeleton'

type Challenge = {
  challenge_id: string
  is_challenger: boolean
  other_id: string
  other_pseudo: string
  other_avatar_url: string | null
  questions_count: number
  timer_duration: number
  status: 'pending' | 'declined' | 'completed'
  my_score: number | null
  other_score: number | null
  my_answered: boolean
  created_at: string
}

export default function Defis() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [decliningId, setDecliningId] = useState<string | null>(null)

  const loadChallenges = async () => {
    const supabase = createClient()
    const { data } = await supabase.rpc('get_my_challenges')
    setChallenges((data || []) as Challenge[])
  }

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/connexion'); return }
      await loadChallenges()
      setLoading(false)
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRefuser = async (id: string) => {
    setDecliningId(id)
    const supabase = createClient()
    await supabase.rpc('decline_quiz_challenge', { p_challenge_id: id })
    await loadChallenges()
    setDecliningId(null)
  }

  const aJouer = challenges.filter(c => !c.is_challenger && c.status === 'pending' && !c.my_answered)
  const enAttente = challenges.filter(c => c.status === 'pending' && c.my_answered)
  const termines = challenges.filter(c => c.status === 'completed')
  const refuses = challenges.filter(c => c.status === 'declined')

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0f0e17]" style={{ padding: '32px 24px 60px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>
          <div className="flex items-center gap-3">
            <BackButton />
            <h1 className="font-fredoka text-3xl text-[#eeeaf8]">🎯 Défis</h1>
          </div>
          <SkeletonList count={3} avatar={true} />
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#0f0e17]" style={{ padding: '32px 24px 60px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>

        <div className="flex justify-between items-center flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <BackButton />
            <h1 className="font-fredoka text-3xl text-[#eeeaf8]">🎯 Défis</h1>
          </div>
          <Link href="/amis" className="font-fredoka text-sm rounded-full px-4 py-2 hover:opacity-90 transition" style={{ background: '#ffd93d', color: '#0f0e17' }}>
            + Nouveau défi
          </Link>
        </div>

        {challenges.length === 0 && (
          <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-10 text-center">
            <p className="font-fredoka text-[#9b96b8] text-xl mb-2">Aucun défi pour l'instant</p>
            <p className="text-[#827f97] text-sm">Défie un ami depuis la page Amis pour commencer.</p>
          </div>
        )}

        {aJouer.length > 0 && (
          <div>
            <h2 className="font-fredoka text-xl text-[#eeeaf8] mb-3">À toi de jouer</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {aJouer.map(c => (
                <div key={c.challenge_id} className="bg-[#1a1828] border border-[#ffd93d] rounded-2xl flex items-center justify-between gap-3 flex-wrap" style={{ padding: '16px 20px' }}>
                  <div className="flex items-center gap-3">
                    <Avatar url={c.other_avatar_url} size={40} border="accent" />
                    <div>
                      <p className="font-fredoka text-[#eeeaf8] text-base">{c.other_pseudo} te défie</p>
                      <p className="text-[#827f97] text-xs">{c.questions_count} questions · {c.timer_duration}s par question</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/defi/jouer/${c.challenge_id}`} className="font-fredoka text-sm rounded-full px-4 py-2 hover:opacity-90 transition" style={{ background: '#ffd93d', color: '#0f0e17' }}>
                      Jouer →
                    </Link>
                    <button
                      onClick={() => handleRefuser(c.challenge_id)}
                      disabled={decliningId === c.challenge_id}
                      className="font-fredoka text-sm rounded-full px-4 py-2 disabled:opacity-50 transition hover:bg-[#1e1c2e]"
                      style={{ background: 'transparent', color: '#9b96b8', border: '1px solid #3a3650' }}
                    >
                      Refuser
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {enAttente.length > 0 && (
          <div>
            <h2 className="font-fredoka text-xl text-[#eeeaf8] mb-3">En attente</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {enAttente.map(c => (
                <div key={c.challenge_id} className="bg-[#1a1828] border border-[#2a2830] rounded-2xl flex items-center justify-between gap-3 flex-wrap" style={{ padding: '16px 20px' }}>
                  <div className="flex items-center gap-3">
                    <Avatar url={c.other_avatar_url} size={40} border="accent" />
                    <div>
                      <p className="font-fredoka text-[#eeeaf8] text-base">En attente de {c.other_pseudo}</p>
                      <p className="text-[#827f97] text-xs">{c.questions_count} questions · ton score : {c.my_score}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {termines.length > 0 && (
          <div>
            <h2 className="font-fredoka text-xl text-[#eeeaf8] mb-3">Terminés</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {termines.map(c => {
                const victoire = (c.my_score ?? 0) > (c.other_score ?? 0)
                const egalite = (c.my_score ?? 0) === (c.other_score ?? 0)
                return (
                  <div key={c.challenge_id} className="bg-[#1a1828] border border-[#2a2830] rounded-2xl flex items-center justify-between gap-3 flex-wrap" style={{ padding: '16px 20px' }}>
                    <div className="flex items-center gap-3">
                      <Avatar url={c.other_avatar_url} size={40} border="accent" />
                      <div>
                        <p className="font-fredoka text-[#eeeaf8] text-base">Contre {c.other_pseudo}</p>
                        <p className="text-[#827f97] text-xs">Toi : {c.my_score} · {c.other_pseudo} : {c.other_score}</p>
                      </div>
                    </div>
                    <span
                      className="font-fredoka text-xs rounded-full px-3 py-1.5 flex-shrink-0"
                      style={egalite
                        ? { background: '#1e1c2e', color: '#9b96b8', border: '1px solid #3a3650' }
                        : victoire
                          ? { background: '#1a2e1f', color: '#6bcb77', border: '1px solid #2a4a30' }
                          : { background: '#2e1a1a', color: '#ff6b6b', border: '1px solid #4a2a2a' }}
                    >
                      {egalite ? 'Égalité' : victoire ? '✓ Victoire' : 'Défaite'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {refuses.length > 0 && (
          <div>
            <h2 className="font-fredoka text-xl text-[#827f97] mb-3">Refusés</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {refuses.map(c => (
                <div key={c.challenge_id} className="bg-[#141320] border border-[#1e1c2e] rounded-xl flex items-center gap-3" style={{ padding: '10px 16px' }}>
                  <Avatar url={c.other_avatar_url} size={28} border="subtle" />
                  <p className="text-[#827f97] text-sm">{c.is_challenger ? `Refusé par ${c.other_pseudo}` : `Défi de ${c.other_pseudo} refusé`}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </main>
  )
}

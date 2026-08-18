'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '../../../../lib/supabase'
import { getMultiplayerIdentity, roomPathForStatus } from '../../../../lib/multiplayer'

type Player = {
  id: string
  user_id: string
  pseudo: string
  is_guest: boolean
  status: 'actif' | 'abandonne'
  score: number
}

const podiumStyle: Record<number, { color: string, bg: string, label: string }> = {
  0: { color: '#ffd93d', bg: '#1f1e10', label: '1er' },
  1: { color: '#c9c4e0', bg: '#1e1c2e', label: '2e' },
  2: { color: '#ff9f43', bg: '#2a1e10', label: '3e' },
}

export default function ResultatsMultijoueur() {
  const params = useParams()
  const router = useRouter()
  const code = (params.code as string || '').toUpperCase()

  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [connecte, setConnecte] = useState(false)
  const [loading, setLoading] = useState(true)
  const [closedMsg, setClosedMsg] = useState<string | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [totalQuestions, setTotalQuestions] = useState(0)

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      if (!code) return
      try {
        const identity = await getMultiplayerIdentity()
        if (cancelled) return
        setMyUserId(identity.user.id)
        setConnecte(!identity.isGuest)

        const supabase = createClient()
        const { data: gameData, error: gameError } = await supabase
          .from('multiplayer_games')
          .select('id, code, status, question_ids')
          .eq('code', code)
          .maybeSingle()

        if (gameError || !gameData) {
          setClosedMsg("Cette salle n'existe pas ou n'est plus disponible.")
          setLoading(false)
          return
        }

        if (gameData.status !== 'terminee') {
          if (gameData.status === 'annulee') {
            setClosedMsg('Cette salle a été fermée.')
            setLoading(false)
            return
          }
          const path = roomPathForStatus(gameData.status, code)
          if (path) { router.replace(path); return }
        }

        const { data: playersData } = await supabase
          .from('multiplayer_players')
          .select('id, user_id, pseudo, is_guest, status, score')
          .eq('game_id', gameData.id)
          .order('score', { ascending: false })

        if (cancelled) return
        setPlayers((playersData || []) as Player[])
        setTotalQuestions((gameData.question_ids || []).length)
        setLoading(false)
      } catch (e) {
        setClosedMsg('Impossible de charger les résultats.')
        setLoading(false)
      }
    }

    init()
    return () => { cancelled = true }
  }, [code, router])

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0f0e17] flex items-center justify-center">
        <p className="font-fredoka text-[#9b96b8] text-xl">Chargement...</p>
      </main>
    )
  }

  if (closedMsg) {
    return (
      <main className="min-h-screen bg-[#0f0e17] flex flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="font-fredoka text-[#ff6b6b] text-xl">{closedMsg}</p>
        <Link href="/multijoueur" className="bg-[#ffd93d] text-[#0f0e17] rounded-2xl py-3 px-8 font-fredoka text-lg">
          Retour au multijoueur
        </Link>
      </main>
    )
  }

  const podium = players.slice(0, 3)
  const rest = players.slice(3)

  return (
    <main className="min-h-screen bg-[#0f0e17]" style={{ padding: '100px 24px 80px' }}>
      <nav className="fixed top-0 left-0 right-0 flex justify-between items-center bg-[#0f0e17] border-b border-[#1e1c2e] z-10 px-4 md:px-8 py-4">
        <Link href="/" className="font-fredoka text-xl md:text-2xl">
          <span className="text-[#ff6b6b]">C</span><span className="text-[#ff9f43]">o</span><span className="text-[#ffd93d]">o</span><span className="text-[#6bcb77]">l</span><span className="text-[#4ecdc4]">o</span><span className="text-[#a78bfa]">s</span>
          <span className="text-[#c9c4e0]"> Quiz</span>
        </Link>
        {connecte && (
          <Link href="/profil" className="w-9 h-9 rounded-full bg-[#2a1f3d] border-2 border-[#a78bfa] flex items-center justify-center">
            <div className="w-4 h-4 rounded-full bg-[#a78bfa]"></div>
          </Link>
        )}
      </nav>

      <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>

        <div className="text-center">
          <p className="font-fredoka text-[#9b96b8] text-lg mb-2">Partie terminée !</p>
          <h2 className="font-fredoka text-4xl text-[#eeeaf8]">Classement final</h2>
        </div>

        {/* Podium */}
        {podium.length > 0 && (
          <div className="flex flex-col gap-3">
            {podium.map((p, i) => {
              const style = podiumStyle[i]
              return (
                <div
                  key={p.id}
                  className="rounded-2xl px-5 py-4 flex items-center justify-between"
                  style={{ background: style.bg, border: `2px solid ${style.color}` }}
                >
                  <div className="flex items-center gap-4">
                    <span className="font-fredoka text-2xl" style={{ color: style.color }}>{style.label}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-fredoka text-lg text-[#eeeaf8]">{p.pseudo}</span>
                        {p.user_id === myUserId && <span className="text-[#6b6880] text-xs">(toi)</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {p.is_guest && <span className="bg-[#2a2830] text-[#9b96b8] rounded-full px-2 py-0.5 text-xs font-fredoka">Invité</span>}
                        {p.status === 'abandonne' && <span className="bg-[#2e1a1a] text-[#ff6b6b] rounded-full px-2 py-0.5 text-xs font-fredoka">A quitté la partie</span>}
                      </div>
                    </div>
                  </div>
                  <span className="font-fredoka text-2xl" style={{ color: style.color }}>{p.score} / {totalQuestions}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Reste du classement */}
        {rest.length > 0 && (
          <div className="flex flex-col gap-2">
            {rest.map((p, i) => (
              <div key={p.id} className="bg-[#1a1828] border border-[#2a2830] rounded-xl px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-fredoka text-[#6b6880] w-6 text-right">{i + 4}</span>
                  <span className="font-fredoka text-[#eeeaf8] text-base">{p.pseudo}</span>
                  {p.user_id === myUserId && <span className="text-[#6b6880] text-xs">(toi)</span>}
                  {p.is_guest && <span className="bg-[#2a2830] text-[#9b96b8] rounded-full px-2 py-0.5 text-xs font-fredoka">Invité</span>}
                  {p.status === 'abandonne' && <span className="bg-[#2e1a1a] text-[#ff6b6b] rounded-full px-2 py-0.5 text-xs font-fredoka">A quitté la partie</span>}
                </div>
                <span className="font-fredoka text-[#c9c4e0] text-base">{p.score} / {totalQuestions}</span>
              </div>
            ))}
          </div>
        )}

        {!connecte && (
          <div className="bg-[#2a1f3d] border border-[#a78bfa] rounded-2xl p-5">
            <p className="font-fredoka text-[#a78bfa] text-lg mb-2">Sauvegarde ton score !</p>
            <p className="text-[#9b96b8] text-sm mb-4">Crée un compte gratuit pour garder ton historique et apparaître dans le classement général.</p>
            <Link href="/inscription" className="block w-full bg-[#a78bfa] text-[#0f0e17] rounded-2xl py-3 font-fredoka text-base text-center hover:opacity-90 transition">
              Créer un compte gratuit
            </Link>
          </div>
        )}

        <Link
          href="/multijoueur"
          className="w-full bg-[#ffd93d] text-[#0f0e17] rounded-2xl py-5 font-fredoka text-xl hover:opacity-90 transition text-center block"
        >
          Rejouer en multijoueur →
        </Link>

        <div className="flex gap-4">
          {connecte && (
            <Link href="/historique" className="flex-1 border border-[#3a3650] text-[#c9c4e0] rounded-2xl py-4 font-fredoka text-base text-center hover:bg-[#1e1c2e] transition">
              Mon historique
            </Link>
          )}
          <Link href="/classement" className="flex-1 border border-[#3a3650] text-[#c9c4e0] rounded-2xl py-4 font-fredoka text-base text-center hover:bg-[#1e1c2e] transition">
            Classement général
          </Link>
        </div>

        <Link href="/" className="block w-full text-center font-fredoka text-[#6b6880] text-base hover:text-[#9b96b8] transition py-2">
          Retour à l'accueil
        </Link>

      </div>
    </main>
  )
}

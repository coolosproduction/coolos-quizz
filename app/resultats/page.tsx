'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Resultats = {
  score: number
  scoreMax: number
  oui: number
  enPartie: number
  non: number
  questions: any[]
}

export default function Resultats() {
  const router = useRouter()
  const [mode, setMode] = useState<'inscrit' | 'invite'>('inscrit')
  const [resultats, setResultats] = useState<Resultats | null>(null)

  useEffect(() => {
    const data = sessionStorage.getItem('resultats_partie')
    if (!data) {
      router.push('/configuration')
      return
    }
    setResultats(JSON.parse(data))
  }, [])

  if (!resultats) {
    return (
      <main className="min-h-screen bg-[#0f0e17] flex items-center justify-center">
        <p className="font-fredoka text-[#9b96b8] text-xl">Chargement...</p>
      </main>
    )
  }

  const { score, scoreMax, oui, enPartie, non } = resultats
  const pct = Math.round((score / scoreMax) * 100)
  const circumference = 2 * Math.PI * 60
  const strokeDashoffset = circumference * (1 - pct / 100)
  const mention = pct >= 80 ? 'Excellent !' : pct >= 60 ? 'Très bien !' : pct >= 40 ? 'Pas mal !' : 'Continue !'
  const mentionColor = pct >= 80 ? '#6bcb77' : pct >= 60 ? '#ffd93d' : pct >= 40 ? '#ff9f43' : '#ff6b6b'

  return (
    <main className="min-h-screen bg-[#0f0e17]" style={{ padding: '32px 24px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>

        <div className="text-center">
          <p className="font-fredoka text-[#9b96b8] text-lg mb-4">Quiz terminé !</p>
          <div className="inline-flex bg-[#1a1828] rounded-xl p-1 gap-1 mb-6">
            <button
              onClick={() => setMode('inscrit')}
              className="px-5 py-2 rounded-lg font-fredoka text-sm"
              style={{ background: mode === 'inscrit' ? '#0f0e17' : 'transparent', color: mode === 'inscrit' ? '#eeeaf8' : '#9b96b8' }}
            >
              Inscrit
            </button>
            <button
              onClick={() => setMode('invite')}
              className="px-5 py-2 rounded-lg font-fredoka text-sm"
              style={{ background: mode === 'invite' ? '#0f0e17' : 'transparent', color: mode === 'invite' ? '#eeeaf8' : '#9b96b8' }}
            >
              Invité
            </button>
          </div>
        </div>

        {/* Cercle score */}
        <div className="flex flex-col items-center">
          <div className="relative" style={{ width: '160px', height: '160px' }}>
            <svg width="160" height="160" viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="80" cy="80" r="60" fill="none" stroke="#1e1c2e" strokeWidth="10"/>
              <circle
                cx="80" cy="80" r="60"
                fill="none"
                stroke="#ffd93d"
                strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-fredoka text-4xl text-[#eeeaf8]">{score}</span>
              <span className="font-fredoka text-sm text-[#6b6880]">/ {scoreMax}</span>
            </div>
          </div>
          <p className="font-fredoka text-3xl mt-4" style={{ color: mentionColor }}>{mention}</p>
          <p className="text-[#9b96b8] text-sm mt-1">Tu as répondu correctement à {pct}% des questions.</p>
        </div>

        {/* Détail des réponses */}
        <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl" style={{ padding: '10px 15px' }}>
          <p className="font-fredoka text-[#c9c4e0] text-lg mb-5">Détail des réponses</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-[#6bcb77] flex-shrink-0"></div>
              <span className="font-fredoka text-[#6bcb77] text-sm w-20">Oui</span>
              <div className="flex-1 bg-[#0f0e17] rounded-full" style={{ height: '8px' }}>
                <div className="rounded-full bg-[#6bcb77]" style={{ height: '8px', width: `${(oui / scoreMax) * 100}%` }}></div>
              </div>
              <span className="font-fredoka text-[#6bcb77] text-sm w-10 text-right">{oui}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-[#ffd93d] flex-shrink-0"></div>
              <span className="font-fredoka text-[#ffd93d] text-sm w-20">En partie</span>
              <div className="flex-1 bg-[#0f0e17] rounded-full" style={{ height: '8px' }}>
                <div className="rounded-full bg-[#ffd93d]" style={{ height: '8px', width: `${(enPartie / scoreMax) * 100}%` }}></div>
              </div>
              <span className="font-fredoka text-[#ffd93d] text-sm w-10 text-right">{enPartie}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-[#ff6b6b] flex-shrink-0"></div>
              <span className="font-fredoka text-[#ff6b6b] text-sm w-20">Non</span>
              <div className="flex-1 bg-[#0f0e17] rounded-full" style={{ height: '8px' }}>
                <div className="rounded-full bg-[#ff6b6b]" style={{ height: '8px', width: `${(non / scoreMax) * 100}%` }}></div>
              </div>
              <span className="font-fredoka text-[#ff6b6b] text-sm w-10 text-right">{non}</span>
            </div>
          </div>
        </div>

        {/* Récapitulatif config */}
        <div className="bg-[#1e1c2e] border border-[#2a2830] rounded-2xl flex flex-wrap gap-3" style={{ padding: '10px 15px' }}>
          <span className="bg-[#2a2830] rounded-full px-4 py-2 font-fredoka text-sm text-[#4ecdc4]">{scoreMax} questions</span>
          <span className="bg-[#2a2830] rounded-full px-4 py-2 font-fredoka text-sm text-[#6bcb77]">Score : {score} / {scoreMax}</span>
        </div>

        {mode === 'invite' && (
          <div className="bg-[#2a1f3d] border border-[#a78bfa] rounded-2xl p-5">
            <p className="font-fredoka text-[#a78bfa] text-lg mb-2">Sauvegarde ton score !</p>
            <p className="text-[#9b96b8] text-sm mb-4">Crée un compte gratuit pour garder ton historique et suivre ta progression.</p>
            <Link href="/inscription" className="block w-full bg-[#a78bfa] text-[#0f0e17] rounded-2xl py-3 font-fredoka text-base text-center hover:opacity-90 transition">
              Créer un compte gratuit
            </Link>
          </div>
        )}

        <button
          onClick={() => router.push('/configuration')}
          className="w-full bg-[#ffd93d] text-[#0f0e17] rounded-2xl py-5 font-fredoka text-xl hover:opacity-90 transition text-center"
        >
          Rejouer avec les mêmes paramètres
        </button>

        {mode === 'inscrit' && (
          <Link href="/historique" className="block w-full border border-[#3a3650] text-[#c9c4e0] rounded-2xl py-4 font-fredoka text-lg text-center hover:bg-[#1e1c2e] transition">
            Voir mon historique →
          </Link>
        )}

        <Link href="/configuration" className="block w-full text-center font-fredoka text-[#6b6880] text-base hover:text-[#9b96b8] transition py-2">
          Changer de config
        </Link>

      </div>
    </main>
  )
}
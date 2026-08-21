'use client'

import { Suspense } from 'react'
import Link from 'next/link'

function SuccesContent() {
  return (
    <main className="min-h-screen bg-[#0f0e17] flex flex-col items-center justify-center gap-6" style={{ padding: '32px 24px' }}>
      <p className="font-fredoka text-[#ffd93d] text-3xl text-center">Bienvenue dans Coolos Quiz Premium ★</p>
      <p className="text-[#9b96b8] text-sm text-center" style={{ maxWidth: '480px' }}>
        Ton abonnement est confirmé, le mois d'essai a commencé. L'activation peut prendre quelques
        secondes — recharge ton profil si tout n'apparaît pas immédiatement.
      </p>
      <Link
        href="/profil"
        className="rounded-2xl py-3 px-8 font-fredoka text-lg transition hover:opacity-90"
        style={{ background: '#a78bfa', color: '#0f0e17' }}
      >
        Voir mon profil
      </Link>
    </main>
  )
}

export default function PremiumSucces() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[#0f0e17] flex items-center justify-center">
        <p className="font-fredoka text-[#9b96b8] text-xl">Chargement...</p>
      </main>
    }>
      <SuccesContent />
    </Suspense>
  )
}

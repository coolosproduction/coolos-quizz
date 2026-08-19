'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import Spinner from '@/components/Spinner'

// Vides tant que le compte Google AdSense n'est pas créé/approuvé — voir .env.local.
// Une fois les vraies valeurs disponibles (dashboard AdSense), les renseigner ici
// ET dans les variables d'environnement du projet Vercel (Settings → Environment Variables).
// Le script de chargement AdSense lui-même est dans app/layout.tsx (chargé sur tout le
// site) — cette page ne fait que déclarer le bloc d'annonce et déclencher son affichage.
const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID
const ADSENSE_SLOT_INTERSTITIEL = process.env.NEXT_PUBLIC_ADSENSE_SLOT_INTERSTITIEL

export default function Pub() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [showAd, setShowAd] = useState(false)
  const adPushed = useRef(false)

  useEffect(() => {
    const data = sessionStorage.getItem('reponses_partie')
    if (!data) {
      router.push('/configuration')
      return
    }

    const check = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: premiumAccess } = await supabase.rpc('has_premium_access')
        if (premiumAccess) {
          // Les comptes premium (et admin) ne voient jamais de pub — on saute directement
          // à la correction sans jamais afficher de bloc d'annonce.
          router.push('/correction')
          return
        }
      }

      setShowAd(true)
      setLoading(false)
    }
    check()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!showAd || !ADSENSE_CLIENT_ID || !ADSENSE_SLOT_INTERSTITIEL || adPushed.current) return
    adPushed.current = true
    try {
      // @ts-expect-error - adsbygoogle est injecté globalement par le script Google (layout.tsx)
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch (e) {
      console.error('Erreur chargement pub:', e)
    }
  }, [showAd])

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0f0e17] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Spinner size={20} />
          <p className="font-fredoka text-[#9b96b8] text-xl">Chargement...</p>
        </div>
      </main>
    )
  }

  const adPrete = Boolean(ADSENSE_CLIENT_ID && ADSENSE_SLOT_INTERSTITIEL)

  return (
    <main className="min-h-screen bg-[#0f0e17] flex flex-col items-center justify-center gap-8" style={{ padding: '32px 24px' }}>
      <div style={{ maxWidth: '700px', width: '100%' }} className="flex flex-col items-center gap-6">
        <p className="font-fredoka text-[#9b96b8] text-sm text-center">Publicité</p>

        {adPrete ? (
          <ins
            className="adsbygoogle"
            style={{ display: 'block', width: '100%', minHeight: '250px' }}
            data-ad-client={ADSENSE_CLIENT_ID}
            data-ad-slot={ADSENSE_SLOT_INTERSTITIEL}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        ) : (
          <div
            className="w-full bg-[#1e1c2e] border border-[#2a2830] rounded-2xl flex items-center justify-center"
            style={{ minHeight: '250px' }}
          >
            <p className="font-fredoka text-[#3a3650] text-sm text-center" style={{ padding: '0 24px' }}>
              Emplacement publicitaire — à activer une fois le compte AdSense configuré
            </p>
          </div>
        )}

        <button
          onClick={() => router.push('/correction')}
          className="rounded-2xl py-4 px-10 font-fredoka text-lg transition hover:opacity-90"
          style={{ background: '#a78bfa', color: '#0f0e17' }}
        >
          Voir la correction →
        </button>
      </div>
    </main>
  )
}

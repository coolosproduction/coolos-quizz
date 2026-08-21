'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import BackButton from '@/components/BackButton'
import Spinner from '@/components/Spinner'

type Plan = 'mensuel' | 'annuel'

export default function Premium() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [dejaPremium, setDejaPremium] = useState(false)
  const [loadingPlan, setLoadingPlan] = useState<Plan | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    const check = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/connexion')
        return
      }

      const { data } = await supabase
        .from('users')
        .select('is_premium, role')
        .eq('id', user.id)
        .single()

      setDejaPremium(!!data?.is_premium || data?.role === 'admin' || data?.role === 'owner')
      setLoading(false)
    }
    check()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const choisirFormule = async (plan: Plan) => {
    setErreur(null)
    setLoadingPlan(plan)
    try {
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setErreur(data.error || "Impossible de démarrer le paiement, réessaie dans un instant.")
        setLoadingPlan(null)
      }
    } catch {
      setErreur("Impossible de démarrer le paiement, réessaie dans un instant.")
      setLoadingPlan(null)
    }
  }

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

  if (dejaPremium) {
    return (
      <main className="min-h-screen bg-[#0f0e17] flex flex-col items-center justify-center gap-6" style={{ padding: '32px 24px' }}>
        <p className="font-fredoka text-[#ffd93d] text-2xl text-center">Tu es déjà premium ★</p>
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

  return (
    <main className="min-h-screen bg-[#0f0e17]" style={{ padding: '32px 24px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div className="flex items-center gap-3 mb-10">
          <BackButton />
          <h1 className="font-fredoka text-2xl text-[#eeeaf8]">Devenir Premium</h1>
        </div>

        <p className="font-fredoka text-[#c9c4e0] text-lg text-center mb-2">
          Le premier mois est offert sur les deux formules
        </p>
        <p className="text-[#827f97] text-sm text-center mb-10">
          Sans engagement, résiliable à tout moment depuis ton profil.
        </p>

        <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>

          {/* Mensuel */}
          <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl flex flex-col gap-4" style={{ padding: '28px' }}>
            <p className="font-fredoka text-[#eeeaf8] text-xl">Mensuel</p>
            <p className="font-fredoka text-[#ffd93d] text-4xl">2,99€<span className="text-[#827f97] text-base font-sans">/mois</span></p>
            <ul className="text-[#9b96b8] text-sm flex flex-col gap-2" style={{ flexGrow: 1 }}>
              <li>★ Statistiques avancées & historique détaillé</li>
              <li>★ Modes "jamais vues" et "réviser mes erreurs"</li>
              <li>★ Fiches de révision personnelles</li>
              <li>★ Invitations d'amis en salon</li>
              <li>★ Aucune publicité</li>
            </ul>
            <button
              onClick={() => choisirFormule('mensuel')}
              disabled={loadingPlan !== null}
              className="rounded-2xl py-3 font-fredoka text-base transition hover:opacity-90"
              style={{
                background: '#ffd93d',
                color: '#0f0e17',
                cursor: loadingPlan !== null ? 'not-allowed' : 'pointer',
                opacity: loadingPlan !== null && loadingPlan !== 'mensuel' ? 0.5 : 1,
              }}
            >
              {loadingPlan === 'mensuel' ? 'Redirection...' : "Commencer l'essai gratuit"}
            </button>
          </div>

          {/* Annuel */}
          <div className="bg-[#1a1828] border rounded-2xl flex flex-col gap-4 relative" style={{ padding: '28px', borderColor: '#a78bfa' }}>
            <span
              className="font-fredoka text-xs absolute"
              style={{ top: '-12px', right: '20px', background: '#a78bfa', color: '#0f0e17', padding: '4px 12px', borderRadius: '9999px' }}
            >
              Plus avantageux
            </span>
            <p className="font-fredoka text-[#eeeaf8] text-xl">Annuel</p>
            <p className="font-fredoka text-[#ffd93d] text-4xl">24,99€<span className="text-[#827f97] text-base font-sans">/an</span></p>
            <p className="text-[#a78bfa] text-sm">Plus de 3 mois offerts vs. le mensuel</p>
            <ul className="text-[#9b96b8] text-sm flex flex-col gap-2" style={{ flexGrow: 1 }}>
              <li>★ Statistiques avancées & historique détaillé</li>
              <li>★ Modes "jamais vues" et "réviser mes erreurs"</li>
              <li>★ Fiches de révision personnelles</li>
              <li>★ Invitations d'amis en salon</li>
              <li>★ Aucune publicité</li>
            </ul>
            <button
              onClick={() => choisirFormule('annuel')}
              disabled={loadingPlan !== null}
              className="rounded-2xl py-3 font-fredoka text-base transition hover:opacity-90"
              style={{
                background: '#a78bfa',
                color: '#0f0e17',
                cursor: loadingPlan !== null ? 'not-allowed' : 'pointer',
                opacity: loadingPlan !== null && loadingPlan !== 'annuel' ? 0.5 : 1,
              }}
            >
              {loadingPlan === 'annuel' ? 'Redirection...' : "Commencer l'essai gratuit"}
            </button>
          </div>

        </div>

        {erreur && (
          <p className="font-fredoka text-[#ff6b6b] text-sm text-center mt-8">{erreur}</p>
        )}
      </div>
    </main>
  )
}

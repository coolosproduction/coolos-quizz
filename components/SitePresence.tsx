'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { trackSitePresence } from '@/lib/presence'

// Composant invisible monté une seule fois à la racine de l'app
// (app/layout.tsx) pour maintenir la présence en ligne à l'échelle du site —
// cf. lib/presence.js pour le mécanisme (Realtime Presence, comme les salons
// multijoueur). Rejoint/quitte le canal selon l'état de connexion réel
// (jamais pour une session invité anonyme), y compris en cours de session
// (connexion/déconnexion sans recharger la page).
export default function SitePresence() {
  useEffect(() => {
    const supabase = createClient()

    const applyAuthState = (user: { id: string, is_anonymous?: boolean } | null | undefined) => {
      if (user && !user.is_anonymous) {
        trackSitePresence(user.id)
      } else {
        trackSitePresence(null)
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      applyAuthState(session?.user ?? null)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      applyAuthState(session?.user ?? null)
    })

    return () => {
      sub.subscription.unsubscribe()
      // Pas de trackSitePresence(null) ici : ce composant ne démonte qu'à la
      // fermeture de l'onglet (monté à la racine du layout), Realtime coupe
      // alors la connexion tout seul.
    }
  }, [])

  return null
}

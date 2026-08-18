import { createClient } from './supabase'

// Présence en ligne à l'échelle du site — réutilise le même mécanisme que la
// présence de salon multijoueur (Supabase Realtime Presence, cf.
// subscribeRoomRealtime dans multiplayer.js) mais sur un unique canal partagé
// 'site_presence' plutôt que scopé à une salle. Suivi uniquement pour les
// comptes réels connectés (pas les invités anonymes, qui n'ont pas de liste
// d'amis). Entièrement éphémère (aucune table en base) : la présence
// disparaît dès la coupure de la connexion Realtime (fermeture d'onglet,
// perte réseau...), exactement comme la détection de déconnexion en salon.
//
// Singleton au niveau du module : un seul canal par onglet, rejoint une fois
// à la racine de l'app (cf. components/SitePresence.tsx monté dans
// app/layout.tsx) pour rester actif pendant toute la navigation plutôt que
// de rejoindre/quitter le canal à chaque changement de page.

let channel = null
let onlineIds = new Set()
const listeners = new Set()

function notifyListeners() {
  const snapshot = new Set(onlineIds)
  listeners.forEach(cb => cb(snapshot))
}

function syncFromChannel() {
  if (!channel) return
  const state = channel.presenceState()
  onlineIds = new Set(Object.keys(state))
  notifyListeners()
}

// Rejoint (ou change d'identité sur) le canal de présence global.
// userId === null quitte le canal (déconnexion, ou session invité).
export function trackSitePresence(userId) {
  const supabase = createClient()

  if (channel) {
    supabase.removeChannel(channel)
    channel = null
    onlineIds = new Set()
  }

  if (!userId) {
    notifyListeners()
    return
  }

  channel = supabase.channel('site_presence', { config: { presence: { key: userId } } })
  channel
    .on('presence', { event: 'sync' }, syncFromChannel)
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ at: Date.now() })
      }
    })
}

// Abonnement à la liste des ids en ligne (Set<string>). Appelle immédiatement
// le callback avec l'état courant, puis à chaque changement. Retourne une
// fonction de désabonnement.
export function onSitePresenceChange(callback) {
  listeners.add(callback)
  callback(new Set(onlineIds))
  return () => { listeners.delete(callback) }
}

export function isOnline(userId) {
  return onlineIds.has(userId)
}

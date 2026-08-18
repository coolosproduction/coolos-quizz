import { createClient } from './supabase'

const GUEST_SESSION_KEY = 'mp_guest_uid'
const GUEST_PSEUDO_KEY = 'invite_pseudo'

// Barème identique au solo (oui=1, en_partie=0.5, non=0), utilisé côté client
// pour l'affichage — le score qui compte vraiment est recalculé côté serveur
// (trigger _multiplayer_set_answer_points) et ne fait jamais confiance au client.
export const MP_POINTS = { oui: 1, en_partie: 0.5, non: 0 }

export const MP_DEFAULT_MAX_PLAYERS = 8
export const MP_DEFAULT_QUESTIONS_COUNT = 20
export const MP_DEFAULT_TIMER = 20

// Résout l'identité du joueur courant pour le multijoueur :
// - compte connecté -> son compte + pseudo réel (public.users)
// - invité -> session anonyme Supabase (auth.uid() cohérent avec les comptes
//   pour les policies RLS), recréée à chaque nouvelle visite (le marqueur vit
//   en sessionStorage, qui ne survit pas à la fermeture de l'onglet/navigateur,
//   contrairement au token Supabase qui lui est persisté en localStorage).
// pseudoSiInvite : pseudo à utiliser si une nouvelle session invité doit être créée.
export async function getMultiplayerIdentity(pseudoSiInvite) {
  const supabase = createClient()

  // getSession() (lecture locale de la session déjà persistée) plutôt que
  // getUser() (revalidation réseau contre le serveur) : juste après une
  // navigation côté client, getUser() peut renvoyer "pas de session" par
  // aléa de timing même pour un compte bien connecté, ce qui déclenchait à
  // tort la création d'une session invité et déconnectait le vrai compte.
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null

  if (user && !user.is_anonymous) {
    const { data: profile } = await supabase
      .from('users')
      .select('pseudo, avatar_url')
      .eq('id', user.id)
      .single()
    return { user, isGuest: false, pseudo: profile?.pseudo || 'Joueur', avatarUrl: profile?.avatar_url || null }
  }

  const marker = typeof window !== 'undefined' ? sessionStorage.getItem(GUEST_SESSION_KEY) : null

  if (user && user.is_anonymous && marker === user.id) {
    const pseudo = sessionStorage.getItem(GUEST_PSEUDO_KEY) || 'Invité'
    return { user, isGuest: true, pseudo, avatarUrl: null }
  }

  // Pas de session invité valide pour cette visite (aucune session, ou une
  // session anonyme périmée d'une visite précédente) : on en crée une nouvelle.
  if (user && user.is_anonymous) {
    await supabase.auth.signOut()
  }

  const { data, error } = await supabase.auth.signInAnonymously()
  if (error || !data.user) {
    throw error || new Error('Impossible de créer une session invité.')
  }

  const pseudo = (pseudoSiInvite || sessionStorage.getItem(GUEST_PSEUDO_KEY) || 'Invité').trim().slice(0, 20) || 'Invité'
  sessionStorage.setItem(GUEST_SESSION_KEY, data.user.id)
  sessionStorage.setItem(GUEST_PSEUDO_KEY, pseudo)
  sessionStorage.setItem('is_invite', 'true')

  return { user: data.user, isGuest: true, pseudo, avatarUrl: null }
}

// Abonnement temps réel partagé par toutes les pages d'une salle multijoueur :
// - postgres_changes sur multiplayer_games (avancement de question, changement
//   de phase, transfert de host...) et multiplayer_players (arrivées/départs) ;
// - Présence Realtime pour détecter les déconnexions en direct (dès qu'un
//   client remarque le départ d'un autre, il appelle handle_player_left_presence
//   — idempotent, donc sans risque si plusieurs clients le font en même temps) ;
// - un balayage périodique (sweep_room) qui rattrape les abandons même si
//   l'évènement de présence a été manqué (crash d'onglet, coupure réseau...).
// Retourne une fonction de nettoyage à appeler au démontage du composant.
// onAnswersChange est optionnel : seules les pages qui en ont besoin (la
// correction) paient le coût de cet abonnement supplémentaire.
export function subscribeRoomRealtime(supabase, { gameId, myUserId, onGameChange, onPlayersChange, onAnswersChange }) {
  const channel = supabase.channel(`multiplayer_room_${gameId}`, {
    config: { presence: { key: myUserId } },
  })

  channel
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'multiplayer_games', filter: `id=eq.${gameId}` }, (payload) => {
      onGameChange && onGameChange(payload.new)
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'multiplayer_players', filter: `game_id=eq.${gameId}` }, (payload) => {
      onPlayersChange && onPlayersChange(payload)
    })

  if (onAnswersChange) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'multiplayer_answers', filter: `game_id=eq.${gameId}` }, (payload) => {
      onAnswersChange(payload)
    })
  }

  channel
    .on('presence', { event: 'leave' }, ({ key }) => {
      supabase.rpc('handle_player_left_presence', { p_game_id: gameId, p_left_user_id: key })
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ at: Date.now() })
        supabase.rpc('handle_player_reconnected', { p_game_id: gameId })
      }
    })

  const sweepInterval = setInterval(() => {
    supabase.rpc('sweep_room', { p_game_id: gameId })
  }, 5000)

  return () => {
    clearInterval(sweepInterval)
    supabase.removeChannel(channel)
  }
}

// Détecte qu'une nouvelle partie vient d'être créée sur ce code — typiquement
// suite à un "Rejouer" déclenché par un autre joueur resté sur cette page.
// N'est utilisé que par la page résultats, qui n'a sinon aucun abonnement
// temps réel (les autres pages suivent déjà leur propre partie via
// subscribeRoomRealtime). currentGameId sert juste à s'auto-ignorer si
// l'évènement concerne la partie qu'on affiche déjà.
export function subscribeNewGameOnCode(supabase, { code, currentGameId, onNewGame }) {
  const channel = supabase.channel(`multiplayer_code_watch_${code}`)
  channel
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'multiplayer_games', filter: `code=eq.${code}` }, (payload) => {
      if (payload.new.id !== currentGameId) onNewGame && onNewGame(payload.new)
    })
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}

// Redirige vers la bonne page selon la phase d'une partie (utilisé quand on
// atterrit sur une page de salle qui ne correspond plus à la phase actuelle,
// ex: lien direct, retour en arrière, reconnexion tardive).
export function roomPathForStatus(status, code) {
  switch (status) {
    case 'attente': return `/multijoueur/salle/${code}`
    case 'en_cours': return `/multijoueur/quiz/${code}`
    case 'correction': return `/multijoueur/correction/${code}`
    case 'terminee': return `/multijoueur/resultats/${code}`
    default: return null
  }
}

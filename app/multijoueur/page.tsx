'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import { getMultiplayerIdentity, MP_DEFAULT_MAX_PLAYERS, MP_DEFAULT_QUESTIONS_COUNT, MP_DEFAULT_TIMER } from '../../lib/multiplayer'
import BackButton from '@/components/BackButton'
import Avatar from '@/components/Avatar'

const difficultes = [
  { id: 'facile', label: 'Facile', color: '#6bcb77', bg: '#1a2e1f' },
  { id: 'moyen', label: 'Moyen', color: '#ffd93d', bg: '#1f1e10' },
  { id: 'difficile', label: 'Difficile', color: '#ff6b6b', bg: '#2e1a1a' },
  { id: 'hardcore', label: 'Hardcore', color: '#a78bfa', bg: '#2a1f3d' },
]

const nbQuestions = [10, 20, 30, 40, 50]
const timers = [10, 15, 20, 30, 45, 60]

const themeColors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4ecdc4', '#a78bfa', '#ff9f43']
const themeBgs = ['#2d1f1f', '#1f1e10', '#1a2e1f', '#1a2a2d', '#2a1f3d', '#2d2010']

type Category = { id: string, name: string, color: string, bg: string }

export default function Multijoueur() {
  const router = useRouter()
  const [mode, setMode] = useState<'creer' | 'rejoindre'>('creer')

  const [connecte, setConnecte] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [pseudo, setPseudo] = useState('')
  const [maxPlayersAllowed, setMaxPlayersAllowed] = useState(MP_DEFAULT_MAX_PLAYERS)

  const [themes, setThemes] = useState<Category[]>([])
  const [themesSelec, setThemesSelec] = useState<string[]>([])
  const [diffSelec, setDiffSelec] = useState<string[]>([])
  const [nb, setNb] = useState(MP_DEFAULT_QUESTIONS_COUNT)
  const [timer, setTimer] = useState(MP_DEFAULT_TIMER)

  const [joinCode, setJoinCode] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setConnecte(!!user && !user.is_anonymous)
      setCheckingAuth(false)

      // Le plafond réel est de toute façon imposé côté serveur (trigger sur
      // multiplayer_games, jamais la valeur envoyée par le client) — cet
      // appel ne sert qu'à afficher le bon chiffre avant la création.
      if (user) {
        const { data: premiumAccess } = await supabase.rpc('has_premium_access')
        setMaxPlayersAllowed(premiumAccess ? 16 : MP_DEFAULT_MAX_PLAYERS)
      }

      const { data: catsData } = await supabase
        .from('categories')
        .select('id, name')
        .eq('active', true)
        .order('name')
      if (catsData) {
        setThemes(catsData.map((c, i) => ({
          id: c.id,
          name: c.name,
          color: themeColors[i % themeColors.length],
          bg: themeBgs[i % themeBgs.length],
        })))
      }
    }
    load()
  }, [])

  const toggleTheme = (id: string) => {
    setThemesSelec(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
  }
  const toggleDiff = (id: string) => {
    setDiffSelec(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id])
  }

  const handleCreer = async () => {
    setError('')
    if (!connecte && !pseudo.trim()) {
      setError('Choisis un pseudo pour créer une salle.')
      return
    }
    setLoading(true)
    try {
      const identity = await getMultiplayerIdentity(pseudo)
      const supabase = createClient()

      const categoryIds = themesSelec.length === 0 ? themes.map(t => t.id) : themesSelec
      const difficulty = diffSelec.length === 0 ? ['facile', 'moyen', 'difficile', 'hardcore'] : diffSelec

      const config = {
        category_ids: categoryIds,
        difficulty,
        subcategory_ids: [],
        questions_count: nb,
        timer_duration: timer,
      }

      const { data: game, error: gameError } = await supabase
        .from('multiplayer_games')
        .insert({ host_id: identity.user.id, config, max_players: MP_DEFAULT_MAX_PLAYERS })
        .select('id, code')
        .single()

      if (gameError || !game) {
        setError("Impossible de créer la salle. Réessaie.")
        setLoading(false)
        return
      }

      const { error: playerError } = await supabase
        .from('multiplayer_players')
        .insert({
          game_id: game.id,
          user_id: identity.user.id,
          is_guest: identity.isGuest,
          pseudo: identity.pseudo,
          avatar_url: identity.avatarUrl,
        })

      if (playerError) {
        setError("Impossible de rejoindre ta propre salle. Réessaie.")
        setLoading(false)
        return
      }

      router.push(`/multijoueur/salle/${game.code}`)
    } catch (e) {
      setError("Une erreur est survenue. Réessaie.")
      setLoading(false)
    }
  }

  const handleRejoindre = async () => {
    setError('')
    const code = joinCode.trim().toUpperCase()
    if (code.length < 4) {
      setError('Entre le code de la salle.')
      return
    }
    if (!connecte && !pseudo.trim()) {
      setError('Choisis un pseudo pour rejoindre la salle.')
      return
    }
    setLoading(true)
    try {
      const identity = await getMultiplayerIdentity(pseudo)
      const supabase = createClient()

      const { data: game, error: findError } = await supabase
        .from('multiplayer_games')
        .select('id, code, status')
        .eq('code', code)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (findError || !game) {
        setError('Aucune salle en attente avec ce code.')
        setLoading(false)
        return
      }

      if (game.status !== 'attente') {
        setError("Cette partie a déjà commencé ou s'est terminée.")
        setLoading(false)
        return
      }

      const { data: existingPlayer } = await supabase
        .from('multiplayer_players')
        .select('id')
        .eq('game_id', game.id)
        .eq('user_id', identity.user.id)
        .maybeSingle()

      if (!existingPlayer) {
        const { error: joinError } = await supabase
          .from('multiplayer_players')
          .insert({
            game_id: game.id,
            user_id: identity.user.id,
            is_guest: identity.isGuest,
            pseudo: identity.pseudo,
            avatar_url: identity.avatarUrl,
          })

        if (joinError) {
          setError('Cette salle est complète, ou la partie vient de démarrer.')
          setLoading(false)
          return
        }
      }

      router.push(`/multijoueur/salle/${game.code}`)
    } catch (e) {
      setError("Une erreur est survenue. Réessaie.")
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#0f0e17]" style={{ padding: '32px 24px 80px' }}>

      <nav className="flex justify-between items-center mb-12">
        <div className="flex items-center gap-3">
          <BackButton />
          <Link href="/" className="font-fredoka text-2xl">
            <span className="text-[#ff6b6b]">C</span>
            <span className="text-[#ff9f43]">o</span>
            <span className="text-[#ffd93d]">o</span>
            <span className="text-[#6bcb77]">l</span>
            <span className="text-[#4ecdc4]">o</span>
            <span className="text-[#a78bfa]">s</span>
            <span className="text-[#c9c4e0]"> Quiz</span>
          </Link>
        </div>
        {!checkingAuth && connecte && (
          <Link href="/profil">
            <Avatar url={null} size={40} border="accent" />
          </Link>
        )}
      </nav>

      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>

        <div>
          <h2 className="font-fredoka text-4xl text-[#eeeaf8] mb-4">Multijoueur</h2>
          <p className="text-[#9b96b8] text-base">Joue en direct avec tes amis, jusqu'à {maxPlayersAllowed} par salle.</p>
          {connecte && maxPlayersAllowed === MP_DEFAULT_MAX_PLAYERS && (
            <p className="text-[#ffd93d] text-sm mt-1">★ Passe premium pour aller jusqu'à 16 joueurs par salle.</p>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-3 bg-[#1a1828] border border-[#2a2830] rounded-2xl p-2" style={{ width: 'fit-content' }}>
          <button
            onClick={() => { setMode('creer'); setError('') }}
            className="rounded-xl px-6 py-3 font-fredoka text-base transition"
            style={{
              background: mode === 'creer' ? '#ffd93d' : 'transparent',
              color: mode === 'creer' ? '#0f0e17' : '#9b96b8',
            }}
          >
            Créer une salle
          </button>
          <button
            onClick={() => { setMode('rejoindre'); setError('') }}
            className="rounded-xl px-6 py-3 font-fredoka text-base transition"
            style={{
              background: mode === 'rejoindre' ? '#4ecdc4' : 'transparent',
              color: mode === 'rejoindre' ? '#0f0e17' : '#9b96b8',
            }}
          >
            Rejoindre une salle
          </button>
        </div>

        {!checkingAuth && !connecte && (
          <div>
            <p className="font-fredoka text-[#c9c4e0] text-lg mb-3">Ton pseudo</p>
            <input
              type="text"
              placeholder="Ton pseudo pour cette partie..."
              value={pseudo}
              onChange={e => setPseudo(e.target.value)}
              maxLength={20}
              className="w-full bg-[#1a1828] border border-[#3a3650] rounded-xl px-4 py-3 text-[#eeeaf8] font-fredoka outline-none focus:border-[#a78bfa] transition"
              style={{ maxWidth: '400px' }}
            />
            <p className="text-[#6b6880] text-xs mt-2">
              Tu joues sans compte : ta partie ne sera pas sauvegardée dans un historique.{' '}
              <Link href="/connexion" className="text-[#a78bfa]">Se connecter</Link>
            </p>
          </div>
        )}

        {error && (
          <div className="bg-[#2e1a1a] border border-[#ff6b6b] rounded-xl px-4 py-3">
            <p className="text-[#ff6b6b] text-sm">{error}</p>
          </div>
        )}

        {mode === 'creer' ? (
          <>
            {/* Thèmes */}
            <div>
              <p className="font-fredoka text-[#c9c4e0] text-xl mb-4">Thèmes</p>
              <div className="flex flex-wrap gap-3">
                {themes.map(t => (
                  <button
                    key={t.id}
                    onClick={() => toggleTheme(t.id)}
                    className="font-fredoka text-sm rounded-xl px-4 py-3"
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
                <p className="text-[#6b6880] text-sm mt-2">Aucune sélection = tous les thèmes inclus</p>
              )}
            </div>

            {/* Difficulté */}
            <div>
              <p className="font-fredoka text-[#c9c4e0] text-xl mb-4">Difficulté</p>
              <div className="flex gap-4 flex-wrap">
                {difficultes.map(d => (
                  <button
                    key={d.id}
                    onClick={() => toggleDiff(d.id)}
                    className="rounded-xl py-4 px-6 font-fredoka text-base"
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
                <p className="text-[#6b6880] text-sm mt-2">Aucune sélection = toutes les difficultés incluses</p>
              )}
            </div>

            {/* Nombre de questions */}
            <div>
              <p className="font-fredoka text-[#c9c4e0] text-xl mb-4">Nombre de questions</p>
              <div className="flex gap-4">
                {nbQuestions.map(n => (
                  <button
                    key={n}
                    onClick={() => setNb(n)}
                    className="flex-1 rounded-xl py-4 font-fredoka text-lg"
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

            {/* Timer */}
            <div>
              <p className="font-fredoka text-[#c9c4e0] text-xl mb-4">Temps par question</p>
              <div className="flex gap-3">
                {timers.map(t => (
                  <button
                    key={t}
                    onClick={() => setTimer(t)}
                    className="flex-1 rounded-xl py-4 font-fredoka text-base"
                    style={{
                      background: timer === t ? '#2a1e10' : '#1a1828',
                      border: `2px solid ${timer === t ? '#ff9f43' : '#2a2830'}`,
                      color: timer === t ? '#ff9f43' : '#9b96b8',
                    }}
                  >
                    {t}<div className="text-sm font-sans opacity-60">sec</div>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleCreer}
              disabled={loading}
              className="block w-full bg-[#ffd93d] text-[#0f0e17] rounded-2xl py-5 font-fredoka text-2xl hover:opacity-90 transition text-center disabled:opacity-50"
            >
              {loading ? 'Création...' : 'Créer la salle →'}
            </button>
          </>
        ) : (
          <div className="flex flex-col gap-6" style={{ maxWidth: '400px' }}>
            <div>
              <p className="font-fredoka text-[#c9c4e0] text-lg mb-3">Code de la salle</p>
              <input
                type="text"
                placeholder="EX: COOL42"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleRejoindre()}
                maxLength={8}
                className="w-full bg-[#1a1828] border border-[#3a3650] rounded-xl px-4 py-4 text-[#eeeaf8] font-fredoka text-2xl text-center tracking-widest outline-none focus:border-[#4ecdc4] transition"
              />
            </div>
            <button
              onClick={handleRejoindre}
              disabled={loading}
              className="block w-full bg-[#4ecdc4] text-[#0f0e17] rounded-2xl py-5 font-fredoka text-2xl hover:opacity-90 transition text-center disabled:opacity-50"
            >
              {loading ? 'Connexion...' : 'Rejoindre →'}
            </button>
          </div>
        )}

      </div>
    </main>
  )
}

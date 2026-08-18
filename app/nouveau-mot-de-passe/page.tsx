'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import BackButton from '@/components/BackButton'
import Spinner from '@/components/Spinner'

// Page de destination du lien envoyé par /mot-de-passe-oublie
// (resetPasswordForEmail redirige ici). Le client Supabase détecte
// automatiquement la session de récupération présente dans l'URL au
// chargement — on attend juste qu'elle soit posée avant d'autoriser le
// formulaire, plutôt que de suivre un minuteur arbitraire.
export default function NouveauMotDePasse() {
  const router = useRouter()
  const [checkingLink, setCheckingLink] = useState(true)
  const [linkValide, setLinkValide] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    // Le lien de récupération déclenche l'évènement PASSWORD_RECOVERY dès
    // que le client a fini de parser l'URL — c'est le signal fiable plutôt
    // qu'une simple vérification de session (qui pourrait aussi être vraie
    // si la personne était déjà connectée par ailleurs).
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setLinkValide(true)
        setCheckingLink(false)
      }
    })

    // Filet de sécurité : si l'évènement a déjà été émis avant que ce
    // composant ne s'abonne (montage un peu tardif), on vérifie aussi la
    // session actuelle une fois.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setLinkValide(true)
      }
      setCheckingLink(false)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const handleValider = async () => {
    if (loading) return
    setError('')
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.')
      return
    }
    if (password !== confirmation) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setLoading(false)
      setError("Impossible de mettre à jour le mot de passe. Le lien a peut-être expiré — redemande-en un nouveau.")
      return
    }
    // On déconnecte la session de récupération pour repartir sur une
    // connexion normale avec le nouveau mot de passe, plutôt que de
    // laisser une session "spéciale" active sans que la personne l'ait
    // choisi.
    await supabase.auth.signOut()
    setLoading(false)
    setDone(true)
    setTimeout(() => router.push('/connexion'), 2000)
  }

  return (
    <main className="min-h-screen bg-[#0f0e17] flex flex-col items-center justify-center px-6 py-12">

      <div className="flex items-center gap-3 mb-8">
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

      <div className="w-full max-w-md bg-[#1a1828] border border-[#2a2830] rounded-2xl coolos-card-transition" style={{ padding: '40px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

        {checkingLink ? (
          <div className="flex flex-col items-center gap-3" style={{ padding: '24px 0' }}>
            <Spinner size={20} />
            <p className="text-[#9b96b8] text-sm">Vérification du lien...</p>
          </div>
        ) : !linkValide ? (
          <>
            <h2 className="font-fredoka text-2xl text-[#eeeaf8] mb-2 text-center">
              Lien <span className="text-[#ff6b6b]">invalide ou expiré</span>
            </h2>
            <p className="text-[#9b96b8] text-sm mb-8 text-center">
              Ce lien de réinitialisation n'est plus valable. Demande-en un nouveau.
            </p>
            <Link
              href="/mot-de-passe-oublie"
              className="block w-full bg-[#a78bfa] text-[#0f0e17] rounded-2xl py-4 font-fredoka text-xl hover:opacity-90 transition text-center"
            >
              Redemander un lien
            </Link>
          </>
        ) : done ? (
          <>
            <div className="w-16 h-16 bg-[#1a2e1f] border border-[#1f3a28] rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <div className="w-8 h-8 rounded-full bg-[#6bcb77]"></div>
            </div>
            <h2 className="font-fredoka text-3xl text-[#eeeaf8] mb-2 text-center">
              Mot de passe <span className="text-[#6bcb77]">mis à jour !</span>
            </h2>
            <p className="text-[#9b96b8] text-sm text-center">
              Redirection vers la connexion...
            </p>
          </>
        ) : (
          <>
            <h2 className="font-fredoka text-3xl text-[#eeeaf8] mb-2 text-center">
              Nouveau <span className="text-[#a78bfa]">mot de passe</span>
            </h2>
            <p className="text-[#9b96b8] text-sm mb-8 text-center">
              Choisis un nouveau mot de passe pour ton compte.
            </p>

            {error && (
              <div className="bg-[#2e1a1a] border border-[#ff6b6b] rounded-xl px-4 py-3 mb-6">
                <p className="text-[#ff6b6b] text-sm">{error}</p>
              </div>
            )}

            <div className="mb-5">
              <label className="block font-fredoka text-[#9b96b8] text-sm mb-2">Nouveau mot de passe</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0f0e17] border border-[#2a2830] rounded-xl px-4 py-3 text-[#eeeaf8] font-fredoka text-sm focus:outline-none focus:border-[#a78bfa] transition placeholder-[#8480a1]"
              />
            </div>

            <div className="mb-8">
              <label className="block font-fredoka text-[#9b96b8] text-sm mb-2">Confirmer le mot de passe</label>
              <input
                type="password"
                placeholder="••••••••"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleValider()}
                className="w-full bg-[#0f0e17] border border-[#2a2830] rounded-xl px-4 py-3 text-[#eeeaf8] font-fredoka text-sm focus:outline-none focus:border-[#a78bfa] transition placeholder-[#8480a1]"
              />
            </div>

            <button
              onClick={handleValider}
              disabled={loading || !password || !confirmation}
              className="flex items-center justify-center gap-2 w-full bg-[#a78bfa] text-[#0f0e17] rounded-2xl py-4 font-fredoka text-xl enabled:hover:opacity-90 transition text-center disabled:opacity-60"
            >
              {loading && <Spinner size={18} color="#0f0e17" />}
              {loading ? 'Mise à jour...' : 'Valider le nouveau mot de passe'}
            </button>
          </>
        )}

      </div>

    </main>
  )
}

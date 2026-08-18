'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import BackButton from '@/components/BackButton'
import Spinner from '@/components/Spinner'

export default function Inscription() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pseudo, setPseudo] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleInscription = async () => {
    setError('')
    if (!pseudo) {
      setError('Le pseudo est obligatoire.')
      return
    }
    if (password.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caractères.')
      return
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { pseudo }
      }
    })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    if (signUpData.user) {
      await supabase.from('users').insert({
        id: signUpData.user.id,
        email,
        pseudo,
        role: 'user',
      })
    }
    router.push('/')
  }

  return (
    <main className="min-h-screen bg-[#0f0e17] flex flex-col items-center justify-center px-6 py-12">

      {/* Logo */}
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

      {/* Card */}
      <div className="w-full max-w-md bg-[#1a1828] border border-[#2a2830] rounded-2xl" style={{ padding: '32px' }}>

        <h2 className="font-fredoka text-3xl text-[#eeeaf8] mb-2">Crée ton compte !</h2>
        <p className="text-[#9b96b8] text-sm mb-8">Rejoins Coolos Quiz et commence à jouer.</p>

        {error && (
          <div className="bg-[#2e1a1a] border border-[#ff6b6b] rounded-xl px-4 py-3 mb-6">
            <p className="text-[#ff6b6b] text-sm">{error}</p>
          </div>
        )}

        {/* Pseudo */}
        <div className="mb-5">
          <label className="block font-fredoka text-[#9b96b8] text-sm mb-2">Pseudo</label>
          <input
            type="text"
            placeholder="Ton pseudo..."
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            className="w-full bg-[#0f0e17] border border-[#2a2830] rounded-xl px-4 py-3 text-[#eeeaf8] font-fredoka text-sm focus:outline-none focus:border-[#a78bfa] transition placeholder-[#8480a1]"
          />
        </div>

        {/* Email */}
        <div className="mb-5">
          <label className="block font-fredoka text-[#9b96b8] text-sm mb-2">Adresse email</label>
          <input
            type="email"
            placeholder="ton@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-[#0f0e17] border border-[#2a2830] rounded-xl px-4 py-3 text-[#eeeaf8] font-fredoka text-sm focus:outline-none focus:border-[#a78bfa] transition placeholder-[#8480a1]"
          />
        </div>

        {/* Mot de passe */}
        <div className="mb-5">
          <label className="block font-fredoka text-[#9b96b8] text-sm mb-2">Mot de passe</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-[#0f0e17] border border-[#2a2830] rounded-xl px-4 py-3 text-[#eeeaf8] font-fredoka text-sm focus:outline-none focus:border-[#a78bfa] transition placeholder-[#8480a1]"
          />
          {/* Règles */}
          <div className="bg-[#0f0e17] rounded-xl p-3 mt-2">
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-2 h-2 rounded-full ${password.length >= 8 ? 'bg-[#6bcb77]' : 'bg-[#3a3650]'}`}></div>
              <span className="text-xs text-[#827f97]">Au moins 8 caractères</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-2 h-2 rounded-full ${/[A-Z]/.test(password) ? 'bg-[#6bcb77]' : 'bg-[#3a3650]'}`}></div>
              <span className="text-xs text-[#827f97]">Une majuscule</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${/[0-9]/.test(password) ? 'bg-[#6bcb77]' : 'bg-[#3a3650]'}`}></div>
              <span className="text-xs text-[#827f97]">Un chiffre</span>
            </div>
          </div>
        </div>

        {/* Confirmer */}
        <div className="mb-8">
          <label className="block font-fredoka text-[#9b96b8] text-sm mb-2">Confirmer le mot de passe</label>
          <input
            type="password"
            placeholder="••••••••"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full bg-[#0f0e17] border border-[#2a2830] rounded-xl px-4 py-3 text-[#eeeaf8] font-fredoka text-sm focus:outline-none focus:border-[#a78bfa] transition placeholder-[#8480a1]"
          />
          {confirm && password !== confirm && (
            <p className="text-[#ff6b6b] text-xs mt-2">Les mots de passe ne correspondent pas.</p>
          )}
        </div>

        {/* Bouton */}
        <button
          onClick={handleInscription}
          disabled={loading}
          className="flex items-center justify-center gap-2 w-full bg-[#ff6b6b] text-white rounded-2xl py-4 font-fredoka text-xl hover:opacity-90 transition disabled:opacity-60 text-center mb-6"
        >
          {loading && <Spinner size={18} color="#ffffff" />}
          {loading ? 'Création en cours...' : 'Créer mon compte'}
        </button>

        {/* Lien connexion */}
        <p className="text-center text-[#9b96b8] text-sm">
          Déjà un compte ?{' '}
          <Link href="/connexion" className="text-[#ffd93d] font-fredoka">
            Se connecter →
          </Link>
        </p>

      </div>

      <p className="mt-8 text-[#827f97] text-xs text-center">
        En créant un compte, tu acceptes les CGU · Politique de confidentialité
      </p>

    </main>
  )
}
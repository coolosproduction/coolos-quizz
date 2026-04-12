'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'

export default function Connexion() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleConnexion = async () => {
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { data: signInData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) {
      setError('Email ou mot de passe incorrect.')
      setLoading(false)
      return
    }

    if (signInData.user) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('id', signInData.user.id)
        .single()

      if (!existingUser) {
        const pseudo = signInData.user.user_metadata?.pseudo || email.split('@')[0]
        await supabase.from('users').insert({
          id: signInData.user.id,
          email,
          pseudo,
          role: 'user',
        })
      }
    }

    router.push('/configuration')
  }

  return (
    <main className="min-h-screen bg-[#0f0e17] flex flex-col items-center justify-center px-6 py-12">

      {/* Logo */}
      <Link href="/" className="font-fredoka text-2xl mb-8">
        <span className="text-[#ff6b6b]">C</span>
        <span className="text-[#ff9f43]">o</span>
        <span className="text-[#ffd93d]">o</span>
        <span className="text-[#6bcb77]">l</span>
        <span className="text-[#4ecdc4]">o</span>
        <span className="text-[#a78bfa]">s</span>
        <span className="text-[#c9c4e0]"> Quiz</span>
      </Link>

      {/* Card */}
      <div className="w-full max-w-md bg-[#1a1828] border border-[#2a2830] rounded-2xl" style={{ padding: '20px' }}>

        <h2 className="font-fredoka text-3xl text-[#eeeaf8] mb-2">Bon retour <span className="text-[#4ecdc4]">par ici !</span></h2>
        <p className="text-[#9b96b8] text-sm mb-8">Connecte-toi pour retrouver tes parties et continuer à jouer.</p>

        {error && (
          <div className="bg-[#2e1a1a] border border-[#ff6b6b] rounded-xl px-4 py-3 mb-6">
            <p className="text-[#ff6b6b] text-sm">{error}</p>
          </div>
        )}

        {/* Email */}
        <div className="mb-5">
          <label className="block font-fredoka text-[#9b96b8] text-sm mb-2">Adresse email</label>
          <input
            type="email"
            placeholder="ton@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-[#0f0e17] border border-[#3a3650] rounded-xl px-4 py-3 text-[#eeeaf8] text-sm outline-none focus:border-[#4ecdc4] transition"
          />
        </div>

        {/* Mot de passe */}
        <div className="mb-2">
          <label className="block font-fredoka text-[#9b96b8] text-sm mb-2">Mot de passe</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-[#0f0e17] border border-[#3a3650] rounded-xl px-4 py-3 text-[#eeeaf8] text-sm outline-none focus:border-[#4ecdc4] transition"
          />
        </div>

        {/* Mot de passe oublié */}
        <div className="flex justify-end mb-8">
          <Link href="/mot-de-passe-oublie" className="font-fredoka text-[#a78bfa] text-sm hover:opacity-80 transition">
            Mot de passe oublié ?
          </Link>
        </div>

        {/* Bouton */}
        <button
          onClick={handleConnexion}
          disabled={loading}
          className="block w-full bg-[#4ecdc4] text-[#0f0e17] rounded-2xl py-4 font-fredoka text-xl hover:opacity-90 transition text-center mb-6"
        >
          {loading ? 'Connexion en cours...' : 'Se connecter'}
        </button>

        {/* Lien inscription */}
        <p className="text-center text-[#9b96b8] text-sm">
          Pas encore de compte ?{' '}
          <Link href="/inscription" className="text-[#ffd93d] font-fredoka">
            Créer un compte gratuit →
          </Link>
        </p>

      </div>

    </main>
  )
}
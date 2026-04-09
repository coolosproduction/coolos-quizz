'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function MotDePasseOublie() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

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
      <div className="w-full max-w-md bg-[#1a1828] border border-[#2a2830] rounded-2xl" style={{ padding: '65px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

        {!sent ? (
          <>
            {/* Étape 1 — formulaire */}
            <div className="w-16 h-16 bg-[#1e1c2e] border border-[#2a2830] rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <div className="w-8 h-6 bg-[#2a2830] rounded relative">
                <div className="w-3 h-3 rounded-full bg-[#a78bfa] absolute -bottom-1 -right-1 border-2 border-[#1a1828]"></div>
              </div>
            </div>

            <h2 className="font-fredoka text-3xl text-[#eeeaf8] mb-2 text-center">
              Mot de passe <span className="text-[#a78bfa]">oublié ?</span>
            </h2>
            <p className="text-[#9b96b8] text-sm mb-8 text-center">
              Pas de panique ! Entre ton email et on t'envoie un lien pour le réinitialiser.
            </p>

            <div className="mb-6">
              <label className="block font-fredoka text-[#9b96b8] text-sm mb-2">Adresse email</label>
              <input
                type="email"
                placeholder="ton@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#0f0e17] border border-[#3a3650] rounded-xl px-4 py-3 text-[#eeeaf8] text-sm outline-none focus:border-[#a78bfa] transition"
              />
              <p className="text-[#6b6880] text-xs mt-2">Tu recevras un lien valable 1 heure.</p>
            </div>

            <button
              onClick={() => setSent(true)}
              className="block w-full bg-[#a78bfa] text-[#0f0e17] rounded-2xl py-4 font-fredoka text-xl hover:opacity-90 transition text-center mb-4"
            >
              Envoyer le lien
            </button>

            <Link
              href="/connexion"
              className="block w-full border border-[#3a3650] text-[#c9c4e0] rounded-2xl py-3 font-fredoka text-base hover:bg-[#1e1c2e] transition text-center"
            >
              ← Retour à la connexion
            </Link>
          </>
        ) : (
          <>
            {/* Étape 2 — confirmation */}
            <div className="w-16 h-16 bg-[#1a2e1f] border border-[#1f3a28] rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <div className="w-8 h-8 rounded-full bg-[#6bcb77] flex items-center justify-center">
                <div className="w-0 h-0 border-l-4 border-r-4 border-t-6 border-l-transparent border-r-transparent border-t-[#0f0e17]" style={{ borderTopWidth: '10px', borderTopColor: '#0f0e17' }}></div>
              </div>
            </div>

            <h2 className="font-fredoka text-3xl text-[#eeeaf8] mb-2 text-center">
              Email <span className="text-[#6bcb77]">envoyé !</span>
            </h2>
            <p className="text-[#9b96b8] text-sm mb-6 text-center">
              Vérifie ta boîte mail et clique sur le lien. Pense à vérifier tes spams.
            </p>

            <div className="bg-[#1a2e1f] border border-[#1f3a28] rounded-xl p-4 mb-8">
              <p className="text-[#6bcb77] text-sm text-center">
                Le lien expire dans <span className="font-fredoka text-base">1 heure</span>. Après ça, il faudra en redemander un nouveau.
              </p>
            </div>

            <Link
              href="/connexion"
              className="block w-full bg-[#6bcb77] text-[#0f0e17] rounded-2xl py-4 font-fredoka text-xl hover:opacity-90 transition text-center mb-4"
            >
              Retour à la connexion
            </Link>

            <button
              onClick={() => setSent(false)}
              className="block w-full border border-[#3a3650] text-[#c9c4e0] rounded-2xl py-3 font-fredoka text-base hover:bg-[#1e1c2e] transition text-center"
            >
              Renvoyer l'email
            </button>
          </>
        )}

      </div>

    </main>
  )
}
'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'

export default function Home() {
  const [connecte, setConnecte] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setConnecte(!!user)
      setLoading(false)
    }
    checkUser()
  }, [])

  return (
    <main className="min-h-screen bg-[#0f0e17]">

      {/* Navbar */}
      <nav
        className="fixed top-0 left-0 right-0 flex justify-between items-center bg-[#0f0e17] border-b border-[#1e1c2e] z-10"
        style={{ padding: '20px 60px 20px 32px' }}
      >
        <div className="font-fredoka text-2xl">
          <span className="text-[#ff6b6b]">C</span>
          <span className="text-[#ff9f43]">o</span>
          <span className="text-[#ffd93d]">o</span>
          <span className="text-[#6bcb77]">l</span>
          <span className="text-[#4ecdc4]">o</span>
          <span className="text-[#a78bfa]">s</span>
          <span className="text-[#c9c4e0]"> Quiz</span>
        </div>
        {!loading && (
          connecte ? (
            <div className="flex items-center gap-3">
              <Link
                href="/configuration"
                className="bg-[#ffd93d] text-[#0f0e17] rounded-full px-5 py-2 font-fredoka text-sm hover:opacity-90 transition"
              >
                Jouer →
              </Link>
              <Link
                href="/profil"
                className="w-9 h-9 rounded-full bg-[#2a1f3d] border-2 border-[#a78bfa] flex items-center justify-center"
              >
                <div className="w-4 h-4 rounded-full bg-[#a78bfa]"></div>
              </Link>
            </div>
          ) : (
            <Link
              href="/connexion"
              className="border border-[#3a3650] text-[#c9c4e0] rounded-full px-5 py-2 text-sm hover:bg-[#1e1c2e] transition"
            >
              Connexion
            </Link>
          )
        )}
      </nav>

      {/* Contenu principal */}
      <div
        className="flex flex-col items-center px-6 pb-16"
        style={{ paddingTop: '140px' }}
      >

        {/* Hero */}
        <div className="text-center w-full max-w-2xl">
          <h1 className="font-fredoka text-5xl text-[#eeeaf8] leading-tight mb-6" style={{ marginTop: '-20px' }}>
            Teste ta <span className="text-[#ff6b6b]">culture</span> générale{' '}
            <span className="text-[#ffd93d]">dès maintenant !</span>
          </h1>

          <p className="text-[#9b96b8] text-lg leading-relaxed mb-10 max-w-lg mx-auto" style={{ marginLeft: '80px' }}>
            Des centaines de questions sur tous les thèmes. Joue en solo, suis ta progression et deviens incollable.
          </p>

          <div className="flex flex-col gap-4 w-full max-w-md mx-auto items-center">
            {connecte ? (
              <Link
                href="/configuration"
                className="block w-full bg-[#ffd93d] text-[#0f0e17] rounded-2xl py-5 font-fredoka text-xl hover:opacity-90 transition text-center"
                style={{ marginLeft: '200px', marginTop: '10px' }}
              >
                Lancer un quiz !
              </Link>
            ) : (
              <>
                <Link
                  href="/inscription"
                  className="block w-full bg-[#ff6b6b] text-white rounded-2xl py-5 font-fredoka text-xl hover:opacity-90 transition text-center"
                  style={{ marginLeft: '200px', marginTop: '10px' }}
                >
                  Créer mon compte gratuit
                </Link>

                <Link
                  href="/connexion"
                  className="block w-full border border-[#3a3650] text-[#c9c4e0] rounded-2xl py-4 font-fredoka text-lg hover:bg-[#1e1c2e] transition text-center"
                  style={{ marginLeft: '200px', marginTop: '10px' }}
                >
                  J'ai déjà un compte →
                </Link>

                <button className="w-full text-[#9b96b8] text-sm font-semibold hover:text-[#c9c4e0] transition py-3" style={{ marginLeft: '200px', marginTop: '10px' }}>
                  Jouer sans compte
                </button>
              </>
            )}
          </div>
        </div>

        {/* Séparateur */}
        <div className="w-full max-w-2xl border-t border-[#1e1c2e]" style={{ marginTop: '80px', marginBottom: '60px' }}></div>

        {/* Features */}
        <div className="w-full max-w-3xl">
          <p className="text-center text-[#6b6880] font-bold uppercase tracking-widest" style={{fontSize: '14px', marginBottom: '15px', marginTop: '15px'}}>
            Pourquoi Coolos ?
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-8">
              <div className="w-10 h-10 rounded-xl bg-[#2a1f3d] flex items-center justify-center mb-4">
                <div className="w-4 h-4 rounded bg-[#a78bfa]"></div>
              </div>
              <h3 className="font-fredoka text-[#eeeaf8] text-lg mb-2">Choisis ton thème</h3>
              <p className="text-[#6b6880] text-sm leading-relaxed">Histoire, science, sport, culture pop…</p>
            </div>
            <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-8">
              <div className="w-10 h-10 rounded-xl bg-[#1f2d1f] flex items-center justify-center mb-4">
                <div className="w-4 h-4 rounded-full bg-[#6bcb77]"></div>
              </div>
              <h3 className="font-fredoka text-[#eeeaf8] text-lg mb-2">3 niveaux</h3>
              <p className="text-[#6b6880] text-sm leading-relaxed">Facile, moyen ou difficile selon ton humeur.</p>
            </div>
            <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-8">
              <div className="w-10 h-10 rounded-xl bg-[#2d1f1f] flex items-center justify-center mb-4">
                <div className="w-4 h-4 rounded bg-[#ff6b6b]"></div>
              </div>
              <h3 className="font-fredoka text-[#eeeaf8] text-lg mb-2">Score final</h3>
              <p className="text-[#6b6880] text-sm leading-relaxed">Vois combien tu as vraiment su répondre.</p>
            </div>
            <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-8">
              <div className="w-10 h-10 rounded-xl bg-[#1f2a2d] flex items-center justify-center mb-4">
                <div className="w-4 h-4 rounded bg-[#4ecdc4]"></div>
              </div>
              <h3 className="font-fredoka text-[#eeeaf8] text-lg mb-2">Historique</h3>
              <p className="text-[#6b6880] text-sm leading-relaxed">Retrouve toutes tes parties passées.</p>
            </div>
          </div>
        </div>

        {/* Séparateur */}
        <div className="w-full max-w-2xl border-t border-[#1e1c2e]" style={{ marginTop: '80px', marginBottom: '60px' }}></div>

        {/* Thèmes */}
        <div className="w-full max-w-2xl">
          <p className="text-center text-[#6b6880] font-bold uppercase tracking-widest" style={{fontSize: '10px', marginBottom: '14px', marginTop: '-15px'}}>
            Quelques thèmes disponibles
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <span className="bg-[#1e1c2e] border border-[#2a2830] rounded-full px-5 py-2 font-fredoka text-base text-[#ff6b6b]">Histoire</span>
            <span className="bg-[#1e1c2e] border border-[#2a2830] rounded-full px-5 py-2 font-fredoka text-base text-[#ffd93d]">Sciences</span>
            <span className="bg-[#1e1c2e] border border-[#2a2830] rounded-full px-5 py-2 font-fredoka text-base text-[#6bcb77]">Sport</span>
            <span className="bg-[#1e1c2e] border border-[#2a2830] rounded-full px-5 py-2 font-fredoka text-base text-[#4ecdc4]">Géographie</span>
            <span className="bg-[#1e1c2e] border border-[#2a2830] rounded-full px-5 py-2 font-fredoka text-base text-[#a78bfa]">Culture pop</span>
            <span className="bg-[#1e1c2e] border border-[#2a2830] rounded-full px-5 py-2 font-fredoka text-base text-[#ff9f43]">Cinéma</span>
          </div>
        </div>

        {!connecte && (
          <p className="text-[#6b6880] text-center" style={{ marginTop: '65px', fontSize: '14px' }}>
            En créant un compte, tu acceptes les CGU · Politique de confidentialité
          </p>
        )}

      </div>
    </main>
  )
}
'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'

export default function Contact() {
  const router = useRouter()
  const [connecte, setConnecte] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sujet, setSujet] = useState('')
  const [contenu, setContenu] = useState('')
  const [envoye, setEnvoye] = useState(false)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setConnecte(!!user)
      setLoading(false)
    }
    checkUser()
  }, [])

  const handleSubmit = async () => {
    if (!sujet.trim() || !contenu.trim()) {
      setErreur('Merci de remplir tous les champs.')
      return
    }
    setErreur('')
    setEnvoi(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let pseudo = 'Invité'
    let userId = null

    if (user) {
      userId = user.id
      const { data } = await supabase
        .from('users')
        .select('pseudo')
        .eq('id', user.id)
        .single()
      pseudo = data?.pseudo || user.email || 'Utilisateur'
    } else {
      const pseudoSession = sessionStorage.getItem('invite_pseudo')
      if (pseudoSession) pseudo = pseudoSession
    }

    const { error } = await supabase.from('messages').insert({
      user_id: userId,
      pseudo,
      type: 'message',
      sujet: sujet.trim(),
      contenu: contenu.trim(),
    })

    if (error) {
      setErreur('Une erreur est survenue. Réessaie plus tard.')
      setEnvoi(false)
      return
    }

    setEnvoye(true)
    setEnvoi(false)
  }

  if (envoye) {
    return (
      <main className="min-h-screen bg-[#0f0e17]">
        <nav className="fixed top-0 left-0 right-0 flex justify-between items-center bg-[#0f0e17] border-b border-[#1e1c2e] z-10 px-4 md:px-8 py-4">
          <Link href="/" className="font-fredoka text-xl md:text-2xl">
            <span className="text-[#ff6b6b]">C</span>
            <span className="text-[#ff9f43]">o</span>
            <span className="text-[#ffd93d]">o</span>
            <span className="text-[#6bcb77]">l</span>
            <span className="text-[#4ecdc4]">o</span>
            <span className="text-[#a78bfa]">s</span>
            <span className="text-[#c9c4e0]"> Quiz</span>
          </Link>
          {!loading && (
            connecte ? (
              <div className="flex items-center gap-3">
                <Link href="/configuration" className="bg-[#ffd93d] text-[#0f0e17] rounded-full px-4 py-2 font-fredoka text-sm hover:opacity-90 transition">
                  Jouer →
                </Link>
                <Link href="/profil" className="w-9 h-9 rounded-full bg-[#2a1f3d] border-2 border-[#a78bfa] flex items-center justify-center">
                  <div className="w-4 h-4 rounded-full bg-[#a78bfa]"></div>
                </Link>
              </div>
            ) : (
              <Link href="/connexion" className="border border-[#3a3650] text-[#c9c4e0] rounded-full px-4 py-2 text-sm hover:bg-[#1e1c2e] transition">
                Connexion
              </Link>
            )
          )}
        </nav>

        <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
          <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-10 w-full max-w-md flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-[#1f2d1f] border border-[#6bcb77] flex items-center justify-center font-fredoka text-[#6bcb77] text-3xl">
              ✓
            </div>
            <h2 className="font-fredoka text-2xl text-[#eeeaf8]">Message envoyé !</h2>
            <p className="text-[#9b96b8] text-sm leading-relaxed">
              On a bien reçu ton message et on te répondra dès que possible.
            </p>
            <Link
              href="/"
              className="w-full bg-[#ffd93d] text-[#0f0e17] rounded-2xl py-4 font-fredoka text-lg hover:opacity-90 transition text-center"
            >
              Retour à l'accueil
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#0f0e17]">
      <nav className="fixed top-0 left-0 right-0 flex justify-between items-center bg-[#0f0e17] border-b border-[#1e1c2e] z-10 px-4 md:px-8 py-4">
        <Link href="/" className="font-fredoka text-xl md:text-2xl">
          <span className="text-[#ff6b6b]">C</span>
          <span className="text-[#ff9f43]">o</span>
          <span className="text-[#ffd93d]">o</span>
          <span className="text-[#6bcb77]">l</span>
          <span className="text-[#4ecdc4]">o</span>
          <span className="text-[#a78bfa]">s</span>
          <span className="text-[#c9c4e0]"> Quiz</span>
        </Link>
        {!loading && (
          connecte ? (
            <div className="flex items-center gap-3">
              <Link href="/configuration" className="bg-[#ffd93d] text-[#0f0e17] rounded-full px-4 py-2 font-fredoka text-sm hover:opacity-90 transition">
                Jouer →
              </Link>
              <Link href="/profil" className="w-9 h-9 rounded-full bg-[#2a1f3d] border-2 border-[#a78bfa] flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-[#a78bfa]"></div>
              </Link>
            </div>
          ) : (
            <Link href="/connexion" className="border border-[#3a3650] text-[#c9c4e0] rounded-full px-4 py-2 text-sm hover:bg-[#1e1c2e] transition">
              Connexion
            </Link>
          )
        )}
      </nav>

      <div className="flex flex-col items-center px-6 pb-16" style={{ paddingTop: '100px' }}>
        <div className="w-full max-w-lg">

          <div className="mb-10 text-center">
            <h1 className="font-fredoka text-4xl text-[#eeeaf8] mb-3">Nous contacter</h1>
            <p className="text-[#9b96b8] text-sm leading-relaxed">
              Une question, une suggestion, un problème ? Envoie-nous un message !
            </p>
          </div>

          <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-6 md:p-8 flex flex-col gap-5">

            <div className="flex flex-col gap-2">
              <label className="font-fredoka text-[#c9c4e0] text-sm">Sujet</label>
              <input
                type="text"
                placeholder="De quoi s'agit-il ?"
                value={sujet}
                onChange={e => setSujet(e.target.value)}
                className="bg-[#0f0e17] border border-[#2a2830] rounded-xl px-4 py-3 text-[#eeeaf8] font-fredoka focus:outline-none focus:border-[#a78bfa] transition placeholder-[#3a3650]"
                maxLength={200}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-fredoka text-[#c9c4e0] text-sm">Message</label>
              <textarea
                placeholder="Ton message..."
                value={contenu}
                onChange={e => setContenu(e.target.value)}
                rows={6}
                className="bg-[#0f0e17] border border-[#2a2830] rounded-xl px-4 py-3 text-[#eeeaf8] font-fredoka focus:outline-none focus:border-[#a78bfa] transition placeholder-[#3a3650] resize-none"
              />
            </div>

            {erreur && (
              <p className="text-[#ff6b6b] font-fredoka text-sm text-center">{erreur}</p>
            )}

            <button
              onClick={handleSubmit}
              disabled={envoi}
              className="w-full bg-[#a78bfa] text-[#0f0e17] rounded-2xl py-4 font-fredoka text-lg hover:opacity-90 transition disabled:opacity-50"
            >
              {envoi ? 'Envoi en cours...' : 'Envoyer le message →'}
            </button>

            <button
              onClick={() => router.back()}
              className="w-full text-[#6b6880] text-sm font-semibold hover:text-[#9b96b8] transition"
            >
              ← Retour
            </button>

          </div>
        </div>
      </div>
    </main>
  )
}
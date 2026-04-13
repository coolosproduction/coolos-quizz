'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase'

export default function ModifierProfil() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [currentAvatar, setCurrentAvatar] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [pseudo, setPseudo] = useState('')

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/connexion'); return }
      setPseudo(user.user_metadata?.pseudo || user.email?.split('@')[0] || '')
      setCurrentAvatar(user.user_metadata?.avatar_url || null)
    }
    load()
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreview(url)
  }

  const handleSave = async () => {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  setUploading(true)
  setMessage(null)

  try {
    let avatarUrl = currentAvatar

    const file = fileInputRef.current?.files?.[0]
    if (file) {
      const ext = file.name.split('.').pop()
      const path = `${user.id}/avatar.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(path)

      avatarUrl = publicUrl
    }

    await supabase.auth.updateUser({
      data: { pseudo, avatar_url: avatarUrl }
    })

    // Sauvegarde aussi dans la table users
    await supabase
      .from('users')
      .update({ pseudo, avatar_url: avatarUrl })
      .eq('id', user.id)

    setMessage('Profil mis à jour !')
    setTimeout(() => router.push('/profil'), 1500)
  } catch (err) {
    setMessage('Une erreur est survenue.')
  } finally {
    setUploading(false)
  }
}

  return (
    <main className="min-h-screen bg-[#0f0e17]" style={{ padding: '32px 24px' }}>
      <nav className="flex justify-between items-center" style={{ maxWidth: '600px', margin: '0 auto 40px' }}>
        <Link href="/" className="font-fredoka text-2xl">
          <span className="text-[#ff6b6b]">C</span>
          <span className="text-[#ff9f43]">o</span>
          <span className="text-[#ffd93d]">o</span>
          <span className="text-[#6bcb77]">l</span>
          <span className="text-[#4ecdc4]">o</span>
          <span className="text-[#a78bfa]">s</span>
          <span className="text-[#c9c4e0]"> Quiz</span>
        </Link>
      </nav>

      <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        <div className="flex items-center gap-3">
          <Link href="/profil" className="text-[#9b96b8] hover:text-[#eeeaf8] transition">←</Link>
          <h1 className="font-fredoka text-3xl text-[#eeeaf8]">Modifier le profil</h1>
        </div>

        {/* Photo de profil */}
        <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-6 flex flex-col items-center gap-4">
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center overflow-hidden cursor-pointer"
            style={{ border: '3px solid #a78bfa', background: '#2a1f3d' }}
            onClick={() => fileInputRef.current?.click()}
          >
            {preview || currentAvatar ? (
              <img src={preview || currentAvatar!} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[#a78bfa]"></div>
            )}
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="font-fredoka text-sm text-[#a78bfa] border border-[#3a3650] rounded-full px-4 py-1 hover:bg-[#1e1c2e] transition"
          >
            Choisir une photo
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <p className="text-[#6b6880] text-xs">JPG, PNG — max 2 Mo</p>
        </div>

        {/* Pseudo */}
        <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-6" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label className="font-fredoka text-[#c9c4e0]">Pseudo</label>
          <input
            type="text"
            value={pseudo}
            onChange={e => setPseudo(e.target.value)}
            className="bg-[#0f0e17] border border-[#2a2830] rounded-xl px-4 py-3 text-[#eeeaf8] font-fredoka focus:outline-none focus:border-[#a78bfa]"
          />
        </div>

        {message && (
          <p className="text-center font-fredoka text-[#6bcb77]">{message}</p>
        )}

        <button
          onClick={handleSave}
          disabled={uploading}
          className="w-full bg-[#a78bfa] text-[#0f0e17] rounded-2xl py-4 font-fredoka text-lg hover:opacity-90 transition"
        >
          {uploading ? 'Enregistrement...' : 'Enregistrer'}
        </button>

      </div>
    </main>
  )
}
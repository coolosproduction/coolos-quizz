'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../../lib/supabase'

export default function NouvelleCategorie() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [active, setActive] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!name) return
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase
      .from('categories')
      .insert({ name, active })
    if (error) {
      setError('Erreur lors de la création : ' + error.message)
      setLoading(false)
      return
    }
    router.push('/admin')
  }

  return (
    <div className="min-h-screen bg-[#0f0e17] flex">

      {/* Sidebar */}
      <div style={{ width: '220px', background: '#0a0910', borderRight: '1px solid #1e1c2e', display: 'flex', flexDirection: 'column', padding: '24px 0', flexShrink: 0 }}>
        <div className="font-fredoka text-lg" style={{ padding: '0 20px 24px', borderBottom: '1px solid #1e1c2e', marginBottom: '16px' }}>
          <span className="text-[#ff6b6b]">C</span>
          <span className="text-[#ff9f43]">o</span>
          <span className="text-[#ffd93d]">o</span>
          <span className="text-[#6bcb77]">l</span>
          <span className="text-[#4ecdc4]">o</span>
          <span className="text-[#a78bfa]">s</span>
          <span className="text-[#6b6880] text-sm"> admin</span>
        </div>

        <p className="text-[#4a4760] text-xs font-bold uppercase tracking-widest" style={{ padding: '0 20px', marginBottom: '8px' }}>Contenu</p>

        <Link href="/admin" className="flex items-center gap-3 font-fredoka text-sm" style={{ padding: '10px 20px', color: '#6b6880', borderRight: '3px solid transparent' }}>
          <div className="w-2 h-2 rounded-full bg-[#ffd93d]"></div>
          Questions
        </Link>
        <Link href="/admin" className="flex items-center gap-3 font-fredoka text-sm" style={{ padding: '10px 20px', color: '#eeeaf8', background: '#1a1828', borderRight: '3px solid #4ecdc4' }}>
          <div className="w-2 h-2 rounded-full bg-[#4ecdc4]"></div>
          Catégories
        </Link>

        <p className="text-[#4a4760] text-xs font-bold uppercase tracking-widest" style={{ padding: '16px 20px 8px' }}>Communauté</p>

        <Link href="/admin" className="flex items-center gap-3 font-fredoka text-sm" style={{ padding: '10px 20px', color: '#6b6880', borderRight: '3px solid transparent' }}>
          <div className="w-2 h-2 rounded-full bg-[#a78bfa]"></div>
          Utilisateurs
        </Link>

        <div style={{ flex: 1 }}></div>
        <div style={{ padding: '16px 20px', borderTop: '1px solid #1e1c2e' }}>
          <p className="font-fredoka text-sm text-[#9b96b8]">Admin</p>
          <p className="text-xs text-[#6b6880]">connecté</p>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, padding: '40px', overflow: 'auto' }}>

        <div className="flex justify-between items-center" style={{ marginBottom: '32px' }}>
          <div>
            <h2 className="font-fredoka text-2xl text-[#eeeaf8]">Ajouter une catégorie</h2>
            <p className="text-[#6b6880] text-sm" style={{ marginTop: '4px' }}>Crée un nouveau thème de quiz</p>
          </div>
          <Link href="/admin" className="font-fredoka text-sm hover:opacity-80 transition" style={{ border: '1.5px solid #3a3650', color: '#9b96b8', borderRadius: '12px', padding: '10px 20px' }}>
            ← Retour
          </Link>
        </div>

        <div style={{ maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {error && (
            <div style={{ background: '#2e1a1a', border: '1px solid #ff6b6b', borderRadius: '14px', padding: '14px 16px' }}>
              <p className="text-[#ff6b6b] text-sm">{error}</p>
            </div>
          )}

          {/* Nom */}
          <div>
            <label className="block font-fredoka text-[#9b96b8] text-sm" style={{ marginBottom: '8px' }}>Nom de la catégorie *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Histoire, Sciences, Sport..."
              className="w-full text-[#eeeaf8] text-sm outline-none"
              style={{ background: '#1a1828', border: `1.5px solid ${name ? '#4ecdc4' : '#3a3650'}`, borderRadius: '14px', padding: '14px 16px' }}
            />
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between" style={{ background: '#1a1828', border: '1px solid #2a2830', borderRadius: '14px', padding: '16px 20px' }}>
            <div>
              <p className="font-fredoka text-[#c9c4e0] text-sm">Catégorie active</p>
              <p className="text-[#6b6880] text-xs" style={{ marginTop: '2px' }}>Visible dans la configuration du quiz</p>
            </div>
            <div
              onClick={() => setActive(!active)}
              className="rounded-full cursor-pointer relative"
              style={{ width: '44px', height: '24px', background: active ? '#6bcb77' : '#2a2830' }}
            >
              <div
                className="rounded-full bg-white absolute"
                style={{ width: '18px', height: '18px', top: '3px', left: active ? '23px' : '3px', transition: 'left 0.2s' }}
              ></div>
            </div>
          </div>

          {/* Info */}
          <div style={{ background: '#1e1c2e', border: '1px solid #2a2830', borderRadius: '14px', padding: '16px 20px' }}>
            <p className="font-fredoka text-[#9b96b8] text-sm" style={{ marginBottom: '4px' }}>À savoir</p>
            <p className="text-[#6b6880] text-xs" style={{ lineHeight: '1.6' }}>
              Une fois la catégorie créée, tu pourras y ajouter des questions depuis la page Questions. Les questions seront associées à cette catégorie.
            </p>
          </div>

          {/* Boutons */}
          <div className="flex gap-3">
            <Link href="/admin" className="font-fredoka text-sm text-center hover:opacity-80 transition" style={{ border: '1.5px solid #3a3650', color: '#9b96b8', borderRadius: '14px', padding: '14px 24px' }}>
              Annuler
            </Link>
            <button
              onClick={handleSave}
              disabled={!name || loading}
              className="flex-1 font-fredoka text-lg hover:opacity-90 transition"
              style={{ background: name ? '#4ecdc4' : '#2a2830', color: name ? '#0f0e17' : '#4a4760', borderRadius: '14px', padding: '14px', cursor: name ? 'pointer' : 'not-allowed' }}
            >
              {loading ? 'Enregistrement...' : 'Enregistrer la catégorie'}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
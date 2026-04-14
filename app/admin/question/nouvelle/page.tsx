'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../../lib/supabase'

export default function NouvelleQuestion() {
  const router = useRouter()
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [active, setActive] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [categories, setCategories] = useState<{ id: string, name: string }[]>([])
  const [images, setImages] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])

  const difficultes = [
    { id: 'facile', label: 'Facile', color: '#6bcb77', bg: '#1a2e1f' },
    { id: 'moyen', label: 'Moyen', color: '#ffd93d', bg: '#1f1e10' },
    { id: 'difficile', label: 'Difficile', color: '#ff6b6b', bg: '#2e1a1a' },
    { id: 'hardcore', label: 'Hardcore', color: '#a78bfa', bg: '#2a1f3d' },
  ]

  useEffect(() => {
    const loadCategories = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('categories')
        .select('id, name')
        .eq('active', true)
        .order('name')
      if (data) setCategories(data)
    }
    loadCategories()
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    const newImages = [...images, ...files].slice(0, 5)
    setImages(newImages)
    const newPreviews = newImages.map(f => URL.createObjectURL(f))
    setPreviews(newPreviews)
  }

  const supprimerImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index)
    const newPreviews = previews.filter((_, i) => i !== index)
    setImages(newImages)
    setPreviews(newPreviews)
  }

  const handleSave = async () => {
    if (!question || !answer || !categoryId || !difficulty) {
      setError('Tous les champs obligatoires doivent être remplis.')
      return
    }
    setLoading(true)
    setError('')
    const supabase = createClient()

    const { data: newQuestion, error: insertError } = await supabase
      .from('questions')
      .insert({
        question_text: question,
        answer_text: answer,
        category_id: categoryId,
        difficulty,
        active,
      })
      .select()
      .single()

    if (insertError) {
      setError('Erreur lors de la création : ' + insertError.message)
      setLoading(false)
      return
    }

    if (images.length > 0 && newQuestion) {
      for (let i = 0; i < images.length; i++) {
        const file = images[i]
        const ext = file.name.split('.').pop()
        const path = `${newQuestion.id}/${i + 1}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('question-images')
          .upload(path, file, { upsert: true })

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('question-images')
            .getPublicUrl(path)

          await supabase.from('question_images').insert({
            question_id: newQuestion.id,
            file_path: path,
            position: i + 1,
          })
        }
      }
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

        <Link href="/admin" className="flex items-center gap-3 font-fredoka text-sm" style={{ padding: '10px 20px', color: '#eeeaf8', background: '#1a1828', borderRight: '3px solid #ffd93d' }}>
          <div className="w-2 h-2 rounded-full bg-[#ffd93d]"></div>
          Questions
        </Link>
        <Link href="/admin" className="flex items-center gap-3 font-fredoka text-sm" style={{ padding: '10px 20px', color: '#6b6880', borderRight: '3px solid transparent' }}>
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
            <h2 className="font-fredoka text-2xl text-[#eeeaf8]">Ajouter une question</h2>
            <p className="text-[#6b6880] text-sm" style={{ marginTop: '4px' }}>Remplis tous les champs obligatoires</p>
          </div>
          <Link href="/admin" className="font-fredoka text-sm hover:opacity-80 transition" style={{ border: '1.5px solid #3a3650', color: '#9b96b8', borderRadius: '12px', padding: '10px 20px' }}>
            ← Retour
          </Link>
        </div>

        <div style={{ maxWidth: '700px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {error && (
            <div style={{ background: '#2e1a1a', border: '1px solid #ff6b6b', borderRadius: '14px', padding: '14px 16px' }}>
              <p className="text-[#ff6b6b] text-sm">{error}</p>
            </div>
          )}

          {/* Question */}
          <div>
            <label className="block font-fredoka text-[#9b96b8] text-sm" style={{ marginBottom: '8px' }}>Question *</label>
            <textarea
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="Écris ta question ici..."
              rows={3}
              className="w-full text-[#eeeaf8] text-sm outline-none resize-none"
              style={{ background: '#1a1828', border: `1.5px solid ${question ? '#ffd93d' : '#3a3650'}`, borderRadius: '14px', padding: '14px 16px', lineHeight: '1.5' }}
            />
          </div>

          {/* Réponse */}
          <div>
            <label className="block font-fredoka text-[#9b96b8] text-sm" style={{ marginBottom: '8px' }}>Réponse officielle *</label>
            <textarea
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              placeholder="La réponse attendue..."
              rows={2}
              className="w-full text-[#eeeaf8] text-sm outline-none resize-none"
              style={{ background: '#1a1828', border: `1.5px solid ${answer ? '#ffd93d' : '#3a3650'}`, borderRadius: '14px', padding: '14px 16px', lineHeight: '1.5' }}
            />
          </div>

          {/* Catégorie + Difficulté */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block font-fredoka text-[#9b96b8] text-sm" style={{ marginBottom: '8px' }}>Catégorie *</label>
              <select
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                className="w-full text-[#eeeaf8] text-sm outline-none cursor-pointer"
                style={{ background: '#1a1828', border: `1.5px solid ${categoryId ? '#ffd93d' : '#3a3650'}`, borderRadius: '14px', padding: '14px 16px' }}
              >
                <option value="">Choisir une catégorie</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-fredoka text-[#9b96b8] text-sm" style={{ marginBottom: '8px' }}>Difficulté *</label>
              <div className="grid grid-cols-2 gap-2">
                {difficultes.map(d => (
                  <button
                    key={d.id}
                    onClick={() => setDifficulty(d.id)}
                    className="font-fredoka text-sm rounded-xl py-3"
                    style={{
                      background: difficulty === d.id ? d.bg : '#1a1828',
                      border: `1.5px solid ${difficulty === d.id ? d.color : '#3a3650'}`,
                      color: difficulty === d.id ? d.color : '#9b96b8',
                    }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Images */}
          <div>
            <p className="font-fredoka text-[#9b96b8] text-sm" style={{ marginBottom: '8px' }}>
              Images (optionnel) — max 5
            </p>

            {previews.length > 0 && (
              <div className="flex gap-3 flex-wrap" style={{ marginBottom: '12px' }}>
                {previews.map((src, i) => (
                  <div key={i} className="relative" style={{ width: '80px', height: '80px' }}>
                    <img
                      src={src}
                      alt={`image ${i + 1}`}
                      className="w-full h-full object-cover rounded-xl"
                      style={{ border: '2px solid #2a2830' }}
                    />
                    <button
                      onClick={() => supprimerImage(i)}
                      className="absolute flex items-center justify-center font-fredoka text-xs"
                      style={{ top: '-6px', right: '-6px', width: '20px', height: '20px', background: '#ff6b6b', color: '#fff', borderRadius: '50%' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {previews.length < 5 && (
              <label
                htmlFor="image-upload"
                className="w-full flex flex-col items-center justify-center cursor-pointer transition"
                style={{ background: '#1a1828', border: '2px dashed #2a2830', borderRadius: '14px', padding: '32px' }}
              >
                <div className="w-10 h-8 rounded-lg border-2 border-[#3a3650] flex items-center justify-center mb-3">
                  <div className="w-4 h-4 rounded-full border-2 border-[#4a4760]"></div>
                </div>
                <p className="font-fredoka text-[#6b6880] text-sm">Cliquer pour ajouter une image</p>
                <p className="text-[#4a4760] text-xs" style={{ marginTop: '4px' }}>JPG ou PNG · {5 - previews.length} emplacement(s) restant(s)</p>
              </label>
            )}

            <input
              id="image-upload"
              type="file"
              accept="image/jpeg,image/png"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between" style={{ background: '#1a1828', border: '1px solid #2a2830', borderRadius: '14px', padding: '16px 20px' }}>
            <div>
              <p className="font-fredoka text-[#c9c4e0] text-sm">Question active</p>
              <p className="text-[#6b6880] text-xs" style={{ marginTop: '2px' }}>Visible dans les quiz dès maintenant</p>
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

          {/* Boutons */}
          <div className="flex gap-3">
            <Link href="/admin" className="font-fredoka text-sm text-center hover:opacity-80 transition" style={{ border: '1.5px solid #3a3650', color: '#9b96b8', borderRadius: '14px', padding: '14px 24px' }}>
              Annuler
            </Link>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 font-fredoka text-lg hover:opacity-90 transition"
              style={{ background: '#ffd93d', color: '#0f0e17', borderRadius: '14px', padding: '14px' }}
            >
              {loading ? 'Enregistrement...' : 'Enregistrer la question'}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
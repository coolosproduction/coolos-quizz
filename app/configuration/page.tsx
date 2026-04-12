'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '../../lib/supabase'

const difficultes = [
  { id: 'facile', label: 'Facile', sub: 'Pour débuter', color: '#6bcb77', bg: '#1a2e1f' },
  { id: 'moyen', label: 'Moyen', sub: 'Un peu corsé', color: '#ffd93d', bg: '#1f1e10' },
  { id: 'difficile', label: 'Difficile', sub: 'Expert only', color: '#ff6b6b', bg: '#2e1a1a' },
  { id: 'hardcore', label: 'Hardcore', sub: 'Sans pitié', color: '#a78bfa', bg: '#2a1f3d' },
]

const nbQuestions = [10, 20, 30, 40, 50]
const timers = [10, 15, 20, 30, 45, 60]

const themeColors = [
  '#ff6b6b', '#ffd93d', '#6bcb77', '#4ecdc4', '#a78bfa', '#ff9f43',
  '#4ecdc4', '#ff6b6b', '#6bcb77', '#ffd93d',
]
const themeBgs = [
  '#2d1f1f', '#1f1e10', '#1a2e1f', '#1a2a2d', '#2a1f3d', '#2d2010',
  '#1a2a2d', '#2d1f1f', '#1a2e1f', '#1f1e10',
]

type Category = { id: string, name: string, color: string, bg: string }

export default function Configuration() {
  const [themes, setThemes] = useState<Category[]>([])
  const [themesSelec, setThemesSelec] = useState<string[]>([])
  const [diffSelec, setDiffSelec] = useState<string[]>([])
  const [nb, setNb] = useState(20)
  const [timer, setTimer] = useState(20)
  const [search, setSearch] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const loadCategories = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('categories')
        .select('id, name')
        .eq('active', true)
        .order('name')
      if (data) {
        const formatted = data.map((c, i) => ({
          id: c.id,
          name: c.name,
          color: themeColors[i % themeColors.length],
          bg: themeBgs[i % themeBgs.length],
        }))
        setThemes(formatted)
      }
    }
    loadCategories()
  }, [])

  const toggleTheme = (id: string) => {
    setThemesSelec(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    )
  }

  const toggleAll = () => {
    if (themesSelec.length === themes.length) {
      setThemesSelec([])
    } else {
      setThemesSelec(themes.map(t => t.id))
    }
  }

  const toggleDiff = (id: string) => {
    setDiffSelec(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    )
  }

  const themesFiltres = themes.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase())
  )

  const themesLabel = themesSelec.length === 0 || themesSelec.length === themes.length
    ? 'Tous les thèmes'
    : `${themesSelec.length} thème${themesSelec.length > 1 ? 's' : ''}`

  const diffLabel = diffSelec.length === 0
    ? 'Toutes difficultés'
    : diffSelec.map(d => difficultes.find(x => x.id === d)?.label).join(' + ')

  const handleLancer = () => {
    const categoryIds = themesSelec.length === 0 ? themes.map(t => t.id) : themesSelec
    const difficulties = diffSelec.length === 0 ? ['facile', 'moyen', 'difficile', 'hardcore'] : diffSelec
    const params = new URLSearchParams({
      categories: categoryIds.join(','),
      difficulties: difficulties.join(','),
      nb: nb.toString(),
      timer: timer.toString(),
    })
    router.push(`/quiz?${params.toString()}`)
  }

  return (
    <main className="min-h-screen bg-[#0f0e17]" style={{ padding: '32px 24px 80px' }}>

      <nav className="flex justify-between items-center mb-12">
        <Link href="/" className="font-fredoka text-2xl">
          <span className="text-[#ff6b6b]">C</span>
          <span className="text-[#ff9f43]">o</span>
          <span className="text-[#ffd93d]">o</span>
          <span className="text-[#6bcb77]">l</span>
          <span className="text-[#4ecdc4]">o</span>
          <span className="text-[#a78bfa]">s</span>
          <span className="text-[#c9c4e0]"> Quiz</span>
        </Link>
        {typeof window !== 'undefined' && sessionStorage.getItem('is_invite') !== 'true' && (
          <Link href="/profil" className="w-10 h-10 rounded-full bg-[#2a1f3d] border-2 border-[#a78bfa] flex items-center justify-center cursor-pointer">
            <div className="w-5 h-5 rounded-full bg-[#a78bfa]"></div>
          </Link>
        )}
      </nav>

      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '40px' }}>
        <div>
          <h2 className="font-fredoka text-4xl text-[#eeeaf8] mb-4">Prêt à jouer ?</h2>
          <p className="text-[#9b96b8] text-base">Configure ton quiz et c'est parti !</p>
        </div>

        {/* Thèmes */}
        <div>
          <p className="font-fredoka text-[#c9c4e0] text-xl mb-4">Choisis tes thèmes</p>
          <div
            className="w-full bg-[#1a1828] border-2 rounded-xl px-4 py-4 flex justify-between items-center cursor-pointer"
            style={{ borderColor: dropdownOpen ? '#ffd93d' : '#3a3650', borderRadius: dropdownOpen ? '12px 12px 0 0' : '12px' }}
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <div className="flex items-center gap-3">
              <span className="font-fredoka text-[#eeeaf8] text-base">Thèmes sélectionnés</span>
              <span className="bg-[#ffd93d] text-[#0f0e17] rounded-full px-3 py-0.5 font-fredoka text-sm">
                {themesSelec.length === 0 || themesSelec.length === themes.length ? 'Tous' : themesSelec.length}
              </span>
            </div>
            <div style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s' }}>
              <div className="w-0 h-0 border-l-4 border-r-4 border-t-8 border-l-transparent border-r-transparent border-t-[#9b96b8]"></div>
            </div>
          </div>

          {dropdownOpen && (
            <div className="bg-[#1a1828] border-2 border-[#ffd93d] border-t-0 rounded-b-xl overflow-hidden">
              <div className="p-3">
                <input
                  type="text"
                  placeholder="Rechercher un thème..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-[#0f0e17] border border-[#2a2830] rounded-xl px-3 py-2 text-[#eeeaf8] text-sm outline-none"
                />
              </div>
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-[#2a2830] hover:bg-[#1f1e2a]"
                onClick={toggleAll}
              >
                <div className={`w-4 h-4 rounded flex items-center justify-center border ${themesSelec.length === themes.length ? 'bg-[#ffd93d] border-[#ffd93d]' : themesSelec.length > 0 ? 'bg-[#2a2830] border-[#ffd93d]' : 'border-[#3a3650] bg-[#0f0e17]'}`}>
                  {themesSelec.length === themes.length && <div className="w-2 h-2 bg-[#0f0e17] rounded-sm"></div>}
                  {themesSelec.length > 0 && themesSelec.length < themes.length && <div className="w-2 h-0.5 bg-[#ffd93d]"></div>}
                </div>
                <span className="font-fredoka text-[#ffd93d] text-sm">Tout sélectionner</span>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {themesFiltres.map(t => (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-[#1e1c2e] hover:bg-[#1f1e2a]"
                    onClick={() => toggleTheme(t.id)}
                  >
                    <div className="w-2 h-2 rounded-full" style={{ background: t.color }}></div>
                    <span className="text-[#eeeaf8] text-sm font-semibold flex-1">{t.name}</span>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${themesSelec.includes(t.id) ? 'border-[#ffd93d] bg-[#ffd93d]' : 'border-[#3a3650] bg-[#0f0e17]'}`}>
                      {themesSelec.includes(t.id) && <div className="w-2 h-2 bg-[#0f0e17] rounded-sm"></div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {themesSelec.length > 0 && themesSelec.length < themes.length && (
            <div className="flex flex-wrap gap-2 mt-3">
              {themesSelec.map(id => {
                const t = themes.find(x => x.id === id)!
                return (
                  <span
                    key={id}
                    className="rounded-full px-3 py-1 font-fredoka text-xs flex items-center gap-2 cursor-pointer"
                    style={{ background: t.bg, border: `1.5px solid ${t.color}`, color: t.color }}
                    onClick={() => toggleTheme(id)}
                  >
                    {t.name} ✕
                  </span>
                )
              })}
            </div>
          )}
        </div>

        {/* Difficulté */}
        <div>
          <p className="font-fredoka text-[#c9c4e0] text-xl mb-4">Difficulté</p>
          <div className="flex gap-4">
            {difficultes.map(d => (
              <button
                key={d.id}
                onClick={() => toggleDiff(d.id)}
                className="flex-1 rounded-xl py-4 font-fredoka text-base relative"
                style={{
                  background: diffSelec.includes(d.id) ? d.bg : '#1a1828',
                  border: `2px solid ${diffSelec.includes(d.id) ? d.color : '#2a2830'}`,
                  color: diffSelec.includes(d.id) ? d.color : '#9b96b8',
                }}
              >
                <div className="w-2 h-2 rounded-full absolute top-2 right-2" style={{ background: diffSelec.includes(d.id) ? d.color : '#3a3650' }}></div>
                {d.label}
                <div className="text-sm font-sans mt-1 opacity-70">{d.sub}</div>
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

        {/* Récapitulatif */}
        <div className="bg-[#1e1c2e] border border-[#2a2830] rounded-2xl p-5 flex flex-wrap gap-3">
          <span className="bg-[#2a2830] rounded-full px-4 py-2 font-fredoka text-sm text-[#ffd93d]">{themesLabel}</span>
          <span className="bg-[#2a2830] rounded-full px-4 py-2 font-fredoka text-sm text-[#ffd93d]">{diffLabel}</span>
          <span className="bg-[#2a2830] rounded-full px-4 py-2 font-fredoka text-sm text-[#4ecdc4]">{nb} questions</span>
          <span className="bg-[#2a2830] rounded-full px-4 py-2 font-fredoka text-sm text-[#ff9f43]">{timer}s / question</span>
        </div>

        {/* Bouton lancer */}
        <button
          onClick={handleLancer}
          className="block w-full bg-[#ffd93d] text-[#0f0e17] rounded-2xl py-5 font-fredoka text-2xl hover:opacity-90 transition text-center"
        >
          Lancer le quiz !
        </button>

      </div>
    </main>
  )
}
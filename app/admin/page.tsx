'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'

const diffColors: Record<string, string> = {
  facile: '#6bcb77',
  moyen: '#ffd93d',
  difficile: '#ff6b6b',
}

type Question = {
  id: string
  question: string
  answer: string
  category: string
  difficulty: string
  active: boolean
}

type Category = {
  id: string
  name: string
  active: boolean
  count: number
}

type UserStat = {
  id: string
  pseudo: string
  email: string
  questions: number
  reussite: number
}

export default function Admin() {
  const router = useRouter()
  const [panel, setPanel] = useState<'questions' | 'categories' | 'users'>('questions')
  const [questions, setQuestions] = useState<Question[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [users, setUsers] = useState<UserStat[]>([])
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [search, setSearch] = useState('')
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAdmin = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/connexion'); return }

      const { data } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      if (data?.role !== 'admin') { router.push('/'); return }
      setAuthorized(true)
      loadData()
    }
    checkAdmin()
  }, [])

  const loadData = async () => {
    const supabase = createClient()

    const { data: questionsData } = await supabase
      .from('questions')
      .select('id, question_text, answer_text, difficulty, active, category_id, categories(name)')
      .order('created_at', { ascending: false })

    if (questionsData) {
      setQuestions(questionsData.map((q: any) => ({
        id: q.id,
        question: q.question_text,
        answer: q.answer_text,
        category: q.categories?.name || '',
        difficulty: q.difficulty,
        active: q.active,
      })))
    }

    const { data: catsData } = await supabase
      .from('categories')
      .select('id, name, active')
      .order('name')

    if (catsData) {
      const catsWithCount = await Promise.all(catsData.map(async (c: any) => {
        const { count } = await supabase
          .from('questions')
          .select('*', { count: 'exact', head: true })
          .eq('category_id', c.id)
        return { id: c.id, name: c.name, active: c.active, count: count || 0 }
      }))
      setCategories(catsWithCount)
    }

    const { data: usersData } = await supabase
      .from('users')
      .select('id, pseudo, email')

    if (usersData) {
      const usersWithStats = await Promise.all(usersData.map(async (u: any) => {
        const { data: games } = await supabase
          .from('games')
          .select('questions_count, score, score_max')
          .eq('user_id', u.id)

        const totalQ = games?.reduce((acc, g) => acc + g.questions_count, 0) || 0
        const totalScore = games?.reduce((acc, g) => acc + g.score, 0) || 0
        const totalMax = games?.reduce((acc, g) => acc + g.score_max, 0) || 0
        const reussite = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0

        return { id: u.id, pseudo: u.pseudo || u.email?.split('@')[0], email: u.email, questions: totalQ, reussite }
      }))
      setUsers(usersWithStats.sort((a, b) => b.questions - a.questions))
      setTotalQuestions(usersWithStats.reduce((acc, u) => acc + u.questions, 0))
    }

    setLoading(false)
  }

  const toggleQuestion = async (id: string) => {
    const supabase = createClient()
    const question = questions.find(q => q.id === id)
    if (!question) return
    await supabase.from('questions').update({ active: !question.active }).eq('id', id)
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, active: !q.active } : q))
  }

  const toggleCategory = async (id: string) => {
    const supabase = createClient()
    const category = categories.find(c => c.id === id)
    if (!category) return
    await supabase.from('categories').update({ active: !category.active }).eq('id', id)
    setCategories(prev => prev.map(c => c.id === id ? { ...c, active: !c.active } : c))
  }

  const deleteQuestion = async (id: string) => {
    if (!confirm('Supprimer cette question ?')) return
    const supabase = createClient()
    await supabase.from('questions').delete().eq('id', id)
    setQuestions(prev => prev.filter(q => q.id !== id))
  }

  const deleteCategory = async (id: string) => {
    if (!confirm('Supprimer cette catégorie ?')) return
    const supabase = createClient()
    await supabase.from('categories').delete().eq('id', id)
    setCategories(prev => prev.filter(c => c.id !== id))
  }

  const questionsFiltrees = questions.filter(q =>
    q.question.toLowerCase().includes(search.toLowerCase()) ||
    q.category.toLowerCase().includes(search.toLowerCase())
  )

  if (!authorized || loading) {
    return (
      <main className="min-h-screen bg-[#0f0e17] flex items-center justify-center">
        <p className="font-fredoka text-[#9b96b8] text-xl">Chargement...</p>
      </main>
    )
  }

  return (
    <div className="min-h-screen bg-[#0f0e17] flex" style={{ fontFamily: 'Nunito, sans-serif' }}>

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

        {[
          { id: 'questions', label: 'Questions', color: '#ffd93d' },
          { id: 'categories', label: 'Catégories', color: '#4ecdc4' },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setPanel(item.id as any)}
            className="flex items-center gap-3 font-fredoka text-sm text-left"
            style={{
              padding: '10px 20px',
              background: panel === item.id ? '#1a1828' : 'transparent',
              color: panel === item.id ? '#eeeaf8' : '#6b6880',
              borderRight: panel === item.id ? `3px solid ${item.color}` : '3px solid transparent',
            }}
          >
            <div className="w-2 h-2 rounded-full" style={{ background: item.color }}></div>
            {item.label}
          </button>
        ))}

        <p className="text-[#4a4760] text-xs font-bold uppercase tracking-widest" style={{ padding: '16px 20px 8px' }}>Communauté</p>

        <button
          onClick={() => setPanel('users')}
          className="flex items-center gap-3 font-fredoka text-sm text-left"
          style={{
            padding: '10px 20px',
            background: panel === 'users' ? '#1a1828' : 'transparent',
            color: panel === 'users' ? '#eeeaf8' : '#6b6880',
            borderRight: panel === 'users' ? '3px solid #a78bfa' : '3px solid transparent',
          }}
        >
          <div className="w-2 h-2 rounded-full bg-[#a78bfa]"></div>
          Utilisateurs
        </button>

        <div style={{ flex: 1 }}></div>
        <div style={{ padding: '16px 20px', borderTop: '1px solid #1e1c2e' }}>
          <p className="font-fredoka text-sm text-[#9b96b8]">Admin</p>
          <p className="text-xs text-[#6b6880]">connecté</p>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, padding: '40px', overflow: 'auto' }}>

        {/* Panel Questions */}
        {panel === 'questions' && (
          <div>
            <div className="flex justify-between items-start" style={{ marginBottom: '24px' }}>
              <div>
                <h2 className="font-fredoka text-2xl text-[#eeeaf8]">Questions</h2>
                <p className="text-[#6b6880] text-sm" style={{ marginTop: '4px' }}>Gérer toutes les questions du quiz</p>
              </div>
              <Link href="/admin/question/nouvelle" className="font-fredoka text-sm hover:opacity-90 transition" style={{ background: '#ffd93d', color: '#0f0e17', borderRadius: '12px', padding: '10px 20px' }}>
                + Ajouter
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-4" style={{ marginBottom: '24px' }}>
              <div className="bg-[#1a1828] border border-[#2a2830] rounded-xl p-4 text-center">
                <div className="font-fredoka text-2xl text-[#ffd93d]">{questions.length}</div>
                <div className="text-[#6b6880] text-xs" style={{ marginTop: '4px' }}>Questions totales</div>
              </div>
              <div className="bg-[#1a1828] border border-[#2a2830] rounded-xl p-4 text-center">
                <div className="font-fredoka text-2xl text-[#6bcb77]">{questions.filter(q => q.active).length}</div>
                <div className="text-[#6b6880] text-xs" style={{ marginTop: '4px' }}>Actives</div>
              </div>
              <div className="bg-[#1a1828] border border-[#2a2830] rounded-xl p-4 text-center">
                <div className="font-fredoka text-2xl text-[#ff6b6b]">{questions.filter(q => !q.active).length}</div>
                <div className="text-[#6b6880] text-xs" style={{ marginTop: '4px' }}>Inactives</div>
              </div>
            </div>

            <input
              type="text"
              placeholder="Rechercher une question..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full text-[#eeeaf8] text-sm outline-none"
              style={{ background: '#1a1828', border: `1.5px solid ${search ? '#ffd93d' : '#2a2830'}`, borderRadius: '12px', padding: '12px 16px', marginBottom: '16px' }}
            />

            <div className="grid grid-cols-4 gap-4" style={{ padding: '0 12px', marginBottom: '8px' }}>
              <p className="text-[#4a4760] text-xs font-bold uppercase tracking-wider col-span-2">Question</p>
              <p className="text-[#4a4760] text-xs font-bold uppercase tracking-wider">Catégorie / Diff.</p>
              <p className="text-[#4a4760] text-xs font-bold uppercase tracking-wider text-right">Actions</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {questionsFiltrees.map(q => (
                <div key={q.id} className="grid grid-cols-4 gap-4 items-center" style={{ background: '#1a1828', border: '1px solid #2a2830', borderRadius: '12px', padding: '12px 16px' }}>
                  <div className="col-span-2">
                    <p className="text-[#c9c4e0] text-sm font-semibold truncate">{q.question}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-fredoka text-xs rounded-full px-2 py-0.5" style={{ background: '#1e1c2e', color: '#9b96b8' }}>{q.category}</span>
                    <span className="font-fredoka text-xs" style={{ color: diffColors[q.difficulty] }}>{q.difficulty}</span>
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <div onClick={() => toggleQuestion(q.id)} className="rounded-full cursor-pointer relative" style={{ width: '40px', height: '20px', background: q.active ? '#6bcb77' : '#2a2830' }}>
                      <div className="rounded-full bg-white absolute" style={{ width: '16px', height: '16px', top: '2px', left: q.active ? '22px' : '2px', transition: 'left 0.2s' }}></div>
                    </div>
                    <Link href={`/admin/question/modifier/${q.id}`} className="flex items-center justify-center hover:opacity-80" style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#2a1f3d' }}>
                      <div className="w-3 h-3 rounded bg-[#a78bfa]"></div>
                    </Link>
                    <button onClick={() => deleteQuestion(q.id)} className="flex items-center justify-center hover:opacity-80" style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#2e1a1a' }}>
                      <div className="rounded bg-[#ff6b6b]" style={{ width: '12px', height: '3px' }}></div>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Panel Catégories */}
        {panel === 'categories' && (
          <div>
            <div className="flex justify-between items-start" style={{ marginBottom: '24px' }}>
              <div>
                <h2 className="font-fredoka text-2xl text-[#eeeaf8]">Catégories</h2>
                <p className="text-[#6b6880] text-sm" style={{ marginTop: '4px' }}>Gérer les thèmes disponibles</p>
              </div>
              <Link href="/admin/categorie/nouvelle" className="font-fredoka text-sm hover:opacity-90 transition" style={{ background: '#ffd93d', color: '#0f0e17', borderRadius: '12px', padding: '10px 20px' }}>
                + Ajouter
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-4" style={{ marginBottom: '24px' }}>
              <div className="bg-[#1a1828] border border-[#2a2830] rounded-xl p-4 text-center">
                <div className="font-fredoka text-2xl text-[#4ecdc4]">{categories.length}</div>
                <div className="text-[#6b6880] text-xs" style={{ marginTop: '4px' }}>Catégories</div>
              </div>
              <div className="bg-[#1a1828] border border-[#2a2830] rounded-xl p-4 text-center">
                <div className="font-fredoka text-2xl text-[#6bcb77]">{categories.filter(c => c.active).length}</div>
                <div className="text-[#6b6880] text-xs" style={{ marginTop: '4px' }}>Actives</div>
              </div>
              <div className="bg-[#1a1828] border border-[#2a2830] rounded-xl p-4 text-center">
                <div className="font-fredoka text-2xl text-[#ff6b6b]">{categories.filter(c => !c.active).length}</div>
                <div className="text-[#6b6880] text-xs" style={{ marginTop: '4px' }}>Inactives</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {categories.map(c => (
                <div key={c.id} className="flex items-center gap-4" style={{ background: '#1a1828', border: '1px solid #2a2830', borderRadius: '12px', padding: '12px 16px' }}>
                  <div className="w-2 h-2 rounded-full bg-[#4ecdc4]"></div>
                  <span className="font-fredoka text-[#eeeaf8] text-sm" style={{ flex: 1 }}>{c.name}</span>
                  <span className="text-[#6b6880] text-xs">{c.count} questions</span>
                  <div onClick={() => toggleCategory(c.id)} className="rounded-full cursor-pointer relative" style={{ width: '40px', height: '20px', background: c.active ? '#6bcb77' : '#2a2830' }}>
                    <div className="rounded-full bg-white absolute" style={{ width: '16px', height: '16px', top: '2px', left: c.active ? '22px' : '2px', transition: 'left 0.2s' }}></div>
                  </div>
                  <Link href={`/admin/categorie/modifier/${c.id}`} className="flex items-center justify-center hover:opacity-80" style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#1a2a2d' }}>
                    <div className="w-3 h-3 rounded bg-[#4ecdc4]"></div>
                  </Link>
                  <button onClick={() => deleteCategory(c.id)} className="flex items-center justify-center hover:opacity-80" style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#2e1a1a' }}>
                    <div className="rounded bg-[#ff6b6b]" style={{ width: '12px', height: '3px' }}></div>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Panel Utilisateurs */}
        {panel === 'users' && (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <h2 className="font-fredoka text-2xl text-[#eeeaf8]">Utilisateurs</h2>
              <p className="text-[#6b6880] text-sm" style={{ marginTop: '4px' }}>Classés par questions répondues</p>
            </div>

            <div className="grid grid-cols-3 gap-4" style={{ marginBottom: '24px' }}>
              <div className="bg-[#1a1828] border border-[#2a2830] rounded-xl p-4 text-center">
                <div className="font-fredoka text-2xl text-[#a78bfa]">{users.length}</div>
                <div className="text-[#6b6880] text-xs" style={{ marginTop: '4px' }}>Inscrits</div>
              </div>
              <div className="bg-[#1a1828] border border-[#2a2830] rounded-xl p-4 text-center">
                <div className="font-fredoka text-2xl text-[#6bcb77]">{users.filter(u => u.questions > 0).length}</div>
                <div className="text-[#6b6880] text-xs" style={{ marginTop: '4px' }}>Ont joué</div>
              </div>
              <div className="bg-[#1a1828] border border-[#2a2830] rounded-xl p-4 text-center">
                <div className="font-fredoka text-2xl text-[#ffd93d]">{totalQuestions.toLocaleString()}</div>
                <div className="text-[#6b6880] text-xs" style={{ marginTop: '4px' }}>Questions répondues</div>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-4" style={{ padding: '0 12px', marginBottom: '8px' }}>
              <p className="text-[#4a4760] text-xs font-bold uppercase tracking-wider">#</p>
              <p className="text-[#4a4760] text-xs font-bold uppercase tracking-wider col-span-2">Utilisateur</p>
              <p className="text-[#4a4760] text-xs font-bold uppercase tracking-wider text-center">Questions</p>
              <p className="text-[#4a4760] text-xs font-bold uppercase tracking-wider text-center">Réussite</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {users.map((u, i) => (
                <div
                  key={u.id}
                  className="grid grid-cols-5 gap-4 items-center"
                  style={{ background: i === 0 ? '#1f1e10' : '#1a1828', border: `1px solid ${i === 0 ? '#ffd93d' : '#2a2830'}`, borderRadius: '12px', padding: '12px 16px' }}
                >
                  <div className="font-fredoka text-sm" style={{ color: i === 0 ? '#ffd93d' : i === 1 ? '#9b96b8' : i === 2 ? '#ff9f43' : '#4a4760' }}>
                    {i + 1}
                  </div>
                  <div className="col-span-2">
                    <p className="font-fredoka text-[#eeeaf8] text-sm">{u.pseudo}</p>
                    <p className="text-[#4a4760] text-xs">{u.email}</p>
                  </div>
                  <div className="font-fredoka text-center" style={{ color: '#ffd93d' }}>{u.questions.toLocaleString()}</div>
                  <div className="font-fredoka text-center" style={{ color: u.reussite >= 70 ? '#6bcb77' : '#ffd93d' }}>{u.reussite}%</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
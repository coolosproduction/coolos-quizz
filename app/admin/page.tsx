'use client'

import { useState } from 'react'
import Link from 'next/link'

const questionsTest = [
  { id: '1', question: 'Quel événement a marqué le début de la Révolution française ?', answer: 'La prise de la Bastille, le 14 juillet 1789.', category: 'Histoire', difficulty: 'moyen', active: true },
  { id: '2', question: 'Quelle est la planète la plus proche du Soleil ?', answer: 'Mercure.', category: 'Sciences', difficulty: 'facile', active: true },
  { id: '3', question: 'Combien de joueurs composent une équipe de rugby à XV ?', answer: '15 joueurs.', category: 'Sport', difficulty: 'facile', active: false },
  { id: '4', question: 'Quel est le plus long fleuve du monde ?', answer: 'Le Nil (6 650 km).', category: 'Géographie', difficulty: 'difficile', active: true },
  { id: '5', question: 'Dans quel film apparaît Forrest Gump ?', answer: 'Forrest Gump (1994).', category: 'Cinéma', difficulty: 'facile', active: true },
]

const categoriesTest = [
  { id: '1', name: 'Histoire', active: true, count: 120 },
  { id: '2', name: 'Sciences', active: true, count: 95 },
  { id: '3', name: 'Sport', active: true, count: 88 },
  { id: '4', name: 'Géographie', active: true, count: 74 },
  { id: '5', name: 'Culture pop', active: true, count: 110 },
  { id: '6', name: 'Cinéma', active: false, count: 67 },
]

const usersTest = [
  { id: '1', pseudo: 'QuizMaster42', email: 'quizmaster@gmail.com', questions: 1842, reussite: 74, since: 'jan. 2026' },
  { id: '2', pseudo: 'CultGénérale', email: 'cg@hotmail.fr', questions: 1630, reussite: 81, since: 'fév. 2026' },
  { id: '3', pseudo: 'SophieQ', email: 'sophie.q@orange.fr', questions: 1204, reussite: 68, since: 'jan. 2026' },
  { id: '4', pseudo: 'Triviaman', email: 'trivia@gmail.com', questions: 987, reussite: 61, since: 'mars 2026' },
  { id: '5', pseudo: 'Léo_bzh', email: 'leo29@sfr.fr', questions: 754, reussite: 55, since: 'mars 2026' },
]

const diffColors: Record<string, string> = {
  facile: '#6bcb77',
  moyen: '#ffd93d',
  difficile: '#ff6b6b',
}

export default function Admin() {
  const [panel, setPanel] = useState<'questions' | 'categories' | 'users'>('questions')
  const [questions, setQuestions] = useState(questionsTest)
  const [categories, setCategories] = useState(categoriesTest)
  const [search, setSearch] = useState('')

  const toggleQuestion = (id: string) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, active: !q.active } : q))
  }

  const toggleCategory = (id: string) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, active: !c.active } : c))
  }

  const questionsFiltrees = questions.filter(q =>
    q.question.toLowerCase().includes(search.toLowerCase()) ||
    q.category.toLowerCase().includes(search.toLowerCase())
  )

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
                    <button className="flex items-center justify-center hover:opacity-80" style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#2a1f3d' }}>
                      <div className="w-3 h-3 rounded bg-[#a78bfa]"></div>
                    </button>
                    <button className="flex items-center justify-center hover:opacity-80" style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#2e1a1a' }}>
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
                  <button className="flex items-center justify-center hover:opacity-80" style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#2a1f3d' }}>
                    <div className="w-3 h-3 rounded bg-[#a78bfa]"></div>
                  </button>
                  <button className="flex items-center justify-center hover:opacity-80" style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#2e1a1a' }}>
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
                <div className="font-fredoka text-2xl text-[#a78bfa]">1 284</div>
                <div className="text-[#6b6880] text-xs" style={{ marginTop: '4px' }}>Inscrits</div>
              </div>
              <div className="bg-[#1a1828] border border-[#2a2830] rounded-xl p-4 text-center">
                <div className="font-fredoka text-2xl text-[#6bcb77]">847</div>
                <div className="text-[#6b6880] text-xs" style={{ marginTop: '4px' }}>Actifs ce mois</div>
              </div>
              <div className="bg-[#1a1828] border border-[#2a2830] rounded-xl p-4 text-center">
                <div className="font-fredoka text-2xl text-[#ffd93d]">48 320</div>
                <div className="text-[#6b6880] text-xs" style={{ marginTop: '4px' }}>Questions répondues</div>
              </div>
            </div>

            <input
              type="text"
              placeholder="Rechercher un pseudo ou email..."
              className="w-full text-[#eeeaf8] text-sm outline-none"
              style={{ background: '#1a1828', border: '1.5px solid #2a2830', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px' }}
            />

            <div className="grid grid-cols-5 gap-4" style={{ padding: '0 12px', marginBottom: '8px' }}>
              <p className="text-[#4a4760] text-xs font-bold uppercase tracking-wider">#</p>
              <p className="text-[#4a4760] text-xs font-bold uppercase tracking-wider col-span-2">Utilisateur</p>
              <p className="text-[#4a4760] text-xs font-bold uppercase tracking-wider text-center">Questions</p>
              <p className="text-[#4a4760] text-xs font-bold uppercase tracking-wider text-center">Réussite</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {usersTest.map((u, i) => (
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
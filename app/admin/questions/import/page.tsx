'use client'

import { useState } from 'react'
import Link from 'next/link'
import Papa from 'papaparse'
import { createClient } from '../../../../lib/supabase'
import BackButton from '@/components/BackButton'

type LigneImport = {
  ligneNum: number
  question: string
  answer: string
  categorieNom: string
  sousCategorieNom: string
  difficulteTexte: string
  statutTexte: string
  categoryId: string | null
  subcategoryId: string | null
  difficulty: string | null
  active: boolean
  erreur: string | null
}

const difficultesValides = ['facile', 'moyen', 'difficile', 'hardcore']

export default function ImportQuestions() {
  const [categories, setCategories] = useState<{ id: string, name: string }[]>([])
  const [subcategories, setSubcategories] = useState<{ id: string, name: string, category_id: string }[]>([])
  const [donneesChargees, setDonneesChargees] = useState(false)

  const [csvTexte, setCsvTexte] = useState('')
  const [nomFichier, setNomFichier] = useState('')
  const [lignes, setLignes] = useState<LigneImport[]>([])
  const [analyseFaite, setAnalyseFaite] = useState(false)
  const [importEnCours, setImportEnCours] = useState(false)
  const [importTermine, setImportTermine] = useState(false)
  const [resultatImport, setResultatImport] = useState({ reussies: 0, echouees: 0 })
  const [erreurGenerale, setErreurGenerale] = useState('')

  const chargerCategoriesEtSousCategories = async () => {
    if (donneesChargees) return
    const supabase = createClient()

    const { data: catsData } = await supabase
      .from('categories')
      .select('id, name')
      .order('name')
    if (catsData) setCategories(catsData)

    const { data: subsData } = await supabase
      .from('subcategories')
      .select('id, name, category_id')
      .order('name')
    if (subsData) setSubcategories(subsData)

    setDonneesChargees(true)
  }

  const normaliser = (texte: string) => texte.trim().toLowerCase()

  const trouverCategorieId = (nom: string, listeCategories: { id: string, name: string }[]) => {
    if (!nom.trim()) return null
    const trouvee = listeCategories.find(c => normaliser(c.name) === normaliser(nom))
    return trouvee ? trouvee.id : null
  }

  const trouverSousCategorieId = (nom: string, categoryId: string | null, listeSubs: { id: string, name: string, category_id: string }[]) => {
    if (!nom.trim() || !categoryId) return null
    const trouvee = listeSubs.find(s => s.category_id === categoryId && normaliser(s.name) === normaliser(nom))
    return trouvee ? trouvee.id : null
  }

  const normaliserStatut = (texte: string) => {
    const t = normaliser(texte)
    if (t === '' || t === 'actif' || t === 'true' || t === '1') return true
    if (t === 'inactif' || t === 'false' || t === '0') return false
    return null
  }

  const analyserLignes = (lignesCSV: Record<string, string>[], listeCategories: { id: string, name: string }[], listeSubs: { id: string, name: string, category_id: string }[]) => {
    const resultat: LigneImport[] = lignesCSV.map((row, index) => {
      const question = (row['question'] || '').trim()
      const answer = (row['réponse'] || row['reponse'] || row['answer'] || '').trim()
      const categorieNom = (row['catégorie'] || row['categorie'] || row['category'] || '').trim()
      const sousCategorieNom = (row['sous-catégorie'] || row['sous-categorie'] || row['subcategory'] || '').trim()
      const difficulteTexte = (row['difficulté'] || row['difficulte'] || row['difficulty'] || '').trim()
      const statutTexte = (row['statut'] || row['status'] || '').trim()

      const ligne: LigneImport = {
        ligneNum: index + 2, // +2 car ligne 1 = en-têtes, et on affiche en 1-indexé
        question,
        answer,
        categorieNom,
        sousCategorieNom,
        difficulteTexte,
        statutTexte,
        categoryId: null,
        subcategoryId: null,
        difficulty: null,
        active: true,
        erreur: null,
      }

      if (!question) {
        ligne.erreur = 'Question manquante'
        return ligne
      }
      if (!answer) {
        ligne.erreur = 'Réponse manquante'
        return ligne
      }
      if (!categorieNom) {
        ligne.erreur = 'Catégorie manquante'
        return ligne
      }

      const categoryId = trouverCategorieId(categorieNom, listeCategories)
      if (!categoryId) {
        ligne.erreur = `Catégorie introuvable : "${categorieNom}"`
        return ligne
      }
      ligne.categoryId = categoryId

      if (sousCategorieNom) {
        const subcategoryId = trouverSousCategorieId(sousCategorieNom, categoryId, listeSubs)
        if (!subcategoryId) {
          ligne.erreur = `Sous-catégorie introuvable pour cette catégorie : "${sousCategorieNom}"`
          return ligne
        }
        ligne.subcategoryId = subcategoryId
      }

      const difficulteNorm = normaliser(difficulteTexte)
      if (!difficultesValides.includes(difficulteNorm)) {
        ligne.erreur = `Difficulté invalide : "${difficulteTexte}" (attendu : facile, moyen, difficile, hardcore)`
        return ligne
      }
      ligne.difficulty = difficulteNorm

      const statut = normaliserStatut(statutTexte)
      if (statut === null) {
        ligne.erreur = `Statut invalide : "${statutTexte}" (attendu : actif ou inactif)`
        return ligne
      }
      ligne.active = statut

      return ligne
    })

    return resultat
  }

  const lancerAnalyse = async () => {
    setErreurGenerale('')
    if (!csvTexte.trim()) {
      setErreurGenerale('Colle un CSV ou choisis un fichier avant de lancer l\'analyse.')
      return
    }

    await chargerCategoriesEtSousCategories()

    Papa.parse(csvTexte.trim(), {
      header: true,
      skipEmptyLines: true,
      complete: (resultats) => {
        const listeCategories = categories.length > 0 ? categories : []
        const listeSubs = subcategories.length > 0 ? subcategories : []
        const lignesAnalysees = analyserLignes(resultats.data as Record<string, string>[], listeCategories, listeSubs)
        setLignes(lignesAnalysees)
        setAnalyseFaite(true)
        setImportTermine(false)
      },
      error: (err: Error) => {
        setErreurGenerale('Erreur de lecture du CSV : ' + err.message)
      },
    })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setNomFichier(file.name)
    const reader = new FileReader()
    reader.onload = (event) => {
      const texte = event.target?.result as string
      setCsvTexte(texte)
    }
    reader.readAsText(file)
  }

  const lignesValides = lignes.filter(l => !l.erreur)
  const lignesEnErreur = lignes.filter(l => l.erreur)

  const lancerImport = async () => {
    if (lignesValides.length === 0) return
    setImportEnCours(true)
    setErreurGenerale('')

    const supabase = createClient()

    const objetsAInserer = lignesValides.map(l => ({
      question_text: l.question,
      answer_text: l.answer,
      category_id: l.categoryId,
      subcategory_id: l.subcategoryId,
      difficulty: l.difficulty,
      active: l.active,
    }))

    const { error: insertError, data } = await supabase
      .from('questions')
      .insert(objetsAInserer)
      .select()

    setImportEnCours(false)

    if (insertError) {
      setErreurGenerale('Erreur lors de l\'import : ' + insertError.message)
      return
    }

    setResultatImport({
      reussies: data?.length || 0,
      echouees: lignesEnErreur.length,
    })
    setImportTermine(true)
  }

  const reinitialiser = () => {
    setCsvTexte('')
    setNomFichier('')
    setLignes([])
    setAnalyseFaite(false)
    setImportTermine(false)
    setErreurGenerale('')
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
          <div className="flex items-center gap-3">
            <BackButton />
            <div>
              <h2 className="font-fredoka text-2xl text-[#eeeaf8]">Import en masse</h2>
              <p className="text-[#6b6880] text-sm" style={{ marginTop: '4px' }}>
                Colle ou importe un CSV avec les colonnes : question, réponse, catégorie, sous-catégorie (optionnel), difficulté, statut (optionnel)
              </p>
            </div>
          </div>
          <Link href="/admin" className="font-fredoka text-sm hover:opacity-80 transition" style={{ border: '1.5px solid #3a3650', color: '#9b96b8', borderRadius: '12px', padding: '10px 20px' }}>
            ← Retour
          </Link>
        </div>

        <div style={{ maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {erreurGenerale && (
            <div style={{ background: '#2e1a1a', border: '1px solid #ff6b6b', borderRadius: '14px', padding: '14px 16px' }}>
              <p className="text-[#ff6b6b] text-sm">{erreurGenerale}</p>
            </div>
          )}

          {!analyseFaite && (
            <>
              {/* Upload fichier */}
              <div>
                <label className="block font-fredoka text-[#9b96b8] text-sm" style={{ marginBottom: '8px' }}>
                  Option 1 — Choisir un fichier CSV
                </label>
                <label
                  htmlFor="csv-upload"
                  className="w-full flex flex-col items-center justify-center cursor-pointer transition"
                  style={{ background: '#1a1828', border: '2px dashed #2a2830', borderRadius: '14px', padding: '32px' }}
                >
                  <p className="font-fredoka text-[#6b6880] text-sm">
                    {nomFichier ? `Fichier sélectionné : ${nomFichier}` : 'Cliquer pour choisir un fichier .csv'}
                  </p>
                </label>
                <input
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {/* Coller le CSV */}
              <div>
                <label className="block font-fredoka text-[#9b96b8] text-sm" style={{ marginBottom: '8px' }}>
                  Option 2 — Coller le contenu CSV directement
                </label>
                <textarea
                  value={csvTexte}
                  onChange={e => { setCsvTexte(e.target.value); setNomFichier('') }}
                  placeholder={'question,réponse,catégorie,sous-catégorie,difficulté,statut\nQuelle est la capitale de la France ?,Paris,Géographie,,facile,actif'}
                  rows={10}
                  className="w-full text-[#eeeaf8] text-sm outline-none resize-none font-mono"
                  style={{ background: '#1a1828', border: `1.5px solid ${csvTexte ? '#ffd93d' : '#3a3650'}`, borderRadius: '14px', padding: '14px 16px', lineHeight: '1.5' }}
                />
              </div>

              <button
                type="button"
                onClick={lancerAnalyse}
                className="font-fredoka text-lg hover:opacity-90 transition"
                style={{ background: '#ffd93d', color: '#0f0e17', borderRadius: '14px', padding: '14px' }}
              >
                Analyser le CSV
              </button>
            </>
          )}

          {analyseFaite && !importTermine && (
            <>
              {/* Résumé de l'analyse */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[#1a1828] border border-[#2a2830] rounded-xl p-4 text-center">
                  <div className="font-fredoka text-2xl text-[#eeeaf8]">{lignes.length}</div>
                  <div className="text-[#6b6880] text-xs" style={{ marginTop: '4px' }}>Lignes analysées</div>
                </div>
                <div className="bg-[#1a1828] border border-[#2a2830] rounded-xl p-4 text-center">
                  <div className="font-fredoka text-2xl text-[#6bcb77]">{lignesValides.length}</div>
                  <div className="text-[#6b6880] text-xs" style={{ marginTop: '4px' }}>Valides</div>
                </div>
                <div className="bg-[#1a1828] border border-[#2a2830] rounded-xl p-4 text-center">
                  <div className="font-fredoka text-2xl text-[#ff6b6b]">{lignesEnErreur.length}</div>
                  <div className="text-[#6b6880] text-xs" style={{ marginTop: '4px' }}>En erreur</div>
                </div>
              </div>

              {/* Tableau d'aperçu */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '500px', overflowY: 'auto' }}>
                {lignes.map(l => (
                  <div
                    key={l.ligneNum}
                    style={{
                      background: l.erreur ? '#2e1a1a' : '#1a1828',
                      border: `1px solid ${l.erreur ? '#ff6b6b' : '#2a2830'}`,
                      borderRadius: '12px',
                      padding: '12px 16px',
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="font-fredoka text-xs text-[#4a4760]" style={{ minWidth: '24px' }}>
                        L{l.ligneNum}
                      </span>
                      <div style={{ flex: 1 }}>
                        <p className="text-[#c9c4e0] text-sm font-semibold">{l.question || '(question manquante)'}</p>
                        {l.erreur ? (
                          <p className="text-[#ff6b6b] text-xs" style={{ marginTop: '4px' }}>⚠ {l.erreur}</p>
                        ) : (
                          <div className="flex items-center gap-2" style={{ marginTop: '4px' }}>
                            <span className="font-fredoka text-xs rounded-full px-2 py-0.5" style={{ background: '#1e1c2e', color: '#9b96b8' }}>{l.categorieNom}</span>
                            {l.sousCategorieNom && (
                              <span className="font-fredoka text-xs rounded-full px-2 py-0.5" style={{ background: '#1a2a2d', color: '#4ecdc4' }}>{l.sousCategorieNom}</span>
                            )}
                            <span className="font-fredoka text-xs text-[#9b96b8]">{l.difficulty}</span>
                            <span className="font-fredoka text-xs" style={{ color: l.active ? '#6bcb77' : '#ff9f43' }}>
                              {l.active ? 'actif' : 'inactif'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Boutons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={reinitialiser}
                  className="font-fredoka text-sm text-center hover:opacity-80 transition"
                  style={{ border: '1.5px solid #3a3650', color: '#9b96b8', borderRadius: '14px', padding: '14px 24px' }}
                >
                  Recommencer
                </button>
                <button
                  type="button"
                  onClick={lancerImport}
                  disabled={importEnCours || lignesValides.length === 0}
                  className="flex-1 font-fredoka text-lg hover:opacity-90 transition disabled:opacity-50"
                  style={{ background: '#6bcb77', color: '#0f0e17', borderRadius: '14px', padding: '14px' }}
                >
                  {importEnCours
                    ? 'Import en cours...'
                    : `Importer ${lignesValides.length} question${lignesValides.length > 1 ? 's' : ''} valide${lignesValides.length > 1 ? 's' : ''}`}
                </button>
              </div>
            </>
          )}

          {importTermine && (
            <>
              <div style={{ background: '#1a2e1f', border: '1px solid #6bcb77', borderRadius: '14px', padding: '20px' }}>
                <p className="font-fredoka text-[#6bcb77] text-lg">
                  ✓ {resultatImport.reussies} question{resultatImport.reussies > 1 ? 's' : ''} importée{resultatImport.reussies > 1 ? 's' : ''} avec succès
                </p>
                {resultatImport.echouees > 0 && (
                  <p className="text-[#9b96b8] text-sm" style={{ marginTop: '6px' }}>
                    {resultatImport.echouees} ligne{resultatImport.echouees > 1 ? 's' : ''} ignorée{resultatImport.echouees > 1 ? 's' : ''} pour cause d'erreur (voir détail ci-dessus avant de relancer)
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={reinitialiser}
                  className="font-fredoka text-sm hover:opacity-80 transition"
                  style={{ border: '1.5px solid #3a3650', color: '#9b96b8', borderRadius: '14px', padding: '14px 24px' }}
                >
                  Importer un autre CSV
                </button>
                <Link
                  href="/admin"
                  className="flex-1 font-fredoka text-lg text-center hover:opacity-90 transition"
                  style={{ background: '#ffd93d', color: '#0f0e17', borderRadius: '14px', padding: '14px' }}
                >
                  Retour à l'admin
                </Link>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
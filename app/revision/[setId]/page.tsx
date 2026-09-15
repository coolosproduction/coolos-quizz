'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase'
import { parseCloze, countBlanks, wrapSelectionAsBlank } from '../../../lib/cloze'
import BackButton from '@/components/BackButton'
import Skeleton, { SkeletonList } from '@/components/Skeleton'

type Card = { id: string, recto: string, verso: string, recto_image_path: string | null, verso_image_path: string | null }
type ClozeCard = { id: string, content: string }
type WorstCard = { card_id: string, recto: string, verso: string, non_count: number, attempts_count: number }
type SetOverview = { set_id: string, name: string, cards_count: number, sessions_count: number, last_session_at: string | null, success_rate: number, due_cards_count: number, cloze_cards_count: number }

// Rendu partagé d'un texte à trous : segments texte inchangés, segments trou affichés comme un
// espace souligné (aperçu de création/édition, et liste des cartes existantes).
function ClozePreview({ content, color }: { content: string, color: string }) {
  return (
    <>
      {parseCloze(content).map((seg, i) => seg.type === 'text'
        ? <span key={i}>{seg.value}</span>
        : <span key={i} className="font-fredoka" style={{ color, borderBottom: `2px solid ${color}` }}>▁▁▁▁▁</span>
      )}
    </>
  )
}

const performanceColor = (rate: number) => (rate >= 70 ? '#6bcb77' : rate >= 40 ? '#ffd93d' : '#ff6b6b')
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp,image/gif'

// Upload une image dans le bucket privé revision-images, chemin {user_id}/{uuid}.{ext} —
// découplé de l'id de la carte pour pouvoir uploader avant l'insert (ajout d'une nouvelle carte).
async function uploadCardImage(file: File, userId: string): Promise<string | null> {
  const supabase = createClient()
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${userId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('revision-images').upload(path, file)
  if (error) return null
  return path
}

async function deleteCardImages(paths: (string | null | undefined)[]) {
  const valid = paths.filter((p): p is string => !!p)
  if (valid.length === 0) return
  const supabase = createClient()
  await supabase.storage.from('revision-images').remove(valid)
}

async function getSignedImageUrls(paths: (string | null | undefined)[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths.filter((p): p is string => !!p)))
  if (unique.length === 0) return {}
  const supabase = createClient()
  const { data } = await supabase.storage.from('revision-images').createSignedUrls(unique, 3600)
  const map: Record<string, string> = {}
  ;(data || []).forEach(d => { if (d.signedUrl && d.path) map[d.path] = d.signedUrl })
  return map
}

export default function GererSet() {
  const params = useParams()
  const router = useRouter()
  const setId = params.setId as string

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [setName, setSetName] = useState('')
  const [cards, setCards] = useState<Card[]>([])
  const [overview, setOverview] = useState<SetOverview | null>(null)
  const [worstCards, setWorstCards] = useState<WorstCard[]>([])
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [userId, setUserId] = useState<string | null>(null)

  const [renaming, setRenaming] = useState(false)
  const [nameInput, setNameInput] = useState('')

  const [newRecto, setNewRecto] = useState('')
  const [newVerso, setNewVerso] = useState('')
  const [newRectoImage, setNewRectoImage] = useState<File | null>(null)
  const [newVersoImage, setNewVersoImage] = useState<File | null>(null)
  const [adding, setAdding] = useState(false)
  const [imageError, setImageError] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRecto, setEditRecto] = useState('')
  const [editVerso, setEditVerso] = useState('')
  const [editRectoImage, setEditRectoImage] = useState<File | null>(null)
  const [editVersoImage, setEditVersoImage] = useState<File | null>(null)
  const [editRemoveRectoImage, setEditRemoveRectoImage] = useState(false)
  const [editRemoveVersoImage, setEditRemoveVersoImage] = useState(false)

  const [confirmDeleteSet, setConfirmDeleteSet] = useState(false)
  const [confirmDeleteCard, setConfirmDeleteCard] = useState<string | null>(null)

  const [clozeCards, setClozeCards] = useState<ClozeCard[]>([])
  const [newClozeContent, setNewClozeContent] = useState('')
  const [addingCloze, setAddingCloze] = useState(false)
  const [clozeError, setClozeError] = useState('')
  const [editingClozeId, setEditingClozeId] = useState<string | null>(null)
  const [editClozeContent, setEditClozeContent] = useState('')
  const [confirmDeleteClozeCard, setConfirmDeleteClozeCard] = useState<string | null>(null)
  const newClozeTextareaRef = useRef<HTMLTextAreaElement>(null)
  const editClozeTextareaRef = useRef<HTMLTextAreaElement>(null)

  const [shareOpen, setShareOpen] = useState(false)
  const [shareLoaded, setShareLoaded] = useState(false)
  const [friends, setFriends] = useState<{ id: string, pseudo: string, avatar_url: string | null }[]>([])
  const [shares, setShares] = useState<{ share_id: string, friend_id: string }[]>([])
  const [shareActionId, setShareActionId] = useState<string | null>(null)
  const [publicLink, setPublicLink] = useState<{ token: string, expires_at: string } | null>(null)
  const [linkLoading, setLinkLoading] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  const validateImage = (file: File): boolean => {
    setImageError('')
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setImageError('Format non supporté (JPEG, PNG, WEBP ou GIF uniquement).')
      return false
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError('Image trop lourde (5 Mo maximum).')
      return false
    }
    return true
  }

  const loadAll = async () => {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()

    const { data: setData } = await supabase
      .from('revision_sets')
      .select('id, name, user_id')
      .eq('id', setId)
      .maybeSingle()

    if (!setData) { setNotFound(true); setLoading(false); return }
    if (user && setData.user_id !== user.id) {
      // Cette page de gestion est réservée au propriétaire du set — un ami à qui le set a
      // été partagé étudie depuis la liste "Partagés avec moi" de /revision, pas ici.
      router.push('/revision')
      return
    }
    setSetName(setData.name)
    setNameInput(setData.name)

    const { data: cardsData } = await supabase
      .from('revision_cards')
      .select('id, recto, verso, recto_image_path, verso_image_path')
      .eq('set_id', setId)
      .order('created_at', { ascending: true })
    const loadedCards = (cardsData || []) as Card[]
    setCards(loadedCards)

    const urls = await getSignedImageUrls(loadedCards.flatMap(c => [c.recto_image_path, c.verso_image_path]))
    setImageUrls(urls)

    const { data: clozeData } = await supabase
      .from('revision_cloze_cards')
      .select('id, content')
      .eq('set_id', setId)
      .order('created_at', { ascending: true })
    setClozeCards((clozeData || []) as ClozeCard[])

    const { data: overviewData } = await supabase.rpc('get_revision_sets_overview')
    const mine = ((overviewData || []) as SetOverview[]).find(o => o.set_id === setId) || null
    setOverview(mine)

    const { data: worstData } = await supabase.rpc('get_revision_worst_cards', { p_set_id: setId, p_limit: 3 })
    setWorstCards((worstData || []) as WorstCard[])

    setLoading(false)
  }

  const loadSharePanel = async () => {
    if (!userId) return
    const supabase = createClient()

    const { data: friendData } = await supabase
      .from('friend_requests')
      .select('id, requester_id, recipient_id, status')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
    const friendIds = (friendData || []).map(r => r.requester_id === userId ? r.recipient_id : r.requester_id)

    if (friendIds.length > 0) {
      const results = await Promise.all(
        friendIds.map(id => supabase.rpc('get_user_public_identity', { p_user_id: id }))
      )
      const list = results
        .map((res, i) => {
          const row = res.data && res.data.length > 0 ? res.data[0] : null
          return row ? { id: friendIds[i], pseudo: row.pseudo as string, avatar_url: row.avatar_url as string | null } : null
        })
        .filter((f): f is { id: string, pseudo: string, avatar_url: string | null } => !!f)
      setFriends(list)
    } else {
      setFriends([])
    }

    const { data: sharesData } = await supabase.rpc('get_my_shared_sets')
    const mine = ((sharesData || []) as { share_id: string, set_id: string, friend_id: string }[])
      .filter(s => s.set_id === setId)
      .map(s => ({ share_id: s.share_id, friend_id: s.friend_id }))
    setShares(mine)

    const { data: linkData } = await supabase
      .from('revision_set_public_links')
      .select('id, expires_at')
      .eq('set_id', setId)
      .maybeSingle()
    setPublicLink(linkData ? { token: linkData.id, expires_at: linkData.expires_at } : null)

    setShareLoaded(true)
  }

  const ouvrirPartage = async () => {
    setShareOpen(true)
    if (!shareLoaded) await loadSharePanel()
  }

  const handleTogglePartage = async (friendId: string) => {
    if (!userId) return
    setShareActionId(friendId)
    const supabase = createClient()
    const existing = shares.find(s => s.friend_id === friendId)
    if (existing) {
      await supabase.from('revision_set_shares').delete().eq('id', existing.share_id)
    } else {
      await supabase.from('revision_set_shares').insert({ set_id: setId, owner_id: userId, friend_id: friendId })
    }
    await loadSharePanel()
    setShareActionId(null)
  }

  const handleCreerLien = async () => {
    setLinkLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.rpc('create_revision_public_link', { p_set_id: setId })
    if (!error && data && data.length > 0) {
      setPublicLink({ token: data[0].token, expires_at: data[0].expires_at })
    }
    setLinkLoading(false)
  }

  const handleRevoquerLien = async () => {
    setLinkLoading(true)
    const supabase = createClient()
    await supabase.from('revision_set_public_links').delete().eq('set_id', setId)
    setPublicLink(null)
    setLinkLoading(false)
  }

  const copierLien = () => {
    if (!publicLink) return
    const url = `${window.location.origin}/revision/partage/${publicLink.token}`
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    })
  }

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/connexion'); return }
      setUserId(user.id)
      await loadAll()
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId])

  const handleRenommer = async () => {
    const name = nameInput.trim()
    if (!name) return
    const supabase = createClient()
    await supabase.from('revision_sets').update({ name, updated_at: new Date().toISOString() }).eq('id', setId)
    setSetName(name)
    setRenaming(false)
  }

  const handleSupprimerSet = async () => {
    const supabase = createClient()
    await supabase.from('revision_sets').delete().eq('id', setId)
    router.push('/revision')
  }

  const handleAjouterCarte = async () => {
    const recto = newRecto.trim()
    const verso = newVerso.trim()
    if (!recto || !verso || !userId) return
    setAdding(true)
    setImageError('')

    let rectoImagePath: string | null = null
    let versoImagePath: string | null = null
    if (newRectoImage) {
      rectoImagePath = await uploadCardImage(newRectoImage, userId)
      if (!rectoImagePath) { setImageError("Échec de l'upload de l'image recto."); setAdding(false); return }
    }
    if (newVersoImage) {
      versoImagePath = await uploadCardImage(newVersoImage, userId)
      if (!versoImagePath) {
        setImageError("Échec de l'upload de l'image verso.")
        await deleteCardImages([rectoImagePath])
        setAdding(false)
        return
      }
    }

    const supabase = createClient()
    const { error } = await supabase.from('revision_cards').insert({
      set_id: setId, recto, verso,
      recto_image_path: rectoImagePath, verso_image_path: versoImagePath,
    })
    if (error) {
      await deleteCardImages([rectoImagePath, versoImagePath])
      setImageError("Impossible d'ajouter cette carte.")
      setAdding(false)
      return
    }
    setNewRecto('')
    setNewVerso('')
    setNewRectoImage(null)
    setNewVersoImage(null)
    await loadAll()
    setAdding(false)
  }

  const commencerEdition = (card: Card) => {
    setEditingId(card.id)
    setEditRecto(card.recto)
    setEditVerso(card.verso)
    setEditRectoImage(null)
    setEditVersoImage(null)
    setEditRemoveRectoImage(false)
    setEditRemoveVersoImage(false)
    setImageError('')
  }

  const handleSauvegarderEdition = async (cardId: string) => {
    const recto = editRecto.trim()
    const verso = editVerso.trim()
    if (!recto || !verso || !userId) return
    const card = cards.find(c => c.id === cardId)
    if (!card) return
    setImageError('')

    let rectoImagePath = card.recto_image_path
    let versoImagePath = card.verso_image_path
    const oldPathsToDelete: string[] = []

    if (editRectoImage) {
      const uploaded = await uploadCardImage(editRectoImage, userId)
      if (!uploaded) { setImageError("Échec de l'upload de l'image recto."); return }
      if (card.recto_image_path) oldPathsToDelete.push(card.recto_image_path)
      rectoImagePath = uploaded
    } else if (editRemoveRectoImage && card.recto_image_path) {
      oldPathsToDelete.push(card.recto_image_path)
      rectoImagePath = null
    }

    if (editVersoImage) {
      const uploaded = await uploadCardImage(editVersoImage, userId)
      if (!uploaded) { setImageError("Échec de l'upload de l'image verso."); return }
      if (card.verso_image_path) oldPathsToDelete.push(card.verso_image_path)
      versoImagePath = uploaded
    } else if (editRemoveVersoImage && card.verso_image_path) {
      oldPathsToDelete.push(card.verso_image_path)
      versoImagePath = null
    }

    const supabase = createClient()
    const { error } = await supabase
      .from('revision_cards')
      .update({ recto, verso, recto_image_path: rectoImagePath, verso_image_path: versoImagePath })
      .eq('id', cardId)
    if (error) { setImageError('Impossible de sauvegarder cette carte.'); return }

    await deleteCardImages(oldPathsToDelete)
    setEditingId(null)
    await loadAll()
  }

  const handleSupprimerCarte = async (cardId: string) => {
    const card = cards.find(c => c.id === cardId)
    const supabase = createClient()
    await supabase.from('revision_cards').delete().eq('id', cardId)
    if (card) await deleteCardImages([card.recto_image_path, card.verso_image_path])
    setConfirmDeleteCard(null)
    await loadAll()
  }

  const handleMarquerTrouNew = () => {
    const ta = newClozeTextareaRef.current
    if (!ta) return
    const result = wrapSelectionAsBlank(newClozeContent, ta.selectionStart, ta.selectionEnd)
    if (!result) return
    setNewClozeContent(result.content)
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(result.cursor, result.cursor) })
  }

  const handleMarquerTrouEdit = () => {
    const ta = editClozeTextareaRef.current
    if (!ta) return
    const result = wrapSelectionAsBlank(editClozeContent, ta.selectionStart, ta.selectionEnd)
    if (!result) return
    setEditClozeContent(result.content)
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(result.cursor, result.cursor) })
  }

  const handleAjouterClozeCard = async () => {
    const content = newClozeContent.trim()
    if (!content) return
    if (countBlanks(content) === 0) {
      setClozeError('Ajoute au moins un trou avec le bouton "Marquer comme trou" ou la syntaxe {{mot}}.')
      return
    }
    setAddingCloze(true)
    setClozeError('')
    const supabase = createClient()
    const { error } = await supabase.from('revision_cloze_cards').insert({ set_id: setId, content })
    if (error) {
      setClozeError("Impossible d'ajouter cette carte.")
      setAddingCloze(false)
      return
    }
    setNewClozeContent('')
    await loadAll()
    setAddingCloze(false)
  }

  const commencerEditionCloze = (card: ClozeCard) => {
    setEditingClozeId(card.id)
    setEditClozeContent(card.content)
    setClozeError('')
  }

  const handleSauvegarderEditionCloze = async (cardId: string) => {
    const content = editClozeContent.trim()
    if (!content) return
    if (countBlanks(content) === 0) {
      setClozeError('Ajoute au moins un trou avant de sauvegarder.')
      return
    }
    const supabase = createClient()
    const { error } = await supabase.from('revision_cloze_cards').update({ content }).eq('id', cardId)
    if (error) { setClozeError('Impossible de sauvegarder cette carte.'); return }
    setEditingClozeId(null)
    setClozeError('')
    await loadAll()
  }

  const handleSupprimerClozeCard = async (cardId: string) => {
    const supabase = createClient()
    await supabase.from('revision_cloze_cards').delete().eq('id', cardId)
    setConfirmDeleteClozeCard(null)
    await loadAll()
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0f0e17]" style={{ padding: '32px 24px 60px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>
          <div className="flex items-center gap-3">
            <BackButton />
            <Skeleton width="220px" height={32} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Skeleton height={72} radius="16px" />
            <Skeleton height={72} radius="16px" />
            <Skeleton height={72} radius="16px" />
          </div>
          <SkeletonList count={3} avatar={false} />
        </div>
      </main>
    )
  }

  if (notFound) {
    return (
      <main className="min-h-screen bg-[#0f0e17] flex flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="font-fredoka text-[#ff6b6b] text-xl">Ce set est introuvable.</p>
        <Link href="/revision" className="bg-[#ffd93d] text-[#0f0e17] rounded-2xl py-3 px-8 font-fredoka text-lg">
          Retour à mes révisions
        </Link>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#0f0e17]" style={{ padding: '32px 24px 60px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>

        <div className="flex items-center gap-3">
          <BackButton />
          <div className="flex-1 min-w-0">
            {renaming ? (
              <div className="flex gap-2 items-center flex-wrap">
                <input
                  type="text"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleRenommer()}
                  maxLength={60}
                  autoFocus
                  className="bg-[#0f0e17] border border-[#a78bfa] rounded-xl px-3 py-2 text-[#eeeaf8] font-fredoka text-xl outline-none"
                />
                <button onClick={handleRenommer} className="font-fredoka text-xs rounded-full px-3 py-1.5 hover:opacity-80 transition" style={{ background: '#a78bfa', color: '#0f0e17' }}>
                  Sauver
                </button>
                <button onClick={() => { setRenaming(false); setNameInput(setName) }} className="font-fredoka text-xs text-[#827f97] hover:text-[#c9c4e0] transition">
                  Annuler
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-fredoka text-3xl text-[#eeeaf8]">{setName}</h1>
                <button onClick={() => setRenaming(true)} className="font-fredoka text-xs text-[#827f97] hover:text-[#a78bfa] transition">
                  Renommer
                </button>
              </div>
            )}
          </div>
          <button
            onClick={ouvrirPartage}
            className="font-fredoka text-xs rounded-full px-4 py-2 flex-shrink-0 transition hover:opacity-80"
            style={{ background: '#2a1f3d', color: '#a78bfa', border: '1px solid #3a2d5a' }}
          >
            🔗 Partager
          </button>
        </div>

        {/* Panneau de partage */}
        {shareOpen && (
          <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="flex justify-between items-center">
              <p className="font-fredoka text-[#c9c4e0] text-base">Partager ce set</p>
              <button onClick={() => setShareOpen(false)} className="text-[#827f97] hover:text-[#c9c4e0] text-sm transition">✕</button>
            </div>

            {!shareLoaded ? (
              <Skeleton height={80} radius="16px" />
            ) : (
              <>
                <div>
                  <p className="text-[#9b96b8] text-sm mb-2">
                    À un ami — accès en lecture, modes Classique et Flashcard uniquement (même s'il n'est pas premium).
                  </p>
                  {friends.length === 0 ? (
                    <p className="text-[#827f97] text-xs">Tu n'as pas encore d'amis à qui partager ce set.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {friends.map(f => {
                        const partage = shares.find(s => s.friend_id === f.id)
                        return (
                          <div key={f.id} className="flex justify-between items-center bg-[#0f0e17] rounded-xl px-3 py-2">
                            <span className="text-[#c9c4e0] text-sm">{f.pseudo}</span>
                            <button
                              onClick={() => handleTogglePartage(f.id)}
                              disabled={shareActionId === f.id}
                              className="font-fredoka text-xs rounded-full px-3 py-1.5 disabled:opacity-50 transition hover:opacity-80"
                              style={partage
                                ? { background: '#1a2e1f', color: '#6bcb77', border: '1px solid #2a4a30' }
                                : { background: 'transparent', color: '#9b96b8', border: '1px solid #3a3650' }}
                            >
                              {partage ? '✓ Partagé · Retirer' : 'Partager'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div style={{ borderTop: '1px solid #232035', paddingTop: '16px' }}>
                  <p className="text-[#9b96b8] text-sm mb-2">
                    Par lien public — consultable sans compte, en lecture seule, expire 7 jours après création.
                  </p>
                  {publicLink ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="bg-[#0f0e17] text-[#4ecdc4] text-xs rounded-lg px-3 py-2 truncate" style={{ maxWidth: '100%' }}>
                          {`${typeof window !== 'undefined' ? window.location.origin : ''}/revision/partage/${publicLink.token}`}
                        </code>
                        <button onClick={copierLien} className="font-fredoka text-xs rounded-full px-3 py-1.5 hover:opacity-80 transition" style={{ background: '#1a2a2d', color: '#4ecdc4', border: '1px solid #4ecdc4' }}>
                          {linkCopied ? '✓ Copié' : 'Copier'}
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[#827f97] text-xs">
                          Expire le {new Date(publicLink.expires_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                        <button onClick={handleRevoquerLien} disabled={linkLoading} className="font-fredoka text-xs text-[#827f97] hover:text-[#ff6b6b] transition disabled:opacity-50">
                          Révoquer
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={handleCreerLien}
                      disabled={linkLoading}
                      className="font-fredoka text-xs rounded-full px-4 py-2 disabled:opacity-50 transition hover:opacity-80"
                      style={{ background: '#1a2a2d', color: '#4ecdc4', border: '1px solid #4ecdc4' }}
                    >
                      {linkLoading ? 'Création...' : 'Créer un lien public'}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Stats légères */}
        {overview && (
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-4 text-center">
              <div className="font-fredoka text-2xl text-[#ffd93d]">{overview.cards_count}</div>
              <div className="text-[#827f97] text-xs">Cartes</div>
            </div>
            <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-4 text-center">
              <div className="font-fredoka text-2xl text-[#4ecdc4]">{overview.sessions_count}</div>
              <div className="text-[#827f97] text-xs">Sessions</div>
            </div>
            <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-4 text-center">
              <div className="font-fredoka text-2xl" style={{ color: overview.sessions_count > 0 ? performanceColor(overview.success_rate) : '#827f97' }}>
                {overview.sessions_count > 0 ? `${overview.success_rate}%` : '—'}
              </div>
              <div className="text-[#827f97] text-xs">Réussite</div>
            </div>
            <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-4 text-center">
              <div className="font-fredoka text-2xl" style={{ color: overview.due_cards_count > 0 ? '#ffd93d' : '#827f97' }}>
                {overview.due_cards_count}
              </div>
              <div className="text-[#827f97] text-xs">Dues aujourd'hui</div>
            </div>
          </div>
        )}

        {worstCards.length > 0 && (
          <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl" style={{ padding: '16px 20px' }}>
            <p className="font-fredoka text-[#c9c4e0] text-base mb-3">Cartes les plus ratées</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {worstCards.map(w => (
                <div key={w.card_id} className="flex justify-between items-center gap-3 bg-[#0f0e17] rounded-lg px-3 py-2">
                  <span className="text-[#c9c4e0] text-sm truncate">{w.recto}</span>
                  <span className="text-[#ff6b6b] text-xs font-fredoka flex-shrink-0">{w.non_count}/{w.attempts_count} ratées</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lancer une session */}
        {(cards.length > 0 || clozeCards.length > 0) ? (
          <div className="flex gap-3 flex-wrap">
            {cards.length > 0 && (
              <>
                <Link href={`/revision/etudier/${setId}?mode=classique`} className="flex-1 rounded-2xl py-4 font-fredoka text-lg text-center hover:opacity-90 transition" style={{ background: '#2a1f3d', color: '#a78bfa', border: '1px solid #a78bfa', minWidth: '200px' }}>
                  Étudier — Classique →
                </Link>
                <Link href={`/revision/etudier/${setId}?mode=flashcard`} className="flex-1 rounded-2xl py-4 font-fredoka text-lg text-center hover:opacity-90 transition" style={{ background: '#1a2a2d', color: '#4ecdc4', border: '1px solid #4ecdc4', minWidth: '200px' }}>
                  Étudier — Flashcard →
                </Link>
                {overview && overview.due_cards_count > 0 ? (
                  <Link href={`/revision/etudier/${setId}?mode=programmee`} className="flex-1 rounded-2xl py-4 font-fredoka text-lg text-center hover:opacity-90 transition" style={{ background: '#1f1e10', color: '#ffd93d', border: '1px solid #ffd93d', minWidth: '200px' }}>
                    Réviser ({overview.due_cards_count} due{overview.due_cards_count > 1 ? 's' : ''}) →
                  </Link>
                ) : (
                  <div className="flex-1 rounded-2xl py-4 font-fredoka text-lg text-center" style={{ background: '#1a1828', color: '#4a4758', border: '1px solid #2a2830', minWidth: '200px' }}>
                    Rien à réviser aujourd'hui
                  </div>
                )}
              </>
            )}
            {clozeCards.length > 0 && (
              <Link href={`/revision/etudier-trous/${setId}`} className="flex-1 rounded-2xl py-4 font-fredoka text-lg text-center hover:opacity-90 transition" style={{ background: '#132417', color: '#6bcb77', border: '1px solid #6bcb77', minWidth: '200px' }}>
                📝 Étudier — Trous →
              </Link>
            )}
          </div>
        ) : (
          <p className="text-[#827f97] text-sm text-center">Ajoute au moins une carte ci-dessous pour pouvoir étudier ce set.</p>
        )}

        {/* Ajouter une carte */}
        <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-5">
          <p className="font-fredoka text-[#c9c4e0] text-base mb-3">Ajouter une carte</p>
          <div className="flex gap-3 flex-wrap mb-3">
            <div className="flex-1" style={{ minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <textarea
                value={newRecto}
                onChange={e => setNewRecto(e.target.value)}
                placeholder="Recto (question)"
                rows={2}
                maxLength={500}
                className="w-full bg-[#0f0e17] border border-[#3a3650] rounded-xl px-4 py-3 text-[#eeeaf8] text-sm outline-none focus:border-[#a78bfa] resize-none"
              />
              <label className="font-fredoka text-xs text-[#827f97] hover:text-[#a78bfa] transition cursor-pointer inline-flex items-center gap-2">
                🖼 {newRectoImage ? newRectoImage.name : 'Ajouter une image (optionnel)'}
                <input
                  type="file"
                  accept={ACCEPTED_IMAGE_TYPES}
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f && validateImage(f)) setNewRectoImage(f) }}
                />
              </label>
            </div>
            <div className="flex-1" style={{ minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <textarea
                value={newVerso}
                onChange={e => setNewVerso(e.target.value)}
                placeholder="Verso (réponse)"
                rows={2}
                maxLength={500}
                className="w-full bg-[#0f0e17] border border-[#3a3650] rounded-xl px-4 py-3 text-[#eeeaf8] text-sm outline-none focus:border-[#a78bfa] resize-none"
              />
              <label className="font-fredoka text-xs text-[#827f97] hover:text-[#a78bfa] transition cursor-pointer inline-flex items-center gap-2">
                🖼 {newVersoImage ? newVersoImage.name : 'Ajouter une image (optionnel)'}
                <input
                  type="file"
                  accept={ACCEPTED_IMAGE_TYPES}
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f && validateImage(f)) setNewVersoImage(f) }}
                />
              </label>
            </div>
          </div>
          {imageError && <p className="text-[#ff6b6b] text-xs mb-3">{imageError}</p>}
          <button
            onClick={handleAjouterCarte}
            disabled={adding || !newRecto.trim() || !newVerso.trim()}
            className="bg-[#ffd93d] text-[#0f0e17] rounded-xl px-6 py-3 font-fredoka text-sm hover:opacity-90 transition disabled:opacity-50"
          >
            {adding ? 'Ajout...' : '+ Ajouter la carte'}
          </button>
        </div>

        {/* Liste des cartes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {cards.length === 0 ? (
            <p className="text-[#827f97] text-sm text-center">Aucune carte pour l'instant.</p>
          ) : cards.map(c => (
            <div key={c.id} className="bg-[#1a1828] border border-[#2a2830] rounded-xl" style={{ padding: '14px 18px' }}>
              {editingId === c.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <textarea
                      value={editRecto}
                      onChange={e => setEditRecto(e.target.value)}
                      rows={2}
                      maxLength={500}
                      className="w-full bg-[#0f0e17] border border-[#a78bfa] rounded-xl px-4 py-3 text-[#eeeaf8] text-sm outline-none resize-none"
                    />
                    {c.recto_image_path && !editRemoveRectoImage && !editRectoImage && (
                      <div className="flex items-center gap-2">
                        {imageUrls[c.recto_image_path] && (
                          <img src={imageUrls[c.recto_image_path]} alt="" className="rounded-lg" style={{ width: '48px', height: '48px', objectFit: 'cover' }} />
                        )}
                        <button onClick={() => setEditRemoveRectoImage(true)} className="font-fredoka text-xs text-[#827f97] hover:text-[#ff6b6b] transition">
                          Retirer l'image
                        </button>
                      </div>
                    )}
                    <label className="font-fredoka text-xs text-[#827f97] hover:text-[#a78bfa] transition cursor-pointer inline-flex items-center gap-2">
                      🖼 {editRectoImage ? editRectoImage.name : (c.recto_image_path && !editRemoveRectoImage ? 'Remplacer l\'image' : 'Ajouter une image')}
                      <input
                        type="file"
                        accept={ACCEPTED_IMAGE_TYPES}
                        className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f && validateImage(f)) { setEditRectoImage(f); setEditRemoveRectoImage(false) } }}
                      />
                    </label>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <textarea
                      value={editVerso}
                      onChange={e => setEditVerso(e.target.value)}
                      rows={2}
                      maxLength={500}
                      className="w-full bg-[#0f0e17] border border-[#a78bfa] rounded-xl px-4 py-3 text-[#eeeaf8] text-sm outline-none resize-none"
                    />
                    {c.verso_image_path && !editRemoveVersoImage && !editVersoImage && (
                      <div className="flex items-center gap-2">
                        {imageUrls[c.verso_image_path] && (
                          <img src={imageUrls[c.verso_image_path]} alt="" className="rounded-lg" style={{ width: '48px', height: '48px', objectFit: 'cover' }} />
                        )}
                        <button onClick={() => setEditRemoveVersoImage(true)} className="font-fredoka text-xs text-[#827f97] hover:text-[#ff6b6b] transition">
                          Retirer l'image
                        </button>
                      </div>
                    )}
                    <label className="font-fredoka text-xs text-[#827f97] hover:text-[#a78bfa] transition cursor-pointer inline-flex items-center gap-2">
                      🖼 {editVersoImage ? editVersoImage.name : (c.verso_image_path && !editRemoveVersoImage ? 'Remplacer l\'image' : 'Ajouter une image')}
                      <input
                        type="file"
                        accept={ACCEPTED_IMAGE_TYPES}
                        className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f && validateImage(f)) { setEditVersoImage(f); setEditRemoveVersoImage(false) } }}
                      />
                    </label>
                  </div>
                  {imageError && <p className="text-[#ff6b6b] text-xs">{imageError}</p>}
                  <div className="flex gap-2">
                    <button onClick={() => handleSauvegarderEdition(c.id)} className="font-fredoka text-xs rounded-full px-4 py-2 hover:opacity-80 transition" style={{ background: '#a78bfa', color: '#0f0e17' }}>
                      Sauvegarder
                    </button>
                    <button onClick={() => setEditingId(null)} className="font-fredoka text-xs text-[#827f97] hover:text-[#c9c4e0] transition">
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-0" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div className="flex items-center gap-2">
                      {c.recto_image_path && imageUrls[c.recto_image_path] && (
                        <img src={imageUrls[c.recto_image_path]} alt="" className="rounded-lg flex-shrink-0" style={{ width: '32px', height: '32px', objectFit: 'cover' }} />
                      )}
                      <p className="text-[#eeeaf8] text-sm"><span className="text-[#827f97]">Recto : </span>{c.recto}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.verso_image_path && imageUrls[c.verso_image_path] && (
                        <img src={imageUrls[c.verso_image_path]} alt="" className="rounded-lg flex-shrink-0" style={{ width: '32px', height: '32px', objectFit: 'cover' }} />
                      )}
                      <p className="text-[#c9c4e0] text-sm"><span className="text-[#827f97]">Verso : </span>{c.verso}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => commencerEdition(c)} className="font-fredoka text-xs text-[#827f97] hover:text-[#a78bfa] transition">
                      Modifier
                    </button>
                    {confirmDeleteCard === c.id ? (
                      <>
                        <button onClick={() => handleSupprimerCarte(c.id)} className="font-fredoka text-xs rounded-full px-3 py-1.5 hover:opacity-80 transition" style={{ background: '#ff6b6b', color: '#0f0e17' }}>
                          Confirmer
                        </button>
                        <button onClick={() => setConfirmDeleteCard(null)} className="font-fredoka text-xs text-[#827f97] hover:text-[#c9c4e0] transition">
                          Annuler
                        </button>
                      </>
                    ) : (
                      <button onClick={() => setConfirmDeleteCard(c.id)} className="font-fredoka text-xs text-[#827f97] hover:text-[#ff6b6b] transition">
                        Supprimer
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Ajouter une carte à trous */}
        <div className="bg-[#1a1828] border border-[#2a2830] rounded-2xl p-5">
          <p className="font-fredoka text-[#c9c4e0] text-base mb-1">📝 Ajouter une carte à trous</p>
          <p className="text-[#827f97] text-xs mb-3">
            Écris ton texte, sélectionne un mot ou un groupe de mots puis clique sur "Marquer comme trou"
            (ou tape directement {'{{mot}}'} autour du passage à cacher).
          </p>
          <textarea
            ref={newClozeTextareaRef}
            value={newClozeContent}
            onChange={e => setNewClozeContent(e.target.value)}
            placeholder="Ex. La Mésopotamie se situe entre le {{Tigre}} et l'{{Euphrate}}."
            rows={4}
            maxLength={2000}
            className="w-full bg-[#0f0e17] border border-[#3a3650] rounded-xl px-4 py-3 text-[#eeeaf8] text-sm outline-none focus:border-[#6bcb77] resize-none mb-3"
          />
          <div className="flex items-center gap-3 flex-wrap mb-3">
            <button
              onClick={handleMarquerTrouNew}
              className="font-fredoka text-xs rounded-full px-4 py-2 hover:opacity-80 transition"
              style={{ background: '#132417', color: '#6bcb77', border: '1px solid #6bcb77' }}
            >
              🕳️ Marquer comme trou
            </button>
            <span className="text-[#827f97] text-xs">
              {countBlanks(newClozeContent)} trou{countBlanks(newClozeContent) !== 1 ? 's' : ''}
            </span>
          </div>
          {newClozeContent && (
            <div className="bg-[#0f0e17] border border-[#2a2830] rounded-xl px-4 py-3 mb-3">
              <p className="text-[#827f97] text-xs mb-2">Aperçu</p>
              <p className="text-[#c9c4e0] text-sm leading-relaxed">
                <ClozePreview content={newClozeContent} color="#6bcb77" />
              </p>
            </div>
          )}
          {clozeError && <p className="text-[#ff6b6b] text-xs mb-3">{clozeError}</p>}
          <button
            onClick={handleAjouterClozeCard}
            disabled={addingCloze || !newClozeContent.trim()}
            className="bg-[#6bcb77] text-[#0f0e17] rounded-xl px-6 py-3 font-fredoka text-sm hover:opacity-90 transition disabled:opacity-50"
          >
            {addingCloze ? 'Ajout...' : '+ Ajouter la carte'}
          </button>
        </div>

        {/* Liste des cartes à trous */}
        {clozeCards.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p className="font-fredoka text-[#c9c4e0] text-base">Cartes à trous ({clozeCards.length})</p>
            {clozeCards.map(c => (
              <div key={c.id} className="bg-[#1a1828] border border-[#2a2830] rounded-xl" style={{ padding: '14px 18px' }}>
                {editingClozeId === c.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <textarea
                      ref={editClozeTextareaRef}
                      value={editClozeContent}
                      onChange={e => setEditClozeContent(e.target.value)}
                      rows={4}
                      maxLength={2000}
                      className="w-full bg-[#0f0e17] border border-[#6bcb77] rounded-xl px-4 py-3 text-[#eeeaf8] text-sm outline-none resize-none"
                    />
                    <div className="flex items-center gap-3 flex-wrap">
                      <button
                        onClick={handleMarquerTrouEdit}
                        className="font-fredoka text-xs rounded-full px-4 py-2 hover:opacity-80 transition"
                        style={{ background: '#132417', color: '#6bcb77', border: '1px solid #6bcb77' }}
                      >
                        🕳️ Marquer comme trou
                      </button>
                      <span className="text-[#827f97] text-xs">
                        {countBlanks(editClozeContent)} trou{countBlanks(editClozeContent) !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {clozeError && <p className="text-[#ff6b6b] text-xs">{clozeError}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => handleSauvegarderEditionCloze(c.id)} className="font-fredoka text-xs rounded-full px-4 py-2 hover:opacity-80 transition" style={{ background: '#6bcb77', color: '#0f0e17' }}>
                        Sauvegarder
                      </button>
                      <button onClick={() => { setEditingClozeId(null); setClozeError('') }} className="font-fredoka text-xs text-[#827f97] hover:text-[#c9c4e0] transition">
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-start gap-3 flex-wrap">
                    <p className="text-[#c9c4e0] text-sm flex-1 min-w-0 leading-relaxed">
                      <ClozePreview content={c.content} color="#6bcb77" />
                    </p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => commencerEditionCloze(c)} className="font-fredoka text-xs text-[#827f97] hover:text-[#6bcb77] transition">
                        Modifier
                      </button>
                      {confirmDeleteClozeCard === c.id ? (
                        <>
                          <button onClick={() => handleSupprimerClozeCard(c.id)} className="font-fredoka text-xs rounded-full px-3 py-1.5 hover:opacity-80 transition" style={{ background: '#ff6b6b', color: '#0f0e17' }}>
                            Confirmer
                          </button>
                          <button onClick={() => setConfirmDeleteClozeCard(null)} className="font-fredoka text-xs text-[#827f97] hover:text-[#c9c4e0] transition">
                            Annuler
                          </button>
                        </>
                      ) : (
                        <button onClick={() => setConfirmDeleteClozeCard(c.id)} className="font-fredoka text-xs text-[#827f97] hover:text-[#ff6b6b] transition">
                          Supprimer
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Supprimer le set */}
        <div style={{ borderTop: '1px solid #1e1c2e', paddingTop: '20px' }}>
          {confirmDeleteSet ? (
            <div className="flex items-center gap-3 justify-center">
              <span className="text-[#9b96b8] text-sm">Supprimer définitivement ce set et toutes ses cartes ?</span>
              <button onClick={handleSupprimerSet} className="font-fredoka text-sm rounded-full px-4 py-2 hover:opacity-80 transition" style={{ background: '#ff6b6b', color: '#0f0e17' }}>
                Confirmer
              </button>
              <button onClick={() => setConfirmDeleteSet(false)} className="font-fredoka text-sm text-[#827f97] hover:text-[#c9c4e0] transition">
                Annuler
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmDeleteSet(true)} className="w-full text-[#827f97] text-sm font-semibold hover:text-[#ff6b6b] transition text-center">
              Supprimer ce set
            </button>
          )}
        </div>

      </div>
    </main>
  )
}

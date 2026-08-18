'use client'

// Chat en direct d'une salle multijoueur — présent en salle d'attente,
// pendant le quiz et pendant la correction (jamais sur la page résultats,
// ni de chat général hors salle). Panneau flottant en bas à droite plutôt
// qu'intégré au flux de chaque page, pour ne pas perturber les layouts déjà
// en place (en particulier la page quiz, déjà serrée verticalement) et
// rester identique sur les 3 pages sans dupliquer de mise en page.
//
// Le blocage entre comptes (volet social) est filtré côté serveur (RLS sur
// multiplayer_chat_messages) : un message d'un compte bloqué n'arrive tout
// simplement jamais ici, ni au chargement ni en direct — rien à filtrer
// côté client.
//
// La modération (muter/expulser) est réservée à l'hôte et se fait via les
// fonctions SECURITY DEFINER dédiées (mêmes garde-fous que le reste du
// multijoueur : jamais de policy UPDATE ouverte sur multiplayer_players).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '../lib/supabase'
import { subscribeChatRealtime } from '../lib/multiplayer'
import Avatar from './Avatar'
import RoleBadge from './RoleBadge'

type ChatPlayer = {
  id: string
  user_id: string
  pseudo: string
  is_guest: boolean
  avatar_url: string | null
  status: 'actif' | 'abandonne'
  muted?: boolean
  role?: string | null
  is_premium?: boolean | null
}

type ChatMessage = {
  id: string
  player_id: string
  content: string
  created_at: string
}

type ChatPanelProps = {
  gameId: string
  gameStatus: 'attente' | 'en_cours' | 'correction' | 'terminee' | 'annulee'
  myPlayerId: string
  myUserId: string
  isHost: boolean
  players: ChatPlayer[]
}

const CHAT_OPEN_STATUSES = new Set(['attente', 'en_cours', 'correction'])

export default function ChatPanel({ gameId, gameStatus, myPlayerId, myUserId, isHost, players }: ChatPanelProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [unread, setUnread] = useState(0)
  const [modLoadingId, setModLoadingId] = useState<string | null>(null)

  const supabaseRef = useRef(createClient())
  const listRef = useRef<HTMLDivElement>(null)
  const knownIdsRef = useRef<Set<string>>(new Set())

  const playersById = useMemo(() => {
    const map: Record<string, ChatPlayer> = {}
    players.forEach(p => { map[p.id] = p })
    return map
  }, [players])

  const iAmMuted = !!playersById[myPlayerId]?.muted
  const canWrite = CHAT_OPEN_STATUSES.has(gameStatus) && !iAmMuted

  const appendMessage = useCallback((msg: ChatMessage) => {
    if (knownIdsRef.current.has(msg.id)) return
    knownIdsRef.current.add(msg.id)
    setMessages(prev => [...prev, msg])
  }, [])

  // Historique chargé une fois au montage (RLS filtre déjà les messages des
  // comptes bloqués et restreint aux membres de la salle).
  useEffect(() => {
    let cancelled = false
    const supabase = supabaseRef.current
    supabase
      .from('multiplayer_chat_messages')
      .select('id, player_id, content, created_at')
      .eq('game_id', gameId)
      .order('created_at', { ascending: true })
      .limit(300)
      .then(({ data }) => {
        if (cancelled || !data) return
        data.forEach((m: ChatMessage) => knownIdsRef.current.add(m.id))
        setMessages(data as ChatMessage[])
      })
    return () => { cancelled = true }
  }, [gameId])

  useEffect(() => {
    const supabase = supabaseRef.current
    const cleanup = subscribeChatRealtime(supabase, {
      gameId,
      onMessage: (row: ChatMessage) => {
        appendMessage(row)
        if (row.player_id !== myPlayerId) {
          setUnread(u => (open ? 0 : u + 1))
        }
      },
    })
    return cleanup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, appendMessage])

  useEffect(() => {
    if (open) {
      setUnread(0)
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [open, messages])

  const handleSend = async () => {
    const content = text.trim().slice(0, 500)
    if (!content || sending || !canWrite) return
    setSending(true)
    setError('')
    const supabase = supabaseRef.current
    const { data, error: insertError } = await supabase
      .from('multiplayer_chat_messages')
      .insert({ game_id: gameId, player_id: myPlayerId, content })
      .select('id, player_id, content, created_at')
      .single()
    setSending(false)
    if (insertError) {
      setError("Message non envoyé — tu as peut-être été muté, ou la partie a changé de phase.")
      return
    }
    if (data) {
      appendMessage(data as ChatMessage)
      setText('')
    }
  }

  const handleToggleMute = async (player: ChatPlayer) => {
    setModLoadingId(player.id)
    await supabaseRef.current.rpc('set_multiplayer_player_muted', {
      p_game_id: gameId,
      p_player_id: player.id,
      p_muted: !player.muted,
    })
    setModLoadingId(null)
  }

  const handleKick = async (player: ChatPlayer) => {
    if (typeof window !== 'undefined' && !window.confirm(`Expulser ${player.pseudo} de la salle ?`)) return
    setModLoadingId(player.id)
    await supabaseRef.current.rpc('kick_multiplayer_player', {
      p_game_id: gameId,
      p_player_id: player.id,
    })
    setModLoadingId(null)
  }

  return (
    <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 40, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px' }}>
      {open && (
        <div
          className="bg-[#1a1828] border border-[#2a2830] rounded-2xl flex flex-col overflow-hidden"
          style={{ width: '320px', maxWidth: 'calc(100vw - 40px)', maxHeight: '440px' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2830]">
            <span className="font-fredoka text-[#eeeaf8] text-base">Chat de la salle</span>
            <button onClick={() => setOpen(false)} className="text-[#6b6880] hover:text-[#eeeaf8] transition" aria-label="Fermer le chat">✕</button>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3" style={{ minHeight: '160px' }}>
            {messages.length === 0 && (
              <p className="text-[#6b6880] text-sm text-center mt-6">Aucun message pour l&apos;instant.</p>
            )}
            {messages.map(m => {
              const sender = playersById[m.player_id]
              const isMe = m.player_id === myPlayerId
              const canModerate = isHost && !!sender && sender.user_id !== myUserId && sender.status === 'actif'
              return (
                <div key={m.id} className="flex flex-col gap-1" style={{ alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    {!isMe && <Avatar url={sender?.avatar_url ?? null} size={20} border="subtle" />}
                    <span className="text-[#9b96b8] text-xs font-fredoka">{isMe ? 'Toi' : (sender?.pseudo || 'Joueur')}</span>
                    {sender?.is_guest && <span className="text-[#6b6880] text-[10px]">(invité)</span>}
                    <RoleBadge role={sender?.role} isPremium={sender?.is_premium} />
                    {canModerate && (
                      <span className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleMute(sender!)}
                          disabled={modLoadingId === sender!.id}
                          className="text-[10px] rounded-full px-2 py-0.5 border border-[#3a3650] text-[#9b96b8] hover:text-[#ffd93d] hover:border-[#ffd93d] transition disabled:opacity-50"
                        >
                          {sender?.muted ? 'Démuter' : 'Muter'}
                        </button>
                        <button
                          onClick={() => handleKick(sender!)}
                          disabled={modLoadingId === sender!.id}
                          className="text-[10px] rounded-full px-2 py-0.5 border border-[#3a3650] text-[#9b96b8] hover:text-[#ff6b6b] hover:border-[#ff6b6b] transition disabled:opacity-50"
                        >
                          Expulser
                        </button>
                      </span>
                    )}
                  </div>
                  <div
                    className="rounded-2xl px-3 py-2 text-sm break-words"
                    style={{
                      background: isMe ? '#a78bfa' : '#2a2830',
                      color: isMe ? '#0f0e17' : '#eeeaf8',
                      maxWidth: '240px',
                    }}
                  >
                    {m.content}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="border-t border-[#2a2830] p-3 flex flex-col gap-2">
            {!canWrite && (
              <p className="text-[#ff6b6b] text-xs">
                {iAmMuted ? "Tu as été muté par l'hôte pour cette partie." : 'Le chat est fermé.'}
              </p>
            )}
            {error && <p className="text-[#ff6b6b] text-xs">{error}</p>}
            <div className="flex items-center gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
                disabled={!canWrite || sending}
                maxLength={500}
                placeholder={canWrite ? 'Écris un message...' : ''}
                className="flex-1 bg-[#0f0e17] border border-[#3a3650] rounded-full px-4 py-2 text-[#eeeaf8] text-sm outline-none disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!canWrite || sending || !text.trim()}
                className="bg-[#ffd93d] text-[#0f0e17] rounded-full w-9 h-9 flex items-center justify-center font-fredoka disabled:opacity-40 flex-shrink-0"
                aria-label="Envoyer"
              >
                →
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        className="bg-[#1a1828] border border-[#2a2830] rounded-full w-14 h-14 flex items-center justify-center shadow-lg relative hover:border-[#a78bfa] transition"
        aria-label={open ? 'Fermer le chat' : 'Ouvrir le chat'}
      >
        <span style={{ fontSize: '22px' }}>💬</span>
        {!open && unread > 0 && (
          <span
            className="absolute rounded-full bg-[#ff6b6b] text-white flex items-center justify-center font-fredoka"
            style={{ top: '-4px', right: '-4px', minWidth: '20px', height: '20px', fontSize: '11px', padding: '0 4px' }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </div>
  )
}

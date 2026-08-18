'use client'

import { useRouter } from 'next/navigation'

// Bouton de retour générique (haut-gauche des pages) — utilise l'historique
// du navigateur plutôt qu'un lien fixe, pour revenir là où l'utilisateur
// était vraiment avant, quelle que soit la page. Volontairement absent des
// phases de réponse aux questions et des pages de résultats (solo +
// multijoueur) : on ne veut pas qu'on puisse "sortir" en plein milieu d'une
// partie en cours ou perdre de vue un résultat par un clic accidentel.
export default function BackButton({ className = '' }: { className?: string }) {
  const router = useRouter()
  return (
    <button
      onClick={() => router.back()}
      aria-label="Retour"
      className={`w-9 h-9 rounded-full bg-[#1a1828] border border-[#2a2830] text-[#c9c4e0] flex items-center justify-center hover:bg-[#1e1c2e] hover:text-[#eeeaf8] hover:border-[#3a3650] transition flex-shrink-0 ${className}`}
    >
      <span aria-hidden="true" style={{ fontSize: '18px', lineHeight: 1 }}>←</span>
    </button>
  )
}

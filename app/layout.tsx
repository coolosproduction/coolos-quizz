import type { Metadata } from 'next'
import { Nunito } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import Script from 'next/script'
import SitePresence from '@/components/SitePresence'
import './globals.css'

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-nunito',
})

export const metadata: Metadata = {
  title: 'Coolos Quiz',
  description: 'Le quiz de culture générale fun et coloré !',
  other: {
    // Balise de vérification de propriété du site pour Google AdSense (méthode
    // alternative au script complet — plus fiable pour la validation initiale).
    'google-adsense-account': 'ca-pub-8305981695601473',
  },
}

// Scripts Google AdSense — chargés sur TOUTES les pages (même celles qui n'affichent
// jamais de pub), pour deux raisons : 1) Google vérifie la présence du script sur le
// site lors du rattachement du compte, pas seulement sur une page isolée ; 2) le bandeau
// de consentement (Privacy & messaging / Funding Choices) doit être actif avant toute
// requête de pub, où qu'elle ait lieu. Charger ces scripts ne sert AUCUNE pub à lui seul
// (il faut un bloc <ins class="adsbygoogle"> explicite pour ça, présent uniquement sur
// l'écran interstitiel /pub, jamais rendu pour les comptes premium/admin). Vide et sans
// effet tant que le compte AdSense n'existe pas — voir .env.local.
const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Fredoka+One&display=swap"
          rel="stylesheet"
        />
        {ADSENSE_CLIENT_ID && (
          <>
            <Script
              async
              src={`https://fundingchoicesmessages.google.com/i/${ADSENSE_CLIENT_ID}?ers=1`}
              strategy="beforeInteractive"
            />
            <Script
              async
              src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
              crossOrigin="anonymous"
              strategy="beforeInteractive"
            />
          </>
        )}
      </head>
      <body className={`${nunito.variable} font-sans`}>
        <SitePresence />
        {children}
        <Analytics />
      </body>
    </html>
  )
}

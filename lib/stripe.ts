import Stripe from 'stripe'

// SDK Stripe côté serveur uniquement — ne jamais importer ce fichier depuis
// un composant client ('use client'), la clé secrète ne doit jamais atteindre
// le navigateur.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)

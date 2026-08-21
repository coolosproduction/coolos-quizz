import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

// Point d'entrée appelé directement par Stripe (jamais par le navigateur).
// La signature est vérifiée avec STRIPE_WEBHOOK_SECRET avant de faire
// confiance au contenu — sans ça n'importe qui pourrait POST ici et se
// déclarer premium. Utilise le client "service role" (contourne RLS) car
// il n'y a pas de session utilisateur ici, seulement un appel serveur-à-serveur.
export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature')
  const rawBody = await request.text()

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Configuration webhook manquante.' }, { status: 500 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Signature webhook Stripe invalide:', err)
    return NextResponse.json({ error: 'Signature invalide.' }, { status: 400 })
  }

  const supabaseAdmin = createAdminSupabaseClient()

  // Depuis la v22 du SDK, `current_period_end` n'existe plus directement sur
  // l'abonnement (une souscription peut avoir plusieurs lignes de prix, chacune
  // avec sa propre période) — on va le chercher sur la première ligne, on n'en
  // a qu'une seule ici (un abonnement = une formule mensuelle ou annuelle).
  const getPeriodEnd = (subscription: Stripe.Subscription): string | null => {
    const item = subscription.items.data[0]
    return item ? new Date(item.current_period_end * 1000).toISOString() : null
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.client_reference_id || session.metadata?.supabase_user_id

        if (userId && session.customer && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string)

          await supabaseAdmin
            .from('users')
            .update({
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: subscription.id,
              premium_plan: session.metadata?.plan || null,
              premium_current_period_end: getPeriodEnd(subscription),
              is_premium: subscription.status === 'active' || subscription.status === 'trialing',
            })
            .eq('id', userId)
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata?.supabase_user_id

        if (userId) {
          await supabaseAdmin
            .from('users')
            .update({
              stripe_subscription_id: subscription.id,
              premium_plan: subscription.metadata?.plan || null,
              premium_current_period_end: getPeriodEnd(subscription),
              is_premium: subscription.status === 'active' || subscription.status === 'trialing',
            })
            .eq('id', userId)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata?.supabase_user_id

        if (userId) {
          // On garde stripe_customer_id/stripe_subscription_id pour l'historique
          // (support client) — seul is_premium change, ce qui coupe l'accès.
          await supabaseAdmin
            .from('users')
            .update({ is_premium: false })
            .eq('id', userId)
        }
        break
      }

      default:
        // Événement non géré, rien à faire.
        break
    }
  } catch (err) {
    console.error('Erreur traitement webhook Stripe:', err)
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

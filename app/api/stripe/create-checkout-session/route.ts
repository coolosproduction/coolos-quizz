import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// IDs de tarifs Stripe (mode Test pour l'instant — à remplacer par les IDs
// du mode Live juste avant le lancement, voir claude/etat-global-resume.md).
const PRICE_IDS: Record<string, string> = {
  mensuel: 'price_1U6qV8Ahkwf2LHkBwP9UXJQ8',
  annuel: 'price_1U6qXHAhkwf2LHkB46tqE5ew',
}

export async function POST(request: Request) {
  let plan: string | undefined
  try {
    const body = await request.json()
    plan = body?.plan
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
  }

  if (!plan || !PRICE_IDS[plan]) {
    return NextResponse.json({ error: 'Formule invalide.' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Vous devez être connecté.' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('stripe_customer_id, is_premium')
    .eq('id', user.id)
    .single()

  if (profile?.is_premium) {
    return NextResponse.json({ error: 'Ce compte est déjà premium.' }, { status: 400 })
  }

  const origin = request.headers.get('origin') || 'https://www.coolosquiz.com'

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
      customer: profile?.stripe_customer_id || undefined,
      customer_email: profile?.stripe_customer_id ? undefined : (user.email as string),
      client_reference_id: user.id,
      subscription_data: {
        trial_period_days: 30,
        metadata: { supabase_user_id: user.id, plan },
      },
      metadata: { supabase_user_id: user.id, plan },
      allow_promotion_codes: true,
      success_url: `${origin}/premium/succes?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/premium`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Erreur création session Stripe Checkout:', err)
    return NextResponse.json({ error: 'Impossible de démarrer le paiement.' }, { status: 500 })
  }
}

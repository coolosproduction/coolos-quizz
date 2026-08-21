import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Vous devez être connecté.' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: "Aucun abonnement Stripe associé à ce compte." }, { status: 400 })
  }

  const origin = request.headers.get('origin') || 'https://www.coolosquiz.com'

  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${origin}/profil`,
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (err) {
    console.error('Erreur création session Stripe Billing Portal:', err)
    return NextResponse.json({ error: "Impossible d'ouvrir la gestion de l'abonnement." }, { status: 500 })
  }
}

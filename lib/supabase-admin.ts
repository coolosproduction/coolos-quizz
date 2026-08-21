import { createClient } from '@supabase/supabase-js'

// Client "service role" — contourne complètement RLS. À N'UTILISER QUE
// côté serveur, jamais importé depuis un composant client ni exposé au
// navigateur. Utilisé uniquement par le webhook Stripe (app/api/stripe/webhook),
// qui n'a pas de session utilisateur authentifiée à faire valider par RLS :
// Stripe appelle notre serveur directement, il n'y a pas de cookie de session.
export function createAdminSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SECRET_KEY as string,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Client Supabase côté serveur, utilisé dans les Route Handlers (app/api/...)
// pour lire la session de l'utilisateur connecté à partir des cookies posés
// par le client navigateur (lib/supabase.js utilise déjà @supabase/ssr, qui
// stocke la session en cookies précisément pour permettre ce partage).
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Appelé depuis un contexte où les cookies ne peuvent pas être
            // réécrits directement — sans conséquence ici, ces routes ne font
            // que LIRE la session, jamais la rafraîchir elles-mêmes.
          }
        },
      },
    }
  )
}

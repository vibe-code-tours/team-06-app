import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client using the service-role key.
 * This client bypasses RLS and should ONLY be used in server-side
 * Route Handlers for admin operations (e.g. staff invite via Auth Admin API).
 *
 * Never import this file into client components.
 */
export function createAdminClient(): SupabaseClient {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    )
}

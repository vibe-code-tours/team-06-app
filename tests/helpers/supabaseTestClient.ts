import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function requireEnv(name: string): string {
    const value = process.env[name]
    if (!value) {
        throw new Error(
            `Missing required env var ${name} — copy supabase/.env.test.example to supabase/.env.test`
        )
    }
    return value
}

export function createServiceClient(): SupabaseClient {
    return createClient(
        requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
        requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
        { auth: { autoRefreshToken: false, persistSession: false } }
    )
}

export function createAnonClient(): SupabaseClient {
    return createClient(
        requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
        requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
        { auth: { autoRefreshToken: false, persistSession: false } }
    )
}

export async function createRoleClient(
    email: string,
    password: string
): Promise<SupabaseClient> {
    const client = createAnonClient()
    const { error } = await client.auth.signInWithPassword({ email, password })
    if (error) {
        throw new Error(`Failed to sign in as ${email}: ${error.message}`)
    }
    return client
}

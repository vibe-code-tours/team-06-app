import type { SupabaseClient } from '@supabase/supabase-js'

// Order matters: children before parents, to satisfy FK constraints.
const TABLES_IN_DELETE_ORDER = [
    'payments',
    'order_items',
    'orders',
    'order_sessions',
    'tables',
    'menu_items',
    'categories',
    'restaurants',
    'profiles',
] as const

export async function resetDatabase(client: SupabaseClient): Promise<void> {
    // Hard guard: this function deletes every auth user and truncates every
    // table. Refuse to run against anything but a local Supabase instance,
    // even if supabase/.env.test is ever accidentally pointed at cloud.
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(url)
    if (!isLocal) {
        throw new Error(
            `resetDatabase() refused to run against non-local Supabase URL: "${url}". ` +
                'Check supabase/.env.test — it must point at 127.0.0.1, not a cloud project.'
        )
    }

    // Delete auth users first — profiles FK references auth.users(id).
    // Delete tables in reverse FK order so child rows are removed before parents.
    let page = 1
    const perPage = 100
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const { data: { users }, error: listError } = await client.auth.admin.listUsers({
            page,
            perPage,
        })
        if (listError) break
        if (!users || users.length === 0) break

        for (const user of users) {
            // Delete user — cascade will remove the profile row
            await client.auth.admin.deleteUser(user.id)
        }
        if (users.length < perPage) break
        page++
    }

    // Now delete all rows from each table (service-role bypasses RLS)
    // This catches any orphaned rows that didn't cascade
    for (const table of TABLES_IN_DELETE_ORDER) {
        const { error } = await client.from(table).delete().not('id', 'is', null)

        if (error) {
            throw new Error(`Failed to clear table ${table}: ${error.message}`)
        }
    }
}

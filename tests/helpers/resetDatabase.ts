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
    // Delete auth users first (they reference profiles via FK)
    const { data: { users } } = await client.auth.admin.listUsers()
    for (const user of users ?? []) {
        await client.auth.admin.deleteUser(user.id)
    }

    // Delete all rows from each table (service-role bypasses RLS)
    for (const table of TABLES_IN_DELETE_ORDER) {
        const { error } = await client.from(table).delete().not('id', 'is', null)

        if (error) {
            throw new Error(`Failed to clear table ${table}: ${error.message}`)
        }
    }
}

import type { SupabaseClient } from '@supabase/supabase-js'

export interface SeedProfile {
    userId: string
    email: string
    password: string
}

export interface SeedFixture {
    restaurantId: string
    tableId: string
    categoryId: string
    menuItemId: string
    profiles: Record<
        | 'super_admin'
        | 'restaurant_owner'
        | 'manager'
        | 'kitchen_staff'
        | 'waiter'
        | 'cashier',
        SeedProfile
    >
}

const ROLES = [
    'super_admin',
    'restaurant_owner',
    'manager',
    'kitchen_staff',
    'waiter',
    'cashier',
] as const

// Monotonically increasing counter to generate unique emails per seedTestData call.
// This ensures that when a test calls seedTestData() twice (for cross-restaurant
// isolation), each call gets distinct auth users with distinct profiles.
let seedCounter = 0

async function ensureUser(
    serviceClient: SupabaseClient,
    email: string,
    password: string,
    metadata: Record<string, unknown>,
    retries = 3
): Promise<string> {
    for (let attempt = 0; attempt < retries; attempt++) {
        // Try to create the user
        const { data, error } = await serviceClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: metadata,
        })

        if (data?.user) {
            return data.user.id
        }

        // If user already exists, look it up and return its id
        if (error) {
            const { data: listData } = await serviceClient.auth.admin.listUsers()
            const existing = listData?.users?.find(
                (u: { id: string; email?: string }) => u.email === email
            )
            if (existing) return existing.id
        }

        // Transient auth API error — retry after a brief pause
        if (attempt < retries - 1) {
            await new Promise((r) => setTimeout(r, 500))
        }
    }

    throw new Error(`Failed to create user ${email} after ${retries} attempts`)
}

// serviceClient must be created with the service_role key — this bypasses RLS
// to create fixtures, and uses admin.createUser to seed auth.users directly.
export async function seedTestData(
    serviceClient: SupabaseClient
): Promise<SeedFixture> {
    const { data: restaurant, error: restaurantError } = await serviceClient
        .from('restaurants')
        .insert({ name: 'Test Restaurant', tax_rate: 0.1 })
        .select()
        .single()
    if (restaurantError) throw new Error(restaurantError.message)

    const { data: category, error: categoryError } = await serviceClient
        .from('categories')
        .insert({ restaurant_id: restaurant.id, name: 'Mains', sort_order: 0 })
        .select()
        .single()
    if (categoryError) throw new Error(categoryError.message)

    const { data: menuItem, error: menuItemError } = await serviceClient
        .from('menu_items')
        .insert({
            restaurant_id: restaurant.id,
            category_id: category.id,
            name: 'Test Burger',
            price: 12.5,
        })
        .select()
        .single()
    if (menuItemError) throw new Error(menuItemError.message)

    const { data: table, error: tableError } = await serviceClient
        .from('tables')
        .insert({ restaurant_id: restaurant.id, table_number: 1 })
        .select()
        .single()
    if (tableError) throw new Error(tableError.message)

    const callId = ++seedCounter
    const profiles = {} as SeedFixture['profiles']

    for (const role of ROLES) {
        const email = `${role}${callId}@test.local`
        const password = 'test-password-123'

        const userId = await ensureUser(serviceClient, email, password, {
            role,
            restaurant_id: role === 'super_admin' ? null : restaurant.id,
        })

        profiles[role] = { userId, email, password }
    }

    return {
        restaurantId: restaurant.id,
        tableId: table.id,
        categoryId: category.id,
        menuItemId: menuItem.id,
        profiles,
    }
}

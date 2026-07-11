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

    const profiles = {} as SeedFixture['profiles']

    for (const role of ROLES) {
        const email = `${role}@test.local`
        const password = 'test-password-123'

        const { data: authUser, error: authError } =
            await serviceClient.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: {
                    role,
                    restaurant_id: role === 'super_admin' ? null : restaurant.id,
                },
            })
        if (authError || !authUser.user) {
            throw new Error(authError?.message ?? 'Failed to create auth user')
        }

        profiles[role] = { userId: authUser.user.id, email, password }
    }

    return {
        restaurantId: restaurant.id,
        tableId: table.id,
        categoryId: category.id,
        menuItemId: menuItem.id,
        profiles,
    }
}

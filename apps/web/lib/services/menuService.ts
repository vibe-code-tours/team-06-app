import type { SupabaseClient } from '@supabase/supabase-js'
import type { CategoryInput, MenuItemInput } from '@restaurant-qr/shared'

// ============================================================================
// CATEGORY FUNCTIONS
// ============================================================================

export type CategoryResult = { id: string } | { error: string }
export type UpdateResult = { success: true } | { error: string }

export async function createCategory(
    client: SupabaseClient,
    restaurantId: string,
    input: CategoryInput
): Promise<CategoryResult> {
    const { data, error } = await client
        .from('categories')
        .insert({
            restaurant_id: restaurantId,
            name: input.name,
            sort_order: input.sort_order ?? 0,
            is_active: input.is_active ?? true,
        })
        .select('id')
        .single()

    if (error) {
        return { error: error.message }
    }

    return { id: data.id }
}

export async function updateCategory(
    client: SupabaseClient,
    categoryId: string,
    input: Partial<CategoryInput>
): Promise<UpdateResult> {
    const { error } = await client
        .from('categories')
        .update(input)
        .eq('id', categoryId)

    if (error) {
        return { error: error.message }
    }

    return { success: true }
}

export async function deleteCategory(
    client: SupabaseClient,
    categoryId: string
): Promise<UpdateResult> {
    const { error } = await client
        .from('categories')
        .delete()
        .eq('id', categoryId)

    if (error) {
        return { error: error.message }
    }

    return { success: true }
}

// ============================================================================
// MENU ITEM FUNCTIONS
// ============================================================================

export async function createMenuItem(
    client: SupabaseClient,
    restaurantId: string,
    input: MenuItemInput
): Promise<{ id: string } | { error: string }> {
    // Cross-tenant check: verify category belongs to this restaurant
    const { data: category, error: catError } = await client
        .from('categories')
        .select('id')
        .eq('id', input.category_id)
        .eq('restaurant_id', restaurantId)
        .single()

    if (catError || !category) {
        return { error: 'Category does not belong to this restaurant' }
    }

    const { data, error } = await client
        .from('menu_items')
        .insert({
            restaurant_id: restaurantId,
            category_id: input.category_id,
            name: input.name,
            description: input.description ?? '',
            price: input.price,
            image_url: input.image_url ?? null,
            is_available: input.is_available ?? true,
            sort_order: input.sort_order ?? 0,
        })
        .select('id')
        .single()

    if (error) {
        return { error: error.message }
    }

    return { id: data.id }
}

export async function deleteMenuItem(
    client: SupabaseClient,
    menuItemId: string
): Promise<UpdateResult> {
    const { error } = await client
        .from('menu_items')
        .delete()
        .eq('id', menuItemId)

    if (error) {
        // FK RESTRICT will fail if item has been ordered
        return { error: error.message }
    }

    return { success: true }
}

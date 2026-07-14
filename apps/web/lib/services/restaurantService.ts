import type { SupabaseClient } from '@supabase/supabase-js'
import type { RestaurantInput } from '@restaurant-qr/shared'

export type ServiceResult<T> = T | { error: string }

export async function createRestaurant(
    client: SupabaseClient,
    input: RestaurantInput
): Promise<ServiceResult<{ id: string }>> {
    const { data, error } = await client.from('restaurants').insert(input).select('id').single()
    if (error) return { error: error.message }
    return { id: data.id }
}

export async function updateRestaurant(
    client: SupabaseClient,
    restaurantId: string,
    input: Partial<RestaurantInput> & { is_active?: boolean; logo_url?: string }
): Promise<ServiceResult<{ success: true }>> {
    const { error } = await client.from('restaurants').update(input).eq('id', restaurantId)
    if (error) return { error: error.message }
    return { success: true }
}

export async function deleteRestaurant(
    client: SupabaseClient,
    restaurantId: string
): Promise<ServiceResult<{ success: true }>> {
    const { error } = await client.from('restaurants').delete().eq('id', restaurantId)
    if (error) return { error: error.message }
    return { success: true }
}

export async function toggleRestaurantActive(
    client: SupabaseClient,
    restaurantId: string
): Promise<ServiceResult<{ is_active: boolean }>> {
    // Get current status
    const { data: restaurant, error: fetchError } = await client
        .from('restaurants')
        .select('is_active')
        .eq('id', restaurantId)
        .single()

    if (fetchError) return { error: fetchError.message }

    const newIsActive = !restaurant.is_active

    // Update restaurant
    const { error: updateError } = await client
        .from('restaurants')
        .update({ is_active: newIsActive })
        .eq('id', restaurantId)

    if (updateError) return { error: updateError.message }

    // Cascade: update all profiles for this restaurant
    const { error: profilesError } = await client
        .from('profiles')
        .update({ is_active: newIsActive })
        .eq('restaurant_id', restaurantId)

    if (profilesError) return { error: profilesError.message }

    return { is_active: newIsActive }
}

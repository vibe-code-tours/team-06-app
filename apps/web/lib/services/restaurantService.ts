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

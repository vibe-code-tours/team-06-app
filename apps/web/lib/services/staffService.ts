import type { SupabaseClient } from '@supabase/supabase-js'
import type { InviteStaffInput } from '@restaurant-qr/shared'

export type InviteStaffResult = { userId: string } | { error: string }

export async function inviteStaff(
    adminClient: SupabaseClient,
    restaurantId: string,
    input: InviteStaffInput
): Promise<InviteStaffResult> {
    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(
        input.email,
        {
            data: {
                role: input.role,
                restaurant_id: restaurantId,
            },
        }
    )

    if (error) {
        return { error: error.message }
    }

    return { userId: data.user.id }
}

import type { SupabaseClient } from '@supabase/supabase-js'
import type { InviteStaffInput } from '@restaurant-qr/shared'

export type InviteStaffResult = { userId: string } | { error: string }

export async function inviteStaff(
    adminClient: SupabaseClient,
    restaurantId: string,
    input: InviteStaffInput
): Promise<InviteStaffResult> {
    // Check 1: Does email already exist in profiles table (already registered)?
    const { data: existingProfile } = await adminClient
        .from('profiles')
        .select('id')
        .eq('email', input.email)
        .single()

    if (existingProfile) {
        return { error: 'This email is already registered' }
    }

    // Check 2: Does email have a pending invite in invites table?
    const { data: existingInvite } = await adminClient
        .from('invites')
        .select('id')
        .eq('email', input.email)
        .eq('restaurant_id', restaurantId)
        .eq('status', 'pending')
        .single()

    if (existingInvite) {
        return { error: 'This email has already been invited' }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(
        input.email,
        {
            redirectTo: `${appUrl}/auth/callback`,
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

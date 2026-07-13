import { ok, err } from '@restaurant-qr/shared/http/apiResponse'
import { createClient } from '@/lib/supabase/server'
import { deleteMenuItem } from '@/lib/services/menuService'

const ALLOWED_ROLES = ['restaurant_owner', 'manager', 'super_admin']

export async function PUT(
    request: Request,
    { params }: { params: { menuItemId: string } }
) {
    const supabase = createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) return err('UNAUTHORIZED', 'Unauthorized', 401)

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
        return err('FORBIDDEN', 'Forbidden', 403)
    }

    const body = await request.json().catch(() => null)

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return err('VALIDATION_ERROR', 'Invalid request body', 400)
    }

    // Only allow is_available and image_url updates
    const allowedFields = ['is_available', 'image_url'] as const
    const filtered: Record<string, unknown> = {}
    for (const key of allowedFields) {
        if (key in body) {
            filtered[key] = body[key]
        }
    }

    if (Object.keys(filtered).length === 0) {
        return err('VALIDATION_ERROR', 'No valid fields to update (allowed: is_available, image_url)', 400)
    }

    const { error } = await supabase
        .from('menu_items')
        .update(filtered)
        .eq('id', params.menuItemId)

    if (error) {
        return err('INTERNAL_ERROR', error.message, 500)
    }

    return ok({ success: true }, 200)
}

export async function DELETE(
    _request: Request,
    { params }: { params: { menuItemId: string } }
) {
    const supabase = createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) return err('UNAUTHORIZED', 'Unauthorized', 401)

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
        return err('FORBIDDEN', 'Forbidden', 403)
    }

    const result = await deleteMenuItem(supabase, params.menuItemId)

    if ('error' in result) {
        return err('CONFLICT', result.error, 422)
    }

    return ok(result, 200)
}

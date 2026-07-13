import { ok, err } from '@restaurant-qr/shared/http/apiResponse'
import { createClient } from '@/lib/supabase/server'
import { categorySchema } from '@restaurant-qr/shared'
import { updateCategory, deleteCategory } from '@/lib/services/menuService'

const ALLOWED_ROLES_UPDATE = ['restaurant_owner', 'manager', 'super_admin']
const ALLOWED_ROLES_DELETE = ['restaurant_owner', 'super_admin']

export async function PUT(
    request: Request,
    { params }: { params: { categoryId: string } }
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

    if (!profile || !ALLOWED_ROLES_UPDATE.includes(profile.role)) {
        return err('FORBIDDEN', 'Forbidden', 403)
    }

    const body = await request.json().catch(() => null)
    const parsed = categorySchema.partial().safeParse(body)

    if (!parsed.success) {
        return err('VALIDATION_ERROR', 'Invalid input', 400, parsed.error.flatten())
    }

    if (Object.keys(parsed.data).length === 0) {
        return err('VALIDATION_ERROR', 'No valid fields to update', 400)
    }

    const result = await updateCategory(supabase, params.categoryId, parsed.data)

    if ('error' in result) {
        return err('INTERNAL_ERROR', result.error, 500)
    }

    return ok(result, 200)
}

export async function DELETE(
    _request: Request,
    { params }: { params: { categoryId: string } }
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

    if (!profile || !ALLOWED_ROLES_DELETE.includes(profile.role)) {
        return err('FORBIDDEN', 'Forbidden', 403)
    }

    const result = await deleteCategory(supabase, params.categoryId)

    if ('error' in result) {
        return err('INTERNAL_ERROR', result.error, 500)
    }

    return ok(result, 200)
}

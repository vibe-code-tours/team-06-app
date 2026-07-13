import { ok, err } from '@restaurant-qr/shared/http/apiResponse'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_BUCKETS = ['restaurant-logos', 'menu-images'] as const
const ALLOWED_ROLES = ['restaurant_owner', 'manager', 'super_admin']

export async function POST(request: Request) {
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

    const formData = await request.formData().catch(() => null)
    const file = formData?.get('file')
    const bucket = formData?.get('bucket')
    const restaurantId = formData?.get('restaurantId')

    if (
        !(file instanceof Blob) ||
        typeof bucket !== 'string' ||
        !ALLOWED_BUCKETS.includes(bucket as (typeof ALLOWED_BUCKETS)[number]) ||
        typeof restaurantId !== 'string'
    ) {
        return err('VALIDATION_ERROR', 'file, a valid bucket, and restaurantId are required', 400)
    }

    const filename = file instanceof File ? file.name : 'upload'
    const path = `${restaurantId}/${Date.now()}-${filename}`

    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
        contentType: file.type || 'application/octet-stream',
    })

    if (uploadError) {
        return err('CONFLICT', uploadError.message, 422)
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path)

    return ok({ publicUrl: data.publicUrl }, 200)
}

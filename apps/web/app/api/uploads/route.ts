import { ok, err } from '@restaurant-qr/shared/http/apiResponse'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_ROLES = ['restaurant_owner', 'manager', 'super_admin']
const ALLOWED_BUCKETS = ['restaurant-logos', 'menu-images'] as const

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

    const formData = await request.formData()
    const file = formData.get('file')
    const bucket = formData.get('bucket')
    const restaurantId = formData.get('restaurantId')

    if (!file || !(file instanceof Blob)) {
        return err('VALIDATION_ERROR', 'file is required', 400)
    }

    if (!bucket || typeof bucket !== 'string' || !ALLOWED_BUCKETS.includes(bucket as typeof ALLOWED_BUCKETS[number])) {
        return err('VALIDATION_ERROR', `bucket must be one of: ${ALLOWED_BUCKETS.join(', ')}`, 400)
    }

    if (!restaurantId || typeof restaurantId !== 'string') {
        return err('VALIDATION_ERROR', 'restaurantId is required', 400)
    }

    const filename = (file as File).name || 'upload'
    const path = `${restaurantId}/${Date.now()}-${filename}`
    const contentType = (file as File).type || 'application/octet-stream'

    const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file, { contentType })

    if (uploadError) {
        return err('INTERNAL_ERROR', uploadError.message, 500)
    }

    const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(path)

    return ok({ publicUrl: urlData.publicUrl }, 201)
}

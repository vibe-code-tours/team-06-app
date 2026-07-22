import { resetDatabase } from '../helpers/resetDatabase'
import { seedTestData } from '../helpers/seedTestData'
import {
    createServiceClient,
    createRoleClient,
} from '../helpers/supabaseTestClient'

const BASE_URL = process.env.TEST_APP_URL ?? 'http://localhost:3000'

/**
 * Derive the Supabase auth cookie name from the project URL.
 * Matches the default `storageKey` in @supabase/supabase-js:
 *   sb-<hostname.split(".")[0]>-auth-token
 */
function getSupabaseCookieName(): string {
    const url = new URL(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
    )
    return `sb-${url.hostname.split('.')[0]}-auth-token`
}

/**
 * Build a Cookie header string from an authenticated Supabase client.
 * Extracts the in-memory session and encodes it the same way
 * @supabase/ssr stores it in cookies: base64- prefix + base64url-encoded JSON.
 */
async function buildAuthCookie(
    client: Awaited<ReturnType<typeof createRoleClient>>
): Promise<string> {
    const {
        data: { session },
    } = await client.auth.getSession()
    if (!session) throw new Error('No session after sign-in')

    const value = JSON.stringify(session)
    const base64 = Buffer.from(value).toString('base64url')
    return `${getSupabaseCookieName()}=base64-${base64}`
}

describe('POST /api/orders/[orderId]/status', () => {
    const serviceClient = createServiceClient()

    beforeEach(() => resetDatabase(serviceClient), 60_000)

    it('rejects a body missing status with 400', async () => {
        const fixture = await seedTestData(serviceClient)
        const kitchenClient = await createRoleClient(
            fixture.profiles.kitchen_staff.email,
            fixture.profiles.kitchen_staff.password
        )

        const { data: order } = await serviceClient
            .from('orders')
            .insert({ restaurant_id: fixture.restaurantId, table_id: fixture.tableId, status: 'PENDING' })
            .select()
            .single()

        const cookie = await buildAuthCookie(kitchenClient)

        const response = await fetch(`${BASE_URL}/api/orders/${order!.id}/status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: cookie,
            },
            body: JSON.stringify({}),
            redirect: 'manual',
        })

        expect(response.status).toBe(400)
    })

    it('rejects an invalid transition with 422', async () => {
        const fixture = await seedTestData(serviceClient)
        const kitchenClient = await createRoleClient(
            fixture.profiles.kitchen_staff.email,
            fixture.profiles.kitchen_staff.password
        )

        const { data: order } = await serviceClient
            .from('orders')
            .insert({ restaurant_id: fixture.restaurantId, table_id: fixture.tableId, status: 'PENDING' })
            .select()
            .single()

        const cookie = await buildAuthCookie(kitchenClient)

        const response = await fetch(`${BASE_URL}/api/orders/${order!.id}/status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: cookie,
            },
            body: JSON.stringify({ status: 'READY' }),
            redirect: 'manual',
        })

        expect(response.status).toBe(422)
    })

    it('rejects an unauthenticated request with 401', async () => {
        const fixture = await seedTestData(serviceClient)

        const { data: order } = await serviceClient
            .from('orders')
            .insert({ restaurant_id: fixture.restaurantId, table_id: fixture.tableId, status: 'PENDING' })
            .select()
            .single()

        const response = await fetch(`${BASE_URL}/api/orders/${order!.id}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'ACCEPTED' }),
            redirect: 'manual',
        })

        // API returns 401 directly (middleware allows /api/orders as public route)
        expect(response.status).toBe(401)
    })
})

import { resetDatabase } from '../helpers/resetDatabase'
import { seedTestData } from '../helpers/seedTestData'
import {
    createServiceClient,
    createRoleClient,
} from '../helpers/supabaseTestClient'

const BASE_URL = process.env.TEST_APP_URL ?? 'http://localhost:3000'

function getSupabaseCookieName(): string {
    const url = new URL(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
    )
    return `sb-${url.hostname.split('.')[0]}-auth-token`
}

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

describe('POST /api/restaurants', () => {
    const serviceClient = createServiceClient()

    beforeEach(() => resetDatabase(serviceClient), 60_000)

    it('rejects an unauthenticated request with 307', async () => {
        const response = await fetch(`${BASE_URL}/api/restaurants`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Test Restaurant', description: '', tax_rate: 0 }),
            redirect: 'manual',
        })

        // Middleware redirects to /login (307) for unauthenticated requests
        expect(response.status).toBe(307)
    })

    it('rejects a non-super_admin with 403', async () => {
        const fixture = await seedTestData(serviceClient)
        const managerClient = await createRoleClient(
            fixture.profiles.manager.email,
            fixture.profiles.manager.password
        )

        const cookie = await buildAuthCookie(managerClient)

        const response = await fetch(`${BASE_URL}/api/restaurants`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: cookie,
            },
            body: JSON.stringify({ name: 'Should Fail', description: '', tax_rate: 0 }),
            redirect: 'manual',
        })

        expect(response.status).toBe(403)
    })

    it('rejects an empty name with 400', async () => {
        const fixture = await seedTestData(serviceClient)
        const adminClient = await createRoleClient(
            fixture.profiles.super_admin.email,
            fixture.profiles.super_admin.password
        )

        const cookie = await buildAuthCookie(adminClient)

        const response = await fetch(`${BASE_URL}/api/restaurants`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: cookie,
            },
            body: JSON.stringify({ name: '' }),
            redirect: 'manual',
        })

        expect(response.status).toBe(400)
    })

    it('creates a restaurant as super_admin with 201', async () => {
        const fixture = await seedTestData(serviceClient)
        const adminClient = await createRoleClient(
            fixture.profiles.super_admin.email,
            fixture.profiles.super_admin.password
        )

        const cookie = await buildAuthCookie(adminClient)

        const response = await fetch(`${BASE_URL}/api/restaurants`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: cookie,
            },
            body: JSON.stringify({ name: 'New Restaurant', description: '', tax_rate: 0.05 }),
            redirect: 'manual',
        })

        expect(response.status).toBe(201)
        const body = (await response.json()) as { data: { id: string } }
        expect(body.data.id).toBeDefined()
    })
})

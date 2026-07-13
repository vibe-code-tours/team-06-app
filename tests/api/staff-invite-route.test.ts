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

describe('POST /api/staff/invite', () => {
    const serviceClient = createServiceClient()

    beforeEach(() => resetDatabase(serviceClient), 60_000)

    it('rejects unauthenticated request with 307', async () => {
        const response = await fetch(`${BASE_URL}/api/staff/invite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'test@test.local', role: 'waiter' }),
            redirect: 'manual',
        })
        expect(response.status).toBe(307)
    })

    it('allows owner to invite staff', async () => {
        const fixture = await seedTestData(serviceClient)
        const client = await createRoleClient(
            fixture.profiles.restaurant_owner.email,
            fixture.profiles.restaurant_owner.password
        )
        const cookie = await buildAuthCookie(client)

        const response = await fetch(`${BASE_URL}/api/staff/invite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify({ email: 'invited@test.local', role: 'waiter' }),
            redirect: 'manual',
        })
        expect(response.status).toBe(201)
    })

    it('allows super_admin to invite staff', async () => {
        const fixture = await seedTestData(serviceClient)
        const client = await createRoleClient(
            fixture.profiles.super_admin.email,
            fixture.profiles.super_admin.password
        )
        const cookie = await buildAuthCookie(client)

        const response = await fetch(`${BASE_URL}/api/staff/invite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify({ email: 'invited-admin@test.local', role: 'manager' }),
            redirect: 'manual',
        })
        expect(response.status).toBe(201)
    })

    it('rejects manager from inviting staff (owner-only)', async () => {
        const fixture = await seedTestData(serviceClient)
        const client = await createRoleClient(
            fixture.profiles.manager.email,
            fixture.profiles.manager.password
        )
        const cookie = await buildAuthCookie(client)

        const response = await fetch(`${BASE_URL}/api/staff/invite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify({ email: 'should-fail@test.local', role: 'waiter' }),
            redirect: 'manual',
        })
        expect(response.status).toBe(403)
    })

    it('rejects invalid email with 400', async () => {
        const fixture = await seedTestData(serviceClient)
        const client = await createRoleClient(
            fixture.profiles.restaurant_owner.email,
            fixture.profiles.restaurant_owner.password
        )
        const cookie = await buildAuthCookie(client)

        const response = await fetch(`${BASE_URL}/api/staff/invite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify({ email: 'not-an-email', role: 'waiter' }),
            redirect: 'manual',
        })
        expect(response.status).toBe(400)
    })

    it('rejects invalid role with 400', async () => {
        const fixture = await seedTestData(serviceClient)
        const client = await createRoleClient(
            fixture.profiles.restaurant_owner.email,
            fixture.profiles.restaurant_owner.password
        )
        const cookie = await buildAuthCookie(client)

        const response = await fetch(`${BASE_URL}/api/staff/invite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify({ email: 'valid@test.local', role: 'invalid_role' }),
            redirect: 'manual',
        })
        expect(response.status).toBe(400)
    })
})

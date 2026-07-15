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

describe('POST /api/tables', () => {
    const serviceClient = createServiceClient()

    beforeEach(() => resetDatabase(serviceClient), 60_000)

    it('rejects unauthenticated request with 307', async () => {
        const response = await fetch(`${BASE_URL}/api/tables`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ restaurant_id: 'x', table_number: 10 }),
            redirect: 'manual',
        })
        expect(response.status).toBe(307)
    })

    it('allows owner to create a table', async () => {
        const fixture = await seedTestData(serviceClient)
        const client = await createRoleClient(
            fixture.profiles.restaurant_owner.email,
            fixture.profiles.restaurant_owner.password
        )
        const cookie = await buildAuthCookie(client)

        const response = await fetch(`${BASE_URL}/api/tables`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify({
                restaurant_id: fixture.restaurantId,
                table_number: 50,
                capacity: 4,
            }),
            redirect: 'manual',
        })
        expect(response.status).toBe(201)
    })

    it('allows manager to create a table', async () => {
        const fixture = await seedTestData(serviceClient)
        const client = await createRoleClient(
            fixture.profiles.manager.email,
            fixture.profiles.manager.password
        )
        const cookie = await buildAuthCookie(client)

        const response = await fetch(`${BASE_URL}/api/tables`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify({
                restaurant_id: fixture.restaurantId,
                table_number: 51,
            }),
            redirect: 'manual',
        })
        expect(response.status).toBe(201)
    })

    it('rejects waiter with 403', async () => {
        const fixture = await seedTestData(serviceClient)
        const client = await createRoleClient(
            fixture.profiles.waiter.email,
            fixture.profiles.waiter.password
        )
        const cookie = await buildAuthCookie(client)

        const response = await fetch(`${BASE_URL}/api/tables`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify({
                restaurant_id: fixture.restaurantId,
                table_number: 52,
            }),
            redirect: 'manual',
        })
        expect(response.status).toBe(403)
    })
})

describe('DELETE /api/tables/[tableId]', () => {
    const serviceClient = createServiceClient()

    beforeEach(() => resetDatabase(serviceClient), 60_000)

    it('allows owner to delete a table', async () => {
        const fixture = await seedTestData(serviceClient)
        const client = await createRoleClient(
            fixture.profiles.restaurant_owner.email,
            fixture.profiles.restaurant_owner.password
        )
        const cookie = await buildAuthCookie(client)

        const response = await fetch(
            `${BASE_URL}/api/tables/${fixture.tableId}`,
            {
                method: 'DELETE',
                headers: { Cookie: cookie },
                redirect: 'manual',
            }
        )
        expect(response.status).toBe(200)
    })

    it('allows super_admin to delete a table', async () => {
        const fixture = await seedTestData(serviceClient)
        const client = await createRoleClient(
            fixture.profiles.super_admin.email,
            fixture.profiles.super_admin.password
        )
        const cookie = await buildAuthCookie(client)

        const response = await fetch(
            `${BASE_URL}/api/tables/${fixture.tableId}`,
            {
                method: 'DELETE',
                headers: { Cookie: cookie },
                redirect: 'manual',
            }
        )
        expect(response.status).toBe(200)
    })

    it('rejects manager from deleting a table (owner-only)', async () => {
        const fixture = await seedTestData(serviceClient)
        const client = await createRoleClient(
            fixture.profiles.manager.email,
            fixture.profiles.manager.password
        )
        const cookie = await buildAuthCookie(client)

        const response = await fetch(
            `${BASE_URL}/api/tables/${fixture.tableId}`,
            {
                method: 'DELETE',
                headers: { Cookie: cookie },
                redirect: 'manual',
            }
        )
        expect(response.status).toBe(403)
    })

    it('rejects waiter with 403', async () => {
        const fixture = await seedTestData(serviceClient)
        const client = await createRoleClient(
            fixture.profiles.waiter.email,
            fixture.profiles.waiter.password
        )
        const cookie = await buildAuthCookie(client)

        const response = await fetch(
            `${BASE_URL}/api/tables/${fixture.tableId}`,
            {
                method: 'DELETE',
                headers: { Cookie: cookie },
                redirect: 'manual',
            }
        )
        expect(response.status).toBe(403)
    })
})

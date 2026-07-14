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

describe('POST /api/categories', () => {
    const serviceClient = createServiceClient()

    beforeEach(() => resetDatabase(serviceClient), 60_000)

    it('rejects unauthenticated request with 307', async () => {
        const response = await fetch(`${BASE_URL}/api/categories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ restaurant_id: 'x', name: 'Test' }),
            redirect: 'manual',
        })
        expect(response.status).toBe(307)
    })

    it('rejects a customer with 403', async () => {
        const fixture = await seedTestData(serviceClient)
        const client = await createRoleClient(
            fixture.profiles.waiter.email,
            fixture.profiles.waiter.password
        )
        const cookie = await buildAuthCookie(client)

        const response = await fetch(`${BASE_URL}/api/categories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify({
                restaurant_id: fixture.restaurantId,
                name: 'Should Fail',
            }),
            redirect: 'manual',
        })
        expect(response.status).toBe(403)
    })

    it('allows restaurant_owner to create a category', async () => {
        const fixture = await seedTestData(serviceClient)
        const client = await createRoleClient(
            fixture.profiles.restaurant_owner.email,
            fixture.profiles.restaurant_owner.password
        )
        const cookie = await buildAuthCookie(client)

        const response = await fetch(`${BASE_URL}/api/categories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify({
                restaurant_id: fixture.restaurantId,
                name: 'New Category',
                sort_order: 5,
            }),
            redirect: 'manual',
        })
        expect(response.status).toBe(201)
    })

    it('allows manager to create a category', async () => {
        const fixture = await seedTestData(serviceClient)
        const client = await createRoleClient(
            fixture.profiles.manager.email,
            fixture.profiles.manager.password
        )
        const cookie = await buildAuthCookie(client)

        const response = await fetch(`${BASE_URL}/api/categories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify({
                restaurant_id: fixture.restaurantId,
                name: 'Manager Category',
            }),
            redirect: 'manual',
        })
        expect(response.status).toBe(201)
    })

    it('rejects empty name with 400', async () => {
        const fixture = await seedTestData(serviceClient)
        const client = await createRoleClient(
            fixture.profiles.restaurant_owner.email,
            fixture.profiles.restaurant_owner.password
        )
        const cookie = await buildAuthCookie(client)

        const response = await fetch(`${BASE_URL}/api/categories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify({
                restaurant_id: fixture.restaurantId,
                name: '',
            }),
            redirect: 'manual',
        })
        expect(response.status).toBe(400)
    })
})

describe('PUT /api/categories/[categoryId]', () => {
    const serviceClient = createServiceClient()

    beforeEach(() => resetDatabase(serviceClient), 60_000)

    it('allows owner to update a category', async () => {
        const fixture = await seedTestData(serviceClient)
        const client = await createRoleClient(
            fixture.profiles.restaurant_owner.email,
            fixture.profiles.restaurant_owner.password
        )
        const cookie = await buildAuthCookie(client)

        const response = await fetch(
            `${BASE_URL}/api/categories/${fixture.categoryId}`,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Cookie: cookie },
                body: JSON.stringify({ name: 'Updated' }),
                redirect: 'manual',
            }
        )
        expect(response.status).toBe(200)
    })

    it('allows manager to update a category', async () => {
        const fixture = await seedTestData(serviceClient)
        const client = await createRoleClient(
            fixture.profiles.manager.email,
            fixture.profiles.manager.password
        )
        const cookie = await buildAuthCookie(client)

        const response = await fetch(
            `${BASE_URL}/api/categories/${fixture.categoryId}`,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Cookie: cookie },
                body: JSON.stringify({ name: 'Manager Update' }),
                redirect: 'manual',
            }
        )
        expect(response.status).toBe(200)
    })

    it('rejects waiter with 403', async () => {
        const fixture = await seedTestData(serviceClient)
        const client = await createRoleClient(
            fixture.profiles.waiter.email,
            fixture.profiles.waiter.password
        )
        const cookie = await buildAuthCookie(client)

        const response = await fetch(
            `${BASE_URL}/api/categories/${fixture.categoryId}`,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Cookie: cookie },
                body: JSON.stringify({ name: 'Should Fail' }),
                redirect: 'manual',
            }
        )
        expect(response.status).toBe(403)
    })
})

describe('DELETE /api/categories/[categoryId]', () => {
    const serviceClient = createServiceClient()

    beforeEach(() => resetDatabase(serviceClient), 60_000)

    it('allows owner to delete a category', async () => {
        const fixture = await seedTestData(serviceClient)
        const client = await createRoleClient(
            fixture.profiles.restaurant_owner.email,
            fixture.profiles.restaurant_owner.password
        )
        const cookie = await buildAuthCookie(client)

        // Create a separate category to delete
        const { data: newCat } = await serviceClient
            .from('categories')
            .insert({ restaurant_id: fixture.restaurantId, name: 'To Delete', sort_order: 99 })
            .select('id')
            .single()

        const response = await fetch(
            `${BASE_URL}/api/categories/${newCat!.id}`,
            {
                method: 'DELETE',
                headers: { Cookie: cookie },
                redirect: 'manual',
            }
        )
        expect(response.status).toBe(200)
    })

    it('rejects manager from deleting a category (owner-only)', async () => {
        const fixture = await seedTestData(serviceClient)
        const client = await createRoleClient(
            fixture.profiles.manager.email,
            fixture.profiles.manager.password
        )
        const cookie = await buildAuthCookie(client)

        const response = await fetch(
            `${BASE_URL}/api/categories/${fixture.categoryId}`,
            {
                method: 'DELETE',
                headers: { Cookie: cookie },
                redirect: 'manual',
            }
        )
        expect(response.status).toBe(403)
    })

    it('allows super_admin to delete a category', async () => {
        const fixture = await seedTestData(serviceClient)
        const client = await createRoleClient(
            fixture.profiles.super_admin.email,
            fixture.profiles.super_admin.password
        )
        const cookie = await buildAuthCookie(client)

        const response = await fetch(
            `${BASE_URL}/api/categories/${fixture.categoryId}`,
            {
                method: 'DELETE',
                headers: { Cookie: cookie },
                redirect: 'manual',
            }
        )
        expect(response.status).toBe(200)
    })
})

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

describe('POST /api/menu-items', () => {
    const serviceClient = createServiceClient()

    beforeEach(() => resetDatabase(serviceClient), 60_000)

    it('rejects unauthenticated request with 307', async () => {
        const response = await fetch(`${BASE_URL}/api/menu-items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ restaurant_id: 'x', name: 'Test', price: 10, category_id: 'x' }),
            redirect: 'manual',
        })
        expect(response.status).toBe(307)
    })

    it('allows owner to create a menu item', async () => {
        const fixture = await seedTestData(serviceClient)
        const client = await createRoleClient(
            fixture.profiles.restaurant_owner.email,
            fixture.profiles.restaurant_owner.password
        )
        const cookie = await buildAuthCookie(client)

        const response = await fetch(`${BASE_URL}/api/menu-items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify({
                restaurant_id: fixture.restaurantId,
                name: 'New Item',
                price: 9.99,
                category_id: fixture.categoryId,
            }),
            redirect: 'manual',
        })
        expect(response.status).toBe(201)
    })

    it('allows manager to create a menu item', async () => {
        const fixture = await seedTestData(serviceClient)
        const client = await createRoleClient(
            fixture.profiles.manager.email,
            fixture.profiles.manager.password
        )
        const cookie = await buildAuthCookie(client)

        const response = await fetch(`${BASE_URL}/api/menu-items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify({
                restaurant_id: fixture.restaurantId,
                name: 'Manager Item',
                price: 7.5,
                category_id: fixture.categoryId,
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

        const response = await fetch(`${BASE_URL}/api/menu-items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify({
                restaurant_id: fixture.restaurantId,
                name: 'Should Fail',
                price: 10,
                category_id: fixture.categoryId,
            }),
            redirect: 'manual',
        })
        expect(response.status).toBe(403)
    })

    it('rejects missing required fields with 400', async () => {
        const fixture = await seedTestData(serviceClient)
        const client = await createRoleClient(
            fixture.profiles.restaurant_owner.email,
            fixture.profiles.restaurant_owner.password
        )
        const cookie = await buildAuthCookie(client)

        const response = await fetch(`${BASE_URL}/api/menu-items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify({ restaurant_id: fixture.restaurantId }),
            redirect: 'manual',
        })
        expect(response.status).toBe(400)
    })
})

describe('PUT /api/menu-items/[menuItemId]', () => {
    const serviceClient = createServiceClient()

    beforeEach(() => resetDatabase(serviceClient), 60_000)

    it('allows owner to toggle availability', async () => {
        const fixture = await seedTestData(serviceClient)
        const client = await createRoleClient(
            fixture.profiles.restaurant_owner.email,
            fixture.profiles.restaurant_owner.password
        )
        const cookie = await buildAuthCookie(client)

        const response = await fetch(
            `${BASE_URL}/api/menu-items/${fixture.menuItemId}`,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Cookie: cookie },
                body: JSON.stringify({ is_available: false }),
                redirect: 'manual',
            }
        )
        expect(response.status).toBe(200)
    })

    it('allows owner to update image_url', async () => {
        const fixture = await seedTestData(serviceClient)
        const client = await createRoleClient(
            fixture.profiles.restaurant_owner.email,
            fixture.profiles.restaurant_owner.password
        )
        const cookie = await buildAuthCookie(client)

        const response = await fetch(
            `${BASE_URL}/api/menu-items/${fixture.menuItemId}`,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Cookie: cookie },
                body: JSON.stringify({ image_url: 'https://example.com/image.jpg' }),
                redirect: 'manual',
            }
        )
        expect(response.status).toBe(200)
    })

    it('rejects unknown fields with 400', async () => {
        const fixture = await seedTestData(serviceClient)
        const client = await createRoleClient(
            fixture.profiles.restaurant_owner.email,
            fixture.profiles.restaurant_owner.password
        )
        const cookie = await buildAuthCookie(client)

        const response = await fetch(
            `${BASE_URL}/api/menu-items/${fixture.menuItemId}`,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Cookie: cookie },
                body: JSON.stringify({ price: 999 }),
                redirect: 'manual',
            }
        )
        expect(response.status).toBe(400)
    })

    it('rejects empty body with 400', async () => {
        const fixture = await seedTestData(serviceClient)
        const client = await createRoleClient(
            fixture.profiles.restaurant_owner.email,
            fixture.profiles.restaurant_owner.password
        )
        const cookie = await buildAuthCookie(client)

        const response = await fetch(
            `${BASE_URL}/api/menu-items/${fixture.menuItemId}`,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Cookie: cookie },
                body: JSON.stringify({}),
                redirect: 'manual',
            }
        )
        expect(response.status).toBe(400)
    })
})

describe('DELETE /api/menu-items/[menuItemId]', () => {
    const serviceClient = createServiceClient()

    beforeEach(() => resetDatabase(serviceClient), 60_000)

    it('allows owner to delete a menu item', async () => {
        const fixture = await seedTestData(serviceClient)
        const client = await createRoleClient(
            fixture.profiles.restaurant_owner.email,
            fixture.profiles.restaurant_owner.password
        )
        const cookie = await buildAuthCookie(client)

        const response = await fetch(
            `${BASE_URL}/api/menu-items/${fixture.menuItemId}`,
            {
                method: 'DELETE',
                headers: { Cookie: cookie },
                redirect: 'manual',
            }
        )
        expect(response.status).toBe(200)
    })

    it('allows manager to delete a menu item', async () => {
        const fixture = await seedTestData(serviceClient)
        const client = await createRoleClient(
            fixture.profiles.manager.email,
            fixture.profiles.manager.password
        )
        const cookie = await buildAuthCookie(client)

        const response = await fetch(
            `${BASE_URL}/api/menu-items/${fixture.menuItemId}`,
            {
                method: 'DELETE',
                headers: { Cookie: cookie },
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
            `${BASE_URL}/api/menu-items/${fixture.menuItemId}`,
            {
                method: 'DELETE',
                headers: { Cookie: cookie },
                redirect: 'manual',
            }
        )
        expect(response.status).toBe(403)
    })
})

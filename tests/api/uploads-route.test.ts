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

function createTestFile(): Blob {
    // Minimal 1x1 PNG
    const pngHeader = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
        0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
        0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33, 0x00, 0x00, 0x00,
        0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ])
    return new Blob([pngHeader], { type: 'image/png' })
}

describe('POST /api/uploads', () => {
    const serviceClient = createServiceClient()

    beforeEach(() => resetDatabase(serviceClient), 60_000)

    it('rejects unauthenticated request with 307', async () => {
        const formData = new FormData()
        formData.append('file', createTestFile(), 'test.png')
        formData.append('bucket', 'restaurant-logos')
        formData.append('restaurantId', 'some-id')

        const response = await fetch(`${BASE_URL}/api/uploads`, {
            method: 'POST',
            body: formData,
            redirect: 'manual',
        })
        expect(response.status).toBe(307)
    })

    it('allows owner to upload to restaurant-logos bucket', async () => {
        const fixture = await seedTestData(serviceClient)
        const client = await createRoleClient(
            fixture.profiles.restaurant_owner.email,
            fixture.profiles.restaurant_owner.password
        )
        const cookie = await buildAuthCookie(client)

        const formData = new FormData()
        formData.append('file', createTestFile(), 'logo.png')
        formData.append('bucket', 'restaurant-logos')
        formData.append('restaurantId', fixture.restaurantId)

        const response = await fetch(`${BASE_URL}/api/uploads`, {
            method: 'POST',
            headers: { Cookie: cookie },
            body: formData,
            redirect: 'manual',
        })
        expect(response.status).toBe(201)
        const body = (await response.json()) as { data: { publicUrl: string } }
        expect(body.data.publicUrl).toBeDefined()
    })

    it('allows owner to upload to menu-images bucket', async () => {
        const fixture = await seedTestData(serviceClient)
        const client = await createRoleClient(
            fixture.profiles.restaurant_owner.email,
            fixture.profiles.restaurant_owner.password
        )
        const cookie = await buildAuthCookie(client)

        const formData = new FormData()
        formData.append('file', createTestFile(), 'item.png')
        formData.append('bucket', 'menu-images')
        formData.append('restaurantId', fixture.restaurantId)

        const response = await fetch(`${BASE_URL}/api/uploads`, {
            method: 'POST',
            headers: { Cookie: cookie },
            body: formData,
            redirect: 'manual',
        })
        expect(response.status).toBe(201)
    })

    it('rejects upload to disallowed bucket with 400', async () => {
        const fixture = await seedTestData(serviceClient)
        const client = await createRoleClient(
            fixture.profiles.restaurant_owner.email,
            fixture.profiles.restaurant_owner.password
        )
        const cookie = await buildAuthCookie(client)

        const formData = new FormData()
        formData.append('file', createTestFile(), 'hack.png')
        formData.append('bucket', 'evil-bucket')
        formData.append('restaurantId', fixture.restaurantId)

        const response = await fetch(`${BASE_URL}/api/uploads`, {
            method: 'POST',
            headers: { Cookie: cookie },
            body: formData,
            redirect: 'manual',
        })
        expect(response.status).toBe(400)
    })

    it('rejects waiter with 403', async () => {
        const fixture = await seedTestData(serviceClient)
        const client = await createRoleClient(
            fixture.profiles.waiter.email,
            fixture.profiles.waiter.password
        )
        const cookie = await buildAuthCookie(client)

        const formData = new FormData()
        formData.append('file', createTestFile(), 'test.png')
        formData.append('bucket', 'restaurant-logos')
        formData.append('restaurantId', fixture.restaurantId)

        const response = await fetch(`${BASE_URL}/api/uploads`, {
            method: 'POST',
            headers: { Cookie: cookie },
            body: formData,
            redirect: 'manual',
        })
        expect(response.status).toBe(403)
    })

    it('rejects missing file with 400', async () => {
        const fixture = await seedTestData(serviceClient)
        const client = await createRoleClient(
            fixture.profiles.restaurant_owner.email,
            fixture.profiles.restaurant_owner.password
        )
        const cookie = await buildAuthCookie(client)

        const formData = new FormData()
        formData.append('bucket', 'restaurant-logos')
        formData.append('restaurantId', fixture.restaurantId)

        const response = await fetch(`${BASE_URL}/api/uploads`, {
            method: 'POST',
            headers: { Cookie: cookie },
            body: formData,
            redirect: 'manual',
        })
        expect(response.status).toBe(400)
    })
})

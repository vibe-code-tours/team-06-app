import { resetDatabase } from '../helpers/resetDatabase'
import { seedTestData } from '../helpers/seedTestData'
import {
    createServiceClient,
    createAnonClient,
    createRoleClient,
} from '../helpers/supabaseTestClient'

describe('RLS harness smoke test', () => {
    const serviceClient = createServiceClient()

    beforeEach(async () => {
        await resetDatabase(serviceClient)
    })

    it('lets an anonymous client read an active restaurant', async () => {
        const fixture = await seedTestData(serviceClient)
        const anonClient = createAnonClient()

        const { data, error } = await anonClient
            .from('restaurants')
            .select('id')
            .eq('id', fixture.restaurantId)

        expect(error).toBeNull()
        expect(data).toHaveLength(1)
    })

    it('blocks an anonymous client from reading profiles', async () => {
        await seedTestData(serviceClient)
        const anonClient = createAnonClient()

        const { data, error } = await anonClient.from('profiles').select('id')

        expect(error).toBeNull()
        expect(data).toEqual([])
    })

    it('lets a restaurant_owner read their own restaurant profiles', async () => {
        const fixture = await seedTestData(serviceClient)
        const ownerClient = await createRoleClient(
            fixture.profiles.restaurant_owner.email,
            fixture.profiles.restaurant_owner.password
        )

        const { data, error } = await ownerClient
            .from('profiles')
            .select('id')
            .eq('restaurant_id', fixture.restaurantId)

        expect(error).toBeNull()
        expect(data!.length).toBeGreaterThan(0)
    })
})

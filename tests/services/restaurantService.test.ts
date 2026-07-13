import { resetDatabase } from '../helpers/resetDatabase'
import { createServiceClient } from '../helpers/supabaseTestClient'
import { createRestaurant, updateRestaurant } from '../../apps/web/lib/services/restaurantService'

describe('restaurantService', () => {
    const serviceClient = createServiceClient()

    beforeEach(() => resetDatabase(serviceClient))

    it('creates a restaurant', async () => {
        const result = await createRestaurant(serviceClient, {
            name: 'New Spot',
            description: '',
            tax_rate: 0.08,
        })

        expect('id' in result).toBe(true)
    })

    it('deactivates a restaurant', async () => {
        const created = await createRestaurant(serviceClient, {
            name: 'To Deactivate',
            description: '',
            tax_rate: 0,
        })
        if (!('id' in created)) throw new Error('setup failed')

        const result = await updateRestaurant(serviceClient, created.id, {
            is_active: false,
        })

        expect(result).toEqual({ success: true })

        const { data } = await serviceClient
            .from('restaurants')
            .select('is_active')
            .eq('id', created.id)
            .single()

        expect(data!.is_active).toBe(false)
    })

    it('updates logo_url', async () => {
        const created = await createRestaurant(serviceClient, {
            name: 'Logo Test',
            description: '',
            tax_rate: 0,
        })
        if (!('id' in created)) throw new Error('setup failed')

        const result = await updateRestaurant(serviceClient, created.id, {
            logo_url: 'https://example.app/logo.png',
        })

        expect(result).toEqual({ success: true })
    })
})

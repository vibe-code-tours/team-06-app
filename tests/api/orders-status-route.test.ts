import { resetDatabase } from '../helpers/resetDatabase'
import { seedTestData } from '../helpers/seedTestData'
import { createServiceClient } from '../helpers/supabaseTestClient'

const BASE_URL = process.env.TEST_APP_URL ?? 'http://localhost:3000'

describe('POST /api/orders/[orderId]/status', () => {
    const serviceClient = createServiceClient()

    beforeEach(() => resetDatabase(serviceClient))

    it('rejects a body missing status with 400', async () => {
        const fixture = await seedTestData(serviceClient)
        const { data: order } = await serviceClient
            .from('orders')
            .insert({ restaurant_id: fixture.restaurantId, table_id: fixture.tableId, status: 'PENDING' })
            .select()
            .single()

        const response = await fetch(`${BASE_URL}/api/orders/${order!.id}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        })

        expect(response.status).toBe(400)
    })

    it('rejects an invalid transition with 422', async () => {
        const fixture = await seedTestData(serviceClient)
        const { data: order } = await serviceClient
            .from('orders')
            .insert({ restaurant_id: fixture.restaurantId, table_id: fixture.tableId, status: 'PENDING' })
            .select()
            .single()

        const response = await fetch(`${BASE_URL}/api/orders/${order!.id}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'READY' }),
        })

        expect(response.status).toBe(422)
    })
})

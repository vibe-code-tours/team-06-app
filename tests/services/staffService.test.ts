import { resetDatabase } from '../helpers/resetDatabase'
import { seedTestData } from '../helpers/seedTestData'
import { createServiceClient } from '../helpers/supabaseTestClient'
import { inviteStaff } from '../../apps/web/lib/services/staffService'

describe('staffService', () => {
    const serviceClient = createServiceClient()

    beforeEach(() => resetDatabase(serviceClient))

    it('invites a staff member and returns userId', async () => {
        const fixture = await seedTestData(serviceClient)

        const result = await inviteStaff(serviceClient, fixture.restaurantId, {
            email: 'newstaff@test.local',
            role: 'waiter',
        })

        expect(result).toHaveProperty('userId')
        if ('userId' in result) {
            expect(result.userId).toBeDefined()
        }
    })

    it('returns error for invalid email format', async () => {
        const fixture = await seedTestData(serviceClient)

        const result = await inviteStaff(serviceClient, fixture.restaurantId, {
            email: 'not-an-email',
            role: 'waiter',
        })

        expect(result).toHaveProperty('error')
    })

    it('returns error for invalid role', async () => {
        const fixture = await seedTestData(serviceClient)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const invalidInput: any = { email: 'valid@test.local', role: 'invalid_role' }
        const result = await inviteStaff(serviceClient, fixture.restaurantId, invalidInput)

        expect(result).toHaveProperty('error')
    })

    it('invites with different valid roles', async () => {
        const fixture = await seedTestData(serviceClient)
        const roles = ['manager', 'kitchen_staff', 'waiter', 'cashier'] as const

        for (const role of roles) {
            const result = await inviteStaff(serviceClient, fixture.restaurantId, {
                email: `${role}-invite@test.local`,
                role,
            })

            expect(result).toHaveProperty('userId')
        }
    })
})

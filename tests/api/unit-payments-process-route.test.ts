import {
    createMockSupabaseClient,
    MockSupabaseResponses,
} from '../helpers/mockSupabaseClient'

jest.mock('@/lib/supabase/server', () => ({
    createClient: jest.fn(),
}))

jest.mock('@/lib/services/paymentService', () => ({
    processPayment: jest.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { processPayment } from '@/lib/services/paymentService'
import { POST } from '../../apps/web/app/api/payments/process/route'

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>
const mockProcessPayment = processPayment as jest.MockedFunction<typeof processPayment>

const RESTAURANT_A = 'a1b2c3d4-e5f6-7890-abcd-ef0123456789'
const RESTAURANT_B = 'b2c3d4e5-f6a7-8901-bcde-f01234567890'
const ORDER_ID = 'c3d4e5f6-a7b8-9012-cdef-012345678901'
const USER_ID = 'd4e5f6a7-b8c9-0123-def0-123456789012'

const VALID_BODY = {
    order_id: ORDER_ID,
    amount: 13.75,
    tax_amount: 1.25,
    discount_amount: 0,
    payment_method: 'CASH',
}

function buildRequest(body: unknown) {
    return new Request('http://localhost/api/payments/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
}

function setupMocks(responses: MockSupabaseResponses) {
    const mockClient = createMockSupabaseClient(responses)
    mockCreateClient.mockReturnValue(mockClient as any)
    return mockClient
}

describe('POST /api/payments/process', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('returns 200 for allowed role with correct restaurant', async () => {
        setupMocks({
            user: { id: USER_ID },
            profile: { id: USER_ID, role: 'cashier', restaurant_id: RESTAURANT_A },
            resource: { id: ORDER_ID, restaurant_id: RESTAURANT_A },
        })
        mockProcessPayment.mockResolvedValue({ paymentId: 'pay-001' })

        const request = buildRequest(VALID_BODY)
        const response = await POST(request)

        expect(response.status).toBe(200)
        expect(mockProcessPayment).toHaveBeenCalled()
    })

    it('returns 401 when not authenticated', async () => {
        setupMocks({
            user: null,
            profile: null,
            resource: null,
        })

        const request = buildRequest(VALID_BODY)
        const response = await POST(request)

        expect(response.status).toBe(401)
        expect(mockProcessPayment).not.toHaveBeenCalled()
    })

    it('returns 403 for disallowed role', async () => {
        setupMocks({
            user: { id: USER_ID },
            profile: { id: USER_ID, role: 'kitchen_staff', restaurant_id: RESTAURANT_A },
            resource: { id: ORDER_ID, restaurant_id: RESTAURANT_A },
        })

        const request = buildRequest(VALID_BODY)
        const response = await POST(request)

        expect(response.status).toBe(403)
        expect(mockProcessPayment).not.toHaveBeenCalled()
    })

    it('returns 403 for cross-restaurant access', async () => {
        setupMocks({
            user: { id: USER_ID },
            profile: { id: USER_ID, role: 'cashier', restaurant_id: RESTAURANT_A },
            resource: { id: ORDER_ID, restaurant_id: RESTAURANT_B },
        })

        const request = buildRequest(VALID_BODY)
        const response = await POST(request)

        expect(response.status).toBe(403)
        expect(mockProcessPayment).not.toHaveBeenCalled()
    })

    it('returns 404 when order not found', async () => {
        setupMocks({
            user: { id: USER_ID },
            profile: { id: USER_ID, role: 'cashier', restaurant_id: RESTAURANT_A },
            resource: null,
        })

        const request = buildRequest(VALID_BODY)
        const response = await POST(request)

        expect(response.status).toBe(404)
        expect(mockProcessPayment).not.toHaveBeenCalled()
    })

    it('allows super_admin to bypass restaurant check', async () => {
        setupMocks({
            user: { id: USER_ID },
            profile: { id: USER_ID, role: 'super_admin', restaurant_id: null },
            resource: { id: ORDER_ID, restaurant_id: RESTAURANT_B },
        })
        mockProcessPayment.mockResolvedValue({ paymentId: 'pay-001' })

        const request = buildRequest(VALID_BODY)
        const response = await POST(request)

        expect(response.status).toBe(200)
        expect(mockProcessPayment).toHaveBeenCalled()
    })

    it('returns 400 for invalid body', async () => {
        setupMocks({
            user: { id: USER_ID },
            profile: { id: USER_ID, role: 'cashier', restaurant_id: RESTAURANT_A },
            resource: { id: ORDER_ID, restaurant_id: RESTAURANT_A },
        })

        const request = buildRequest({ order_id: 'not-a-uuid' })
        const response = await POST(request)

        expect(response.status).toBe(400)
        expect(mockProcessPayment).not.toHaveBeenCalled()
    })
})

import {
    createMockSupabaseClient,
    MockSupabaseResponses,
} from '../helpers/mockSupabaseClient'

jest.mock('@/lib/supabase/server', () => ({
    createClient: jest.fn(),
}))

jest.mock('@/lib/services/paymentService', () => ({
    refundPayment: jest.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { refundPayment } from '@/lib/services/paymentService'
import { POST } from '../../apps/web/app/api/payments/[paymentId]/refund/route'

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>
const mockRefundPayment = refundPayment as jest.MockedFunction<typeof refundPayment>

const RESTAURANT_A = 'rest-a-0000-0000-000000000001'
const RESTAURANT_B = 'rest-b-0000-0000-000000000002'
const PAYMENT_ID = 'pay-0000-0000-000000000001'
const USER_ID = 'user-0000-0000-000000000001'

function buildRequest(body: unknown) {
    return new Request('http://localhost/api/payments/test/refund', {
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

describe('POST /api/payments/[paymentId]/refund', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('returns 200 for allowed role with correct restaurant', async () => {
        setupMocks({
            user: { id: USER_ID },
            profile: { id: USER_ID, role: 'cashier', restaurant_id: RESTAURANT_A },
            resource: { id: PAYMENT_ID, restaurant_id: RESTAURANT_A },
        })
        mockRefundPayment.mockResolvedValue({ success: true })

        const request = buildRequest({ reason: 'Customer request' })
        const response = await POST(request, { params: { paymentId: PAYMENT_ID } })

        expect(response.status).toBe(200)
        expect(mockRefundPayment).toHaveBeenCalledWith(
            expect.anything(),
            PAYMENT_ID,
            'Customer request'
        )
    })

    it('returns 401 when not authenticated', async () => {
        setupMocks({
            user: null,
            profile: null,
            resource: null,
        })

        const request = buildRequest({ reason: 'Customer request' })
        const response = await POST(request, { params: { paymentId: PAYMENT_ID } })

        expect(response.status).toBe(401)
        expect(mockRefundPayment).not.toHaveBeenCalled()
    })

    it('returns 403 for disallowed role', async () => {
        setupMocks({
            user: { id: USER_ID },
            profile: { id: USER_ID, role: 'kitchen_staff', restaurant_id: RESTAURANT_A },
            resource: { id: PAYMENT_ID, restaurant_id: RESTAURANT_A },
        })

        const request = buildRequest({ reason: 'Customer request' })
        const response = await POST(request, { params: { paymentId: PAYMENT_ID } })

        expect(response.status).toBe(403)
        expect(mockRefundPayment).not.toHaveBeenCalled()
    })

    it('returns 403 for cross-restaurant access', async () => {
        setupMocks({
            user: { id: USER_ID },
            profile: { id: USER_ID, role: 'cashier', restaurant_id: RESTAURANT_A },
            resource: { id: PAYMENT_ID, restaurant_id: RESTAURANT_B },
        })

        const request = buildRequest({ reason: 'Customer request' })
        const response = await POST(request, { params: { paymentId: PAYMENT_ID } })

        expect(response.status).toBe(403)
        expect(mockRefundPayment).not.toHaveBeenCalled()
    })

    it('returns 404 when payment not found', async () => {
        setupMocks({
            user: { id: USER_ID },
            profile: { id: USER_ID, role: 'cashier', restaurant_id: RESTAURANT_A },
            resource: null,
        })

        const request = buildRequest({ reason: 'Customer request' })
        const response = await POST(request, { params: { paymentId: PAYMENT_ID } })

        expect(response.status).toBe(404)
        expect(mockRefundPayment).not.toHaveBeenCalled()
    })

    it('allows super_admin to bypass restaurant check', async () => {
        setupMocks({
            user: { id: USER_ID },
            profile: { id: USER_ID, role: 'super_admin', restaurant_id: null },
            resource: { id: PAYMENT_ID, restaurant_id: RESTAURANT_B },
        })
        mockRefundPayment.mockResolvedValue({ success: true })

        const request = buildRequest({ reason: 'Customer request' })
        const response = await POST(request, { params: { paymentId: PAYMENT_ID } })

        expect(response.status).toBe(200)
        expect(mockRefundPayment).toHaveBeenCalled()
    })

    it('returns 400 for invalid body', async () => {
        setupMocks({
            user: { id: USER_ID },
            profile: { id: USER_ID, role: 'cashier', restaurant_id: RESTAURANT_A },
            resource: { id: PAYMENT_ID, restaurant_id: RESTAURANT_A },
        })

        const request = buildRequest({ reason: '' })
        const response = await POST(request, { params: { paymentId: PAYMENT_ID } })

        expect(response.status).toBe(400)
        expect(mockRefundPayment).not.toHaveBeenCalled()
    })
})

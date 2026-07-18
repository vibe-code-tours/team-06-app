import {
    createMockSupabaseClient,
    MockSupabaseResponses,
} from '../helpers/mockSupabaseClient'

// Mock the Supabase server client
jest.mock('@/lib/supabase/server', () => ({
    createClient: jest.fn(),
}))

// Mock the service function
jest.mock('@/lib/services/orderStatusService', () => ({
    updateOrderStatus: jest.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { updateOrderStatus } from '@/lib/services/orderStatusService'
import { POST } from '../../apps/web/app/api/orders/[orderId]/status/route'

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>
const mockUpdateOrderStatus = updateOrderStatus as jest.MockedFunction<typeof updateOrderStatus>

const RESTAURANT_A = 'rest-a-0000-0000-000000000001'
const RESTAURANT_B = 'rest-b-0000-0000-000000000002'
const ORDER_ID = 'order-0000-0000-000000000001'
const USER_ID = 'user-0000-0000-000000000001'

function buildRequest(body: unknown) {
    return new Request('http://localhost/api/orders/test/status', {
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

describe('POST /api/orders/[orderId]/status', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('returns 200 for allowed role with correct restaurant', async () => {
        setupMocks({
            user: { id: USER_ID },
            profile: { id: USER_ID, role: 'kitchen_staff', restaurant_id: RESTAURANT_A },
            resource: { id: ORDER_ID, restaurant_id: RESTAURANT_A },
        })
        mockUpdateOrderStatus.mockResolvedValue({ status: 'ACCEPTED' })

        const request = buildRequest({ status: 'ACCEPTED' })
        const response = await POST(request, { params: { orderId: ORDER_ID } })

        expect(response.status).toBe(200)
        expect(mockUpdateOrderStatus).toHaveBeenCalledWith(
            expect.anything(),
            ORDER_ID,
            'ACCEPTED'
        )
    })

    it('returns 401 when not authenticated', async () => {
        setupMocks({
            user: null,
            profile: null,
            resource: null,
        })

        const request = buildRequest({ status: 'ACCEPTED' })
        const response = await POST(request, { params: { orderId: ORDER_ID } })

        expect(response.status).toBe(401)
        expect(mockUpdateOrderStatus).not.toHaveBeenCalled()
    })

    it('returns 403 for disallowed role', async () => {
        setupMocks({
            user: { id: USER_ID },
            profile: { id: USER_ID, role: 'waiter', restaurant_id: RESTAURANT_A },
            resource: { id: ORDER_ID, restaurant_id: RESTAURANT_A },
        })

        const request = buildRequest({ status: 'ACCEPTED' })
        const response = await POST(request, { params: { orderId: ORDER_ID } })

        expect(response.status).toBe(403)
        expect(mockUpdateOrderStatus).not.toHaveBeenCalled()
    })

    it('returns 403 for cross-restaurant access', async () => {
        setupMocks({
            user: { id: USER_ID },
            profile: { id: USER_ID, role: 'kitchen_staff', restaurant_id: RESTAURANT_A },
            resource: { id: ORDER_ID, restaurant_id: RESTAURANT_B },
        })

        const request = buildRequest({ status: 'ACCEPTED' })
        const response = await POST(request, { params: { orderId: ORDER_ID } })

        expect(response.status).toBe(403)
        expect(mockUpdateOrderStatus).not.toHaveBeenCalled()
    })

    it('returns 404 when order not found', async () => {
        setupMocks({
            user: { id: USER_ID },
            profile: { id: USER_ID, role: 'kitchen_staff', restaurant_id: RESTAURANT_A },
            resource: null,
        })

        const request = buildRequest({ status: 'ACCEPTED' })
        const response = await POST(request, { params: { orderId: ORDER_ID } })

        expect(response.status).toBe(404)
        expect(mockUpdateOrderStatus).not.toHaveBeenCalled()
    })

    it('allows super_admin to bypass restaurant check', async () => {
        setupMocks({
            user: { id: USER_ID },
            profile: { id: USER_ID, role: 'super_admin', restaurant_id: null },
            resource: { id: ORDER_ID, restaurant_id: RESTAURANT_B },
        })
        mockUpdateOrderStatus.mockResolvedValue({ status: 'ACCEPTED' })

        const request = buildRequest({ status: 'ACCEPTED' })
        const response = await POST(request, { params: { orderId: ORDER_ID } })

        expect(response.status).toBe(200)
        expect(mockUpdateOrderStatus).toHaveBeenCalled()
    })

    it('returns 400 for invalid body', async () => {
        setupMocks({
            user: { id: USER_ID },
            profile: { id: USER_ID, role: 'kitchen_staff', restaurant_id: RESTAURANT_A },
            resource: { id: ORDER_ID, restaurant_id: RESTAURANT_A },
        })

        const request = buildRequest({ status: 'INVALID_STATUS' })
        const response = await POST(request, { params: { orderId: ORDER_ID } })

        expect(response.status).toBe(400)
        expect(mockUpdateOrderStatus).not.toHaveBeenCalled()
    })
})

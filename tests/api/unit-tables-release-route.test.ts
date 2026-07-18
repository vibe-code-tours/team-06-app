import {
    createMockSupabaseClient,
    MockSupabaseResponses,
} from '../helpers/mockSupabaseClient'

jest.mock('@/lib/supabase/server', () => ({
    createClient: jest.fn(),
}))

jest.mock('@/lib/services/tableService', () => ({
    releaseTable: jest.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { releaseTable } from '@/lib/services/tableService'
import { POST } from '../../apps/web/app/api/tables/[tableId]/release/route'

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>
const mockReleaseTable = releaseTable as jest.MockedFunction<typeof releaseTable>

const RESTAURANT_A = 'rest-a-0000-0000-000000000001'
const RESTAURANT_B = 'rest-b-0000-0000-000000000002'
const TABLE_ID = 'table-0000-0000-000000000001'
const USER_ID = 'user-0000-0000-000000000001'

function buildRequest() {
    return new Request('http://localhost/api/tables/test/release', {
        method: 'POST',
    })
}

function setupMocks(responses: MockSupabaseResponses) {
    const mockClient = createMockSupabaseClient(responses)
    mockCreateClient.mockReturnValue(mockClient as any)
    return mockClient
}

describe('POST /api/tables/[tableId]/release', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('returns 200 for allowed role with correct restaurant', async () => {
        setupMocks({
            user: { id: USER_ID },
            profile: { id: USER_ID, role: 'waiter', restaurant_id: RESTAURANT_A },
            resource: { id: TABLE_ID, restaurant_id: RESTAURANT_A },
        })
        mockReleaseTable.mockResolvedValue({ success: true })

        const request = buildRequest()
        const response = await POST(request, { params: { tableId: TABLE_ID } })

        expect(response.status).toBe(200)
        expect(mockReleaseTable).toHaveBeenCalledWith(expect.anything(), TABLE_ID)
    })

    it('returns 401 when not authenticated', async () => {
        setupMocks({
            user: null,
            profile: null,
            resource: null,
        })

        const request = buildRequest()
        const response = await POST(request, { params: { tableId: TABLE_ID } })

        expect(response.status).toBe(401)
        expect(mockReleaseTable).not.toHaveBeenCalled()
    })

    it('returns 403 for disallowed role', async () => {
        setupMocks({
            user: { id: USER_ID },
            profile: { id: USER_ID, role: 'kitchen_staff', restaurant_id: RESTAURANT_A },
            resource: { id: TABLE_ID, restaurant_id: RESTAURANT_A },
        })

        const request = buildRequest()
        const response = await POST(request, { params: { tableId: TABLE_ID } })

        expect(response.status).toBe(403)
        expect(mockReleaseTable).not.toHaveBeenCalled()
    })

    it('returns 403 for cross-restaurant access', async () => {
        setupMocks({
            user: { id: USER_ID },
            profile: { id: USER_ID, role: 'waiter', restaurant_id: RESTAURANT_A },
            resource: { id: TABLE_ID, restaurant_id: RESTAURANT_B },
        })

        const request = buildRequest()
        const response = await POST(request, { params: { tableId: TABLE_ID } })

        expect(response.status).toBe(403)
        expect(mockReleaseTable).not.toHaveBeenCalled()
    })

    it('returns 404 when table not found', async () => {
        setupMocks({
            user: { id: USER_ID },
            profile: { id: USER_ID, role: 'waiter', restaurant_id: RESTAURANT_A },
            resource: null,
        })

        const request = buildRequest()
        const response = await POST(request, { params: { tableId: TABLE_ID } })

        expect(response.status).toBe(404)
        expect(mockReleaseTable).not.toHaveBeenCalled()
    })

    it('allows super_admin to bypass restaurant check', async () => {
        setupMocks({
            user: { id: USER_ID },
            profile: { id: USER_ID, role: 'super_admin', restaurant_id: null },
            resource: { id: TABLE_ID, restaurant_id: RESTAURANT_B },
        })
        mockReleaseTable.mockResolvedValue({ success: true })

        const request = buildRequest()
        const response = await POST(request, { params: { tableId: TABLE_ID } })

        expect(response.status).toBe(200)
        expect(mockReleaseTable).toHaveBeenCalled()
    })

    it('returns 422 when service call fails', async () => {
        setupMocks({
            user: { id: USER_ID },
            profile: { id: USER_ID, role: 'waiter', restaurant_id: RESTAURANT_A },
            resource: { id: TABLE_ID, restaurant_id: RESTAURANT_A },
        })
        mockReleaseTable.mockResolvedValue({ error: 'No active session' })

        const request = buildRequest()
        const response = await POST(request, { params: { tableId: TABLE_ID } })

        expect(response.status).toBe(422)
    })
})

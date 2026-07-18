/**
 * Mock Supabase client factory for unit testing API route handlers.
 *
 * Returns a chainable mock that supports the query patterns used in route handlers:
 *   supabase.auth.getUser()
 *   supabase.from('table').select('cols').eq('col', val).single()
 */

export interface MockUser {
    id: string
    email?: string
}

export interface MockProfile {
    id: string
    role: string
    restaurant_id: string | null
}

export interface MockResource {
    id: string
    restaurant_id: string
    [key: string]: unknown
}

export interface MockSupabaseResponses {
    user: MockUser | null
    profile: MockProfile | null
    resource: MockResource | null
}

function createChainResult(data: unknown, error: unknown = null) {
    return {
        data,
        error,
        // Chain methods return the same result object
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data, error }),
    }
}

export function createMockSupabaseClient(responses: MockSupabaseResponses) {
    const fromMock = jest.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
            return createChainResult(responses.profile)
        }
        // orders, payments, tables
        return createChainResult(responses.resource)
    })

    return {
        auth: {
            getUser: jest.fn().mockResolvedValue({
                data: { user: responses.user },
                error: responses.user ? null : { message: 'Not authenticated' },
            }),
        },
        from: fromMock,
    }
}

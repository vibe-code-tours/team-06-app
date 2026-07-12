/**
 * @jest-environment jsdom
 */
import { renderHook, waitFor } from '@testing-library/react'
import { useRealtimeWithPolling } from '../../apps/web/hooks/useRealtimeWithPolling'

jest.mock('@/lib/supabase/client', () => ({
    createClient: () => ({
        channel: () => ({
            on: () => ({
                subscribe: () => {
                    return {}
                },
            }),
        }),
        removeChannel: jest.fn(),
    }),
}))

describe('useRealtimeWithPolling', () => {
    jest.useFakeTimers()

    it('calls onChange via polling fallback after the interval elapses', async () => {
        const onChange = jest.fn()

        renderHook(() =>
            useRealtimeWithPolling({
                channelName: 'test-channel',
                table: 'orders',
                onChange,
                pollIntervalMs: 1000,
            })
        )

        jest.advanceTimersByTime(1000)

        await waitFor(() => expect(onChange).toHaveBeenCalled())
    })
})

'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface UseRealtimeWithPollingOptions {
    channelName: string
    table: string
    onChange: () => void
    pollIntervalMs?: number
}

export function useRealtimeWithPolling({
    channelName,
    table,
    onChange,
    pollIntervalMs = 15000,
}: UseRealtimeWithPollingOptions): void {
    useEffect(() => {
        const supabase = createClient()

        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table },
                () => {
                    onChange()
                }
            )
            .subscribe()

        // Polling fallback: runs regardless of Realtime connection state so a
        // silently dropped websocket never leaves the dashboard stale.
        const pollInterval = setInterval(() => {
            onChange()
        }, pollIntervalMs)

        return () => {
            supabase.removeChannel(channel)
            clearInterval(pollInterval)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channelName, table, pollIntervalMs])
}

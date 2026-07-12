import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resetDatabase } from './resetDatabase'

config({ path: 'supabase/.env.test' })

const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

describe('resetDatabase', () => {
    it('removes all rows from restaurants table', async () => {
        await client.from('restaurants').insert({ name: 'Leftover Diner' })

        await resetDatabase(client)

        const { data, error } = await client.from('restaurants').select('id')
        expect(error).toBeNull()
        expect(data).toEqual([])
    })
})

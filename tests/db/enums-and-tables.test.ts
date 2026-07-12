import { createServiceClient } from '../helpers/supabaseTestClient';

const EXPECTED_TABLES = [
  'profiles',
  'restaurants',
  'categories',
  'menu_items',
  'tables',
  'order_sessions',
  'orders',
  'order_items',
  'payments',
] as const;

describe('schema shape', () => {
  const client = createServiceClient();

  it.each(EXPECTED_TABLES)('table %s is queryable', async (table) => {
    const { error } = await client.from(table).select('*').limit(1);
    expect(error).toBeNull();
  });

  it('rejects an invalid order_status enum value', async () => {
    const { error } = await client
      .from('orders')
      .insert({
        restaurant_id: '00000000-0000-0000-0000-000000000000',
        table_id: '00000000-0000-0000-0000-000000000000',
        status: 'NOT_A_REAL_STATUS' as never,
      });

    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/invalid input value for enum/);
  });
});

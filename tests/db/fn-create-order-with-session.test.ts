import { resetDatabase } from '../helpers/resetDatabase';
import { seedTestData } from '../helpers/seedTestData';
import { createServiceClient } from '../helpers/supabaseTestClient';

describe('create_order_with_session()', () => {
  const serviceClient = createServiceClient();

  beforeEach(() => resetDatabase(serviceClient));

  it('creates an order and sets table status to OCCUPIED', async () => {
    const fixture = await seedTestData(serviceClient);

    const { data: orderId, error } = await serviceClient.rpc('create_order_with_session', {
      p_restaurant_id: fixture.restaurantId,
      p_table_id: fixture.tableId,
      p_customer_name: 'Test Customer',
      p_items: [{ menu_item_id: fixture.menuItemId, quantity: 2 }],
    });

    expect(error).toBeNull();
    expect(orderId).toBeTruthy();

    const { data: table } = await serviceClient
      .from('tables')
      .select('status')
      .eq('id', fixture.tableId)
      .single();
    expect(table!.status).toBe('OCCUPIED');

    const { data: items } = await serviceClient
      .from('order_items')
      .select('quantity, unit_price')
      .eq('order_id', orderId);
    expect(items).toHaveLength(1);
    expect(items![0].quantity).toBe(2);
    expect(Number(items![0].unit_price)).toBe(12.5);
  });

  it('rejects a second order while a session is active for the same table', async () => {
    const fixture = await seedTestData(serviceClient);
    await serviceClient.rpc('create_order_with_session', {
      p_restaurant_id: fixture.restaurantId,
      p_table_id: fixture.tableId,
      p_items: [{ menu_item_id: fixture.menuItemId, quantity: 1 }],
    });

    const { error } = await serviceClient.rpc('create_order_with_session', {
      p_restaurant_id: fixture.restaurantId,
      p_table_id: fixture.tableId,
      p_items: [{ menu_item_id: fixture.menuItemId, quantity: 1 }],
    });

    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/active session already exists/);
  });

  it('rejects an order containing an unavailable menu item', async () => {
    const fixture = await seedTestData(serviceClient);
    await serviceClient
      .from('menu_items')
      .update({ is_available: false })
      .eq('id', fixture.menuItemId);

    const { error } = await serviceClient.rpc('create_order_with_session', {
      p_restaurant_id: fixture.restaurantId,
      p_table_id: fixture.tableId,
      p_items: [{ menu_item_id: fixture.menuItemId, quantity: 1 }],
    });

    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/not available/);
  });
});

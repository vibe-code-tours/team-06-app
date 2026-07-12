import { resetDatabase } from '../helpers/resetDatabase';
import { seedTestData } from '../helpers/seedTestData';
import { createServiceClient } from '../helpers/supabaseTestClient';

describe('update_order_status()', () => {
  const serviceClient = createServiceClient();

  beforeEach(() => resetDatabase(serviceClient));

  async function createPendingOrder(restaurantId: string, tableId: string) {
    const { data } = await serviceClient
      .from('orders')
      .insert({ restaurant_id: restaurantId, table_id: tableId, status: 'PENDING' })
      .select()
      .single();
    return data!.id as string;
  }

  it('allows PENDING -> ACCEPTED', async () => {
    const fixture = await seedTestData(serviceClient);
    const orderId = await createPendingOrder(fixture.restaurantId, fixture.tableId);

    const { data, error } = await serviceClient.rpc('update_order_status', {
      p_order_id: orderId,
      p_new_status: 'ACCEPTED',
    });

    expect(error).toBeNull();
    expect(data).toBe('ACCEPTED');
  });

  it('rejects skipping PENDING -> READY', async () => {
    const fixture = await seedTestData(serviceClient);
    const orderId = await createPendingOrder(fixture.restaurantId, fixture.tableId);

    const { error } = await serviceClient.rpc('update_order_status', {
      p_order_id: orderId,
      p_new_status: 'READY',
    });

    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/Invalid status transition/);
  });

  it('rejects cancelling a COMPLETED order', async () => {
    const fixture = await seedTestData(serviceClient);
    const { data: order } = await serviceClient
      .from('orders')
      .insert({ restaurant_id: fixture.restaurantId, table_id: fixture.tableId, status: 'COMPLETED' })
      .select()
      .single();

    const { error } = await serviceClient.rpc('update_order_status', {
      p_order_id: order!.id,
      p_new_status: 'CANCELLED',
    });

    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/Cannot cancel a completed order/);
  });

  it('allows PENDING -> CANCELLED', async () => {
    const fixture = await seedTestData(serviceClient);
    const orderId = await createPendingOrder(fixture.restaurantId, fixture.tableId);

    const { data, error } = await serviceClient.rpc('update_order_status', {
      p_order_id: orderId,
      p_new_status: 'CANCELLED',
    });

    expect(error).toBeNull();
    expect(data).toBe('CANCELLED');
  });
});

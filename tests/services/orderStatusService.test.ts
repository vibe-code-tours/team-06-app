import { resetDatabase } from '../helpers/resetDatabase';
import { seedTestData } from '../helpers/seedTestData';
import { createServiceClient } from '../helpers/supabaseTestClient';
import { updateOrderStatus } from '../../apps/web/lib/services/orderStatusService';

describe('updateOrderStatus service', () => {
  const serviceClient = createServiceClient();

  beforeEach(() => resetDatabase(serviceClient));

  it('advances a PENDING order to ACCEPTED', async () => {
    const fixture = await seedTestData(serviceClient);
    const { data: order } = await serviceClient
      .from('orders')
      .insert({ restaurant_id: fixture.restaurantId, table_id: fixture.tableId, status: 'PENDING' })
      .select()
      .single();

    const result = await updateOrderStatus(serviceClient, order!.id, 'ACCEPTED');

    expect(result).toEqual({ status: 'ACCEPTED' });
  });

  it('returns an error object for an invalid transition instead of throwing', async () => {
    const fixture = await seedTestData(serviceClient);
    const { data: order } = await serviceClient
      .from('orders')
      .insert({ restaurant_id: fixture.restaurantId, table_id: fixture.tableId, status: 'PENDING' })
      .select()
      .single();

    const result = await updateOrderStatus(serviceClient, order!.id, 'READY');

    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toMatch(/Invalid status transition/);
    }
  });
});

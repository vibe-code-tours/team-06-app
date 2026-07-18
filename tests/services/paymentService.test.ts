import { resetDatabase } from '../helpers/resetDatabase';
import { seedTestData } from '../helpers/seedTestData';
import { createServiceClient } from '../helpers/supabaseTestClient';
import { refundPayment } from '../../apps/web/lib/services/paymentService';

describe('paymentService', () => {
  const serviceClient = createServiceClient();

  beforeEach(() => resetDatabase(serviceClient));

  it('refunds a completed payment', async () => {
    const fixture = await seedTestData(serviceClient);
    const { data: orderId } = await serviceClient.rpc('create_order_with_session', {
      p_restaurant_id: fixture.restaurantId,
      p_table_id: fixture.tableId,
      p_items: [{ menu_item_id: fixture.menuItemId, quantity: 1 }],
    });
    // PENDING → ACCEPTED → PREPARING → READY
    await serviceClient.rpc('update_order_status', { p_order_id: orderId, p_new_status: 'ACCEPTED' });
    await serviceClient.rpc('update_order_status', { p_order_id: orderId, p_new_status: 'PREPARING' });
    await serviceClient.rpc('update_order_status', { p_order_id: orderId, p_new_status: 'READY' });

    const { data: paymentId } = await serviceClient.rpc('process_payment', {
      p_order_id: orderId,
      p_amount: 13.75,
      p_tax_amount: 1.25,
      p_discount_amount: 0,
      p_payment_method: 'CASH',
    });

    const result = await refundPayment(serviceClient, paymentId, 'wrong order delivered');

    expect(result).toEqual({ success: true });
  });
});

import { resetDatabase } from '../helpers/resetDatabase';
import { seedTestData } from '../helpers/seedTestData';
import { createServiceClient } from '../helpers/supabaseTestClient';

describe('refund_payment()', () => {
  const serviceClient = createServiceClient();

  beforeEach(() => resetDatabase(serviceClient));

  /** Helper: create order + transition to READY + process payment → returns paymentId */
  async function createReadyOrderAndGetPaymentId(fixture: Awaited<ReturnType<typeof seedTestData>>) {
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
    return paymentId as string;
  }

  it('marks a COMPLETED payment as REFUNDED and stores the reason', async () => {
    const fixture = await seedTestData(serviceClient);
    const paymentId = await createReadyOrderAndGetPaymentId(fixture);

    const { data: refundedId, error } = await serviceClient.rpc('refund_payment', {
      p_payment_id: paymentId,
      p_reason: 'Customer complaint about food quality',
    });

    expect(error).toBeNull();
    expect(refundedId).toBe(paymentId);

    const { data: payment } = await serviceClient
      .from('payments')
      .select('payment_status')
      .eq('id', paymentId)
      .single();
    expect(payment!.payment_status).toBe('REFUNDED');

    const { data: order } = await serviceClient
      .from('orders')
      .select('payment_status')
      .eq('id', paymentId)
      .single();
    expect(order!.payment_status).toBe('REFUNDED');
  });

  it('rejects refunding a payment that is not COMPLETED', async () => {
    const fixture = await seedTestData(serviceClient);
    const { data: order } = await serviceClient
      .from('orders')
      .insert({ restaurant_id: fixture.restaurantId, table_id: fixture.tableId })
      .select()
      .single();
    const { data: payment } = await serviceClient
      .from('payments')
      .insert({
        order_id: order!.id,
        restaurant_id: fixture.restaurantId,
        amount: 10,
        total_amount: 10,
        payment_method: 'CASH',
        payment_status: 'PENDING',
      })
      .select()
      .single();

    const { error } = await serviceClient.rpc('refund_payment', {
      p_payment_id: payment!.id,
      p_reason: 'test',
    });

    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/Cannot refund a payment that is not completed/);
  });

  it('rejects refunding an already-refunded payment', async () => {
    const fixture = await seedTestData(serviceClient);
    const paymentId = await createReadyOrderAndGetPaymentId(fixture);
    await serviceClient.rpc('refund_payment', { p_payment_id: paymentId, p_reason: 'first refund' });

    const { error } = await serviceClient.rpc('refund_payment', {
      p_payment_id: paymentId,
      p_reason: 'second attempt',
    });

    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/Payment has already been refunded/);
  });
});

import { resetDatabase } from '../helpers/resetDatabase';
import { seedTestData } from '../helpers/seedTestData';
import { createServiceClient } from '../helpers/supabaseTestClient';

describe('process_payment() and release_table()', () => {
  const serviceClient = createServiceClient();

  beforeEach(() => resetDatabase(serviceClient));

  /** Helper: create order + transition to READY → returns { orderId, fixture } */
  async function createReadyOrder(fixture: Awaited<ReturnType<typeof seedTestData>>) {
    const { data: orderId } = await serviceClient.rpc('create_order_with_session', {
      p_restaurant_id: fixture.restaurantId,
      p_table_id: fixture.tableId,
      p_items: [{ menu_item_id: fixture.menuItemId, quantity: 1 }],
    });
    // PENDING → ACCEPTED → PREPARING → READY
    await serviceClient.rpc('update_order_status', { p_order_id: orderId, p_new_status: 'ACCEPTED' });
    await serviceClient.rpc('update_order_status', { p_order_id: orderId, p_new_status: 'PREPARING' });
    await serviceClient.rpc('update_order_status', { p_order_id: orderId, p_new_status: 'READY' });
    return orderId as string;
  }

  it('process_payment marks order COMPLETED/PAID, closes session, frees table', async () => {
    const fixture = await seedTestData(serviceClient);
    const orderId = await createReadyOrder(fixture);

    const { data: paymentId, error } = await serviceClient.rpc('process_payment', {
      p_order_id: orderId,
      p_amount: 13.75,
      p_tax_amount: 1.25,
      p_discount_amount: 0,
      p_payment_method: 'CARD',
    });

    expect(error).toBeNull();
    expect(paymentId).toBeTruthy();

    const { data: order } = await serviceClient
      .from('orders')
      .select('status, payment_status')
      .eq('id', orderId)
      .single();
    expect(order!.status).toBe('COMPLETED');
    expect(order!.payment_status).toBe('PAID');

    const { data: table } = await serviceClient
      .from('tables')
      .select('status')
      .eq('id', fixture.tableId)
      .single();
    expect(table!.status).toBe('AVAILABLE');

    const { data: payment } = await serviceClient
      .from('payments')
      .select('total_amount')
      .eq('id', paymentId)
      .single();
    expect(Number(payment!.total_amount)).toBe(13.75);
  });

  it('process_payment rejects a second payment on an already-paid order', async () => {
    const fixture = await seedTestData(serviceClient);
    const orderId = await createReadyOrder(fixture);

    // First payment succeeds
    await serviceClient.rpc('process_payment', {
      p_order_id: orderId,
      p_amount: 13.75,
      p_tax_amount: 1.25,
      p_discount_amount: 0,
      p_payment_method: 'CASH',
    });

    // Second payment should fail
    const { error } = await serviceClient.rpc('process_payment', {
      p_order_id: orderId,
      p_amount: 13.75,
      p_tax_amount: 1.25,
      p_discount_amount: 0,
      p_payment_method: 'CASH',
    });

    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/already paid/);
  });

  it('release_table cancels unpaid orders and frees the table', async () => {
    const fixture = await seedTestData(serviceClient);
    const { data: orderId } = await serviceClient.rpc('create_order_with_session', {
      p_restaurant_id: fixture.restaurantId,
      p_table_id: fixture.tableId,
      p_items: [{ menu_item_id: fixture.menuItemId, quantity: 1 }],
    });

    const { error } = await serviceClient.rpc('release_table', {
      p_table_id: fixture.tableId,
    });
    expect(error).toBeNull();

    const { data: order } = await serviceClient
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .single();
    expect(order!.status).toBe('CANCELLED');

    const { data: table } = await serviceClient
      .from('tables')
      .select('status')
      .eq('id', fixture.tableId)
      .single();
    expect(table!.status).toBe('AVAILABLE');
  });
});

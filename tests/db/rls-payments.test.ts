import { resetDatabase } from '../helpers/resetDatabase';
import { seedTestData } from '../helpers/seedTestData';
import { createServiceClient, createRoleClient } from '../helpers/supabaseTestClient';

describe('payments RLS', () => {
  const serviceClient = createServiceClient();

  beforeEach(() => resetDatabase(serviceClient));

  it('a kitchen_staff cannot view payments (not in select policy role list)', async () => {
    const fixture = await seedTestData(serviceClient);
    const { data: order } = await serviceClient
      .from('orders')
      .insert({ restaurant_id: fixture.restaurantId, table_id: fixture.tableId })
      .select()
      .single();
    await serviceClient.from('payments').insert({
      order_id: order!.id,
      restaurant_id: fixture.restaurantId,
      amount: 10,
      total_amount: 10,
      payment_method: 'CASH',
    });

    const kitchen = await createRoleClient(
      fixture.profiles.kitchen_staff.email,
      fixture.profiles.kitchen_staff.password
    );
    const { data, error } = await kitchen.from('payments').select('id');

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('a cashier can insert a payment', async () => {
    const fixture = await seedTestData(serviceClient);
    const { data: order } = await serviceClient
      .from('orders')
      .insert({ restaurant_id: fixture.restaurantId, table_id: fixture.tableId })
      .select()
      .single();

    const cashier = await createRoleClient(
      fixture.profiles.cashier.email,
      fixture.profiles.cashier.password
    );
    const { error } = await cashier.from('payments').insert({
      order_id: order!.id,
      restaurant_id: fixture.restaurantId,
      amount: 10,
      total_amount: 10,
      payment_method: 'CASH',
    });

    expect(error).toBeNull();
  });
});

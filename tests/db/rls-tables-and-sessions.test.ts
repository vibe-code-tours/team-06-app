import { resetDatabase } from '../helpers/resetDatabase';
import { seedTestData } from '../helpers/seedTestData';
import { createServiceClient, createRoleClient } from '../helpers/supabaseTestClient';

describe('tables and order_sessions RLS', () => {
  const serviceClient = createServiceClient();

  beforeEach(() => resetDatabase(serviceClient));

  it('a waiter can update table status', async () => {
    const fixture = await seedTestData(serviceClient);
    const waiter = await createRoleClient(
      fixture.profiles.waiter.email,
      fixture.profiles.waiter.password
    );

    const { data, error } = await waiter
      .from('tables')
      .update({ status: 'CLEANING' })
      .eq('id', fixture.tableId)
      .select();

    expect(error).toBeNull();
    expect(data![0].status).toBe('CLEANING');
  });

  it('a kitchen_staff cannot update table status (not in tables_update_waiter or manager policy)', async () => {
    const fixture = await seedTestData(serviceClient);
    const kitchen = await createRoleClient(
      fixture.profiles.kitchen_staff.email,
      fixture.profiles.kitchen_staff.password
    );

    const { data, error } = await kitchen
      .from('tables')
      .update({ status: 'CLEANING' })
      .eq('id', fixture.tableId)
      .select();

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('restaurant staff can view sessions in their restaurant', async () => {
    const fixture = await seedTestData(serviceClient);
    await serviceClient.from('order_sessions').insert({
      restaurant_id: fixture.restaurantId,
      table_id: fixture.tableId,
      status: 'ACTIVE',
    });

    const cashier = await createRoleClient(
      fixture.profiles.cashier.email,
      fixture.profiles.cashier.password
    );
    const { data, error } = await cashier
      .from('order_sessions')
      .select('id')
      .eq('restaurant_id', fixture.restaurantId);

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
  });
});

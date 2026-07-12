import { resetDatabase } from '../helpers/resetDatabase';
import { seedTestData } from '../helpers/seedTestData';
import { createServiceClient, createRoleClient } from '../helpers/supabaseTestClient';

describe('orders and order_items RLS', () => {
  const serviceClient = createServiceClient();

  beforeEach(() => resetDatabase(serviceClient));

  it('a waiter can update order status — RLS is intentionally permissive here; business-rule enforcement belongs to the API layer', async () => {
    const fixture = await seedTestData(serviceClient);
    const { data: order } = await serviceClient
      .from('orders')
      .insert({
        restaurant_id: fixture.restaurantId,
        table_id: fixture.tableId,
        status: 'PENDING',
      })
      .select()
      .single();

    const waiter = await createRoleClient(
      fixture.profiles.waiter.email,
      fixture.profiles.waiter.password
    );
    const { error } = await waiter
      .from('orders')
      .update({ status: 'ACCEPTED' })
      .eq('id', order!.id);

    // RLS policy orders_update_waiter allows this at the DB row-security level.
    // Business-rule enforcement (only kitchen should transition status) belongs
    // to the API layer per CLAUDE.md's three-layer permission model — this test
    // documents that RLS alone is intentionally permissive here.
    expect(error).toBeNull();
  });

  it('a cashier cannot view order_items for another restaurant', async () => {
    const fixtureA = await seedTestData(serviceClient);
    const fixtureB = await seedTestData(serviceClient);

    const { data: orderB } = await serviceClient
      .from('orders')
      .insert({ restaurant_id: fixtureB.restaurantId, table_id: fixtureB.tableId })
      .select()
      .single();
    const { data: itemB } = await serviceClient
      .from('order_items')
      .insert({
        order_id: orderB!.id,
        menu_item_id: fixtureB.menuItemId,
        quantity: 1,
        unit_price: 10,
      })
      .select()
      .single();

    const cashierA = await createRoleClient(
      fixtureA.profiles.cashier.email,
      fixtureA.profiles.cashier.password
    );
    const { data } = await cashierA.from('order_items').select('id').eq('id', itemB!.id);

    expect(data).toEqual([]);
  });
});

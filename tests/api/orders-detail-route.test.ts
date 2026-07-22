import { resetDatabase } from '../helpers/resetDatabase';
import { seedTestData } from '../helpers/seedTestData';
import {
  createServiceClient,
  createRoleClient,
} from '../helpers/supabaseTestClient';

const BASE_URL = process.env.TEST_APP_URL ?? 'http://localhost:3000';

function getSupabaseCookieName(): string {
  const url = new URL(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
  );
  return `sb-${url.hostname.split('.')[0]}-auth-token`;
}

async function buildAuthCookie(
  client: Awaited<ReturnType<typeof createRoleClient>>
): Promise<string> {
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session) throw new Error('No session after sign-in');

  const value = JSON.stringify(session);
  const base64 = Buffer.from(value).toString('base64url');
  return `${getSupabaseCookieName()}=base64-${base64}`;
}

describe('GET /api/orders/[orderId]', () => {
  const serviceClient = createServiceClient();

  beforeEach(() => resetDatabase(serviceClient));

  it('rejects an unauthenticated request with 401', async () => {
    const fixture = await seedTestData(serviceClient);
    const { data: orderId } = await serviceClient.rpc('create_order_with_session', {
      p_restaurant_id: fixture.restaurantId,
      p_table_id: fixture.tableId,
      p_items: [{ menu_item_id: fixture.menuItemId, quantity: 2 }],
    });

    const response = await fetch(`${BASE_URL}/api/orders/${orderId}`, {
      redirect: 'manual',
    });

    expect(response.status).toBe(401);
  });

  it('allows a manager to view order detail with item names and instructions', async () => {
    const fixture = await seedTestData(serviceClient);
    const { data: orderId } = await serviceClient.rpc('create_order_with_session', {
      p_restaurant_id: fixture.restaurantId,
      p_table_id: fixture.tableId,
      p_items: [
        {
          menu_item_id: fixture.menuItemId,
          quantity: 2,
          special_instructions: 'no onions',
        },
      ],
    });

    const managerClient = await createRoleClient(
      fixture.profiles.manager.email,
      fixture.profiles.manager.password
    );
    const cookie = await buildAuthCookie(managerClient);

    const response = await fetch(`${BASE_URL}/api/orders/${orderId}`, {
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: {
        id: string;
        order_items: { menu_item: { name: string }; special_instructions: string | null }[];
      };
    };
    expect(body.data.id).toBe(orderId);
    expect(body.data.order_items).toHaveLength(1);
    expect(body.data.order_items[0].menu_item.name).toBeTruthy();
    expect(body.data.order_items[0].special_instructions).toBe('no onions');
  });

  it('allows a waiter, kitchen_staff, and cashier to view order detail', async () => {
    const fixture = await seedTestData(serviceClient);
    const { data: orderId } = await serviceClient.rpc('create_order_with_session', {
      p_restaurant_id: fixture.restaurantId,
      p_table_id: fixture.tableId,
      p_items: [{ menu_item_id: fixture.menuItemId, quantity: 1 }],
    });

    for (const role of ['waiter', 'kitchen_staff', 'cashier'] as const) {
      const client = await createRoleClient(
        fixture.profiles[role].email,
        fixture.profiles[role].password
      );
      const cookie = await buildAuthCookie(client);

      const response = await fetch(`${BASE_URL}/api/orders/${orderId}`, {
        headers: { Cookie: cookie },
      });

      expect(response.status).toBe(200);
    }
  });

  // getOrderDetail() enforces restaurant scoping in the service itself as
  // defense-in-depth (not relying solely on RLS): orders_select_public_own_session
  // has no auth.uid() check and currently permits cross-restaurant reads at the
  // DB layer (tracked separately as issue #60). This test verifies the app-layer
  // check specifically, independent of whichever way #60 gets fixed.
  it('returns 404 for an order in a different restaurant (app-layer scoped)', async () => {
    const fixtureA = await seedTestData(serviceClient);

    const { data: restaurantB } = await serviceClient
      .from('restaurants')
      .insert({ name: 'Other Restaurant', tax_rate: 0 })
      .select()
      .single();
    const { data: tableB } = await serviceClient
      .from('tables')
      .insert({ restaurant_id: restaurantB!.id, table_number: 1, capacity: 4 })
      .select()
      .single();
    const { data: categoryB } = await serviceClient
      .from('categories')
      .insert({ restaurant_id: restaurantB!.id, name: 'Cat B', sort_order: 0 })
      .select()
      .single();
    const { data: menuItemB } = await serviceClient
      .from('menu_items')
      .insert({
        restaurant_id: restaurantB!.id,
        category_id: categoryB!.id,
        name: 'Item B',
        price: 5,
      })
      .select()
      .single();
    const { data: orderIdB } = await serviceClient.rpc('create_order_with_session', {
      p_restaurant_id: restaurantB!.id,
      p_table_id: tableB!.id,
      p_items: [{ menu_item_id: menuItemB!.id, quantity: 1 }],
    });

    const managerAClient = await createRoleClient(
      fixtureA.profiles.manager.email,
      fixtureA.profiles.manager.password
    );
    const cookie = await buildAuthCookie(managerAClient);

    const response = await fetch(`${BASE_URL}/api/orders/${orderIdB}`, {
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(404);
  });

  it('allows super_admin to view an order in any restaurant', async () => {
    const fixture = await seedTestData(serviceClient);
    const { data: orderId } = await serviceClient.rpc('create_order_with_session', {
      p_restaurant_id: fixture.restaurantId,
      p_table_id: fixture.tableId,
      p_items: [{ menu_item_id: fixture.menuItemId, quantity: 1 }],
    });

    const superAdminClient = await createRoleClient(
      fixture.profiles.super_admin.email,
      fixture.profiles.super_admin.password
    );
    const cookie = await buildAuthCookie(superAdminClient);

    const response = await fetch(`${BASE_URL}/api/orders/${orderId}`, {
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(200);
  });

  it('returns 404 for a nonexistent order', async () => {
    const fixture = await seedTestData(serviceClient);
    const managerClient = await createRoleClient(
      fixture.profiles.manager.email,
      fixture.profiles.manager.password
    );
    const cookie = await buildAuthCookie(managerClient);

    const response = await fetch(
      `${BASE_URL}/api/orders/00000000-0000-0000-0000-000000000000`,
      { headers: { Cookie: cookie } }
    );

    expect(response.status).toBe(404);
  });
});

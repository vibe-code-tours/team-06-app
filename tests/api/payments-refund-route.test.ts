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

describe('POST /api/payments/[paymentId]/refund', () => {
  const serviceClient = createServiceClient();

  beforeEach(() => resetDatabase(serviceClient));

  it('rejects an unauthenticated request with 307', async () => {
    const fixture = await seedTestData(serviceClient);
    const { data: orderId } = await serviceClient.rpc('create_order_with_session', {
      p_restaurant_id: fixture.restaurantId,
      p_table_id: fixture.tableId,
      p_items: [{ menu_item_id: fixture.menuItemId, quantity: 1 }],
    });
    const { data: paymentId } = await serviceClient.rpc('process_payment', {
      p_order_id: orderId,
      p_amount: 12.5,
      p_payment_method: 'CASH',
    });

    const response = await fetch(`${BASE_URL}/api/payments/${paymentId}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'test' }),
      redirect: 'manual',
    });

    expect(response.status).toBe(307);
  });

  it('rejects a kitchen_staff with 403', async () => {
    const fixture = await seedTestData(serviceClient);
    const { data: orderId } = await serviceClient.rpc('create_order_with_session', {
      p_restaurant_id: fixture.restaurantId,
      p_table_id: fixture.tableId,
      p_items: [{ menu_item_id: fixture.menuItemId, quantity: 1 }],
    });
    const { data: paymentId } = await serviceClient.rpc('process_payment', {
      p_order_id: orderId,
      p_amount: 12.5,
      p_payment_method: 'CASH',
    });

    const kitchenClient = await createRoleClient(
      fixture.profiles.kitchen_staff.email,
      fixture.profiles.kitchen_staff.password
    );
    const cookie = await buildAuthCookie(kitchenClient);

    const response = await fetch(`${BASE_URL}/api/payments/${paymentId}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      body: JSON.stringify({ reason: 'test' }),
      redirect: 'manual',
    });

    expect(response.status).toBe(403);
  });

  it('allows a cashier to refund a completed payment', async () => {
    const fixture = await seedTestData(serviceClient);
    const { data: orderId } = await serviceClient.rpc('create_order_with_session', {
      p_restaurant_id: fixture.restaurantId,
      p_table_id: fixture.tableId,
      p_items: [{ menu_item_id: fixture.menuItemId, quantity: 1 }],
    });
    const { data: paymentId } = await serviceClient.rpc('process_payment', {
      p_order_id: orderId,
      p_amount: 12.5,
      p_payment_method: 'CASH',
    });

    const cashierClient = await createRoleClient(
      fixture.profiles.cashier.email,
      fixture.profiles.cashier.password
    );
    const cookie = await buildAuthCookie(cashierClient);

    const response = await fetch(`${BASE_URL}/api/payments/${paymentId}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      body: JSON.stringify({ reason: 'goodwill refund' }),
      redirect: 'manual',
    });

    expect(response.status).toBe(200);
  });

  it('returns 400 when reason is missing', async () => {
    const fixture = await seedTestData(serviceClient);
    const { data: orderId } = await serviceClient.rpc('create_order_with_session', {
      p_restaurant_id: fixture.restaurantId,
      p_table_id: fixture.tableId,
      p_items: [{ menu_item_id: fixture.menuItemId, quantity: 1 }],
    });
    const { data: paymentId } = await serviceClient.rpc('process_payment', {
      p_order_id: orderId,
      p_amount: 12.5,
      p_payment_method: 'CASH',
    });

    const managerClient = await createRoleClient(
      fixture.profiles.manager.email,
      fixture.profiles.manager.password
    );
    const cookie = await buildAuthCookie(managerClient);

    const response = await fetch(`${BASE_URL}/api/payments/${paymentId}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      body: JSON.stringify({}),
      redirect: 'manual',
    });

    expect(response.status).toBe(400);
  });

  it('allows a manager to refund a completed payment', async () => {
    const fixture = await seedTestData(serviceClient);
    const { data: orderId } = await serviceClient.rpc('create_order_with_session', {
      p_restaurant_id: fixture.restaurantId,
      p_table_id: fixture.tableId,
      p_items: [{ menu_item_id: fixture.menuItemId, quantity: 1 }],
    });
    const { data: paymentId } = await serviceClient.rpc('process_payment', {
      p_order_id: orderId,
      p_amount: 12.5,
      p_payment_method: 'CASH',
    });

    const managerClient = await createRoleClient(
      fixture.profiles.manager.email,
      fixture.profiles.manager.password
    );
    const cookie = await buildAuthCookie(managerClient);

    const response = await fetch(`${BASE_URL}/api/payments/${paymentId}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      body: JSON.stringify({ reason: 'goodwill refund' }),
      redirect: 'manual',
    });

    expect(response.status).toBe(200);
  });
});

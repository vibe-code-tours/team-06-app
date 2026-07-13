import { resetDatabase } from '../helpers/resetDatabase';
import { seedTestData } from '../helpers/seedTestData';
import { createServiceClient, createRoleClient } from '../helpers/supabaseTestClient';

const BASE_URL = process.env.TEST_APP_URL ?? 'http://localhost:3000';

/**
 * Derive the Supabase auth cookie name from the project URL.
 */
function getSupabaseCookieName(): string {
  const url = new URL(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
  );
  return `sb-${url.hostname.split('.')[0]}-auth-token`;
}

/**
 * Build a Cookie header string from an authenticated Supabase client.
 */
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

describe('GET /api/tables/[tableId]/qr', () => {
  const serviceClient = createServiceClient();

  beforeEach(() => resetDatabase(serviceClient));

  it('returns a data URL for a valid table', async () => {
    const fixture = await seedTestData(serviceClient);
    const waiterClient = await createRoleClient(
      fixture.profiles.waiter.email,
      fixture.profiles.waiter.password
    );

    const cookie = await buildAuthCookie(waiterClient);

    const response = await fetch(`${BASE_URL}/api/tables/${fixture.tableId}/qr`, {
      headers: {
        Cookie: cookie,
      },
      redirect: 'manual',
    });
    const body = await response.json() as { data: { dataUrl: string } };

    expect(response.status).toBe(200);
    expect(body.data.dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('returns 404 for a nonexistent table', async () => {
    const fixture = await seedTestData(serviceClient);
    const waiterClient = await createRoleClient(
      fixture.profiles.waiter.email,
      fixture.profiles.waiter.password
    );

    const cookie = await buildAuthCookie(waiterClient);

    const response = await fetch(
      `${BASE_URL}/api/tables/00000000-0000-0000-0000-000000000000/qr`,
      {
        headers: {
          Cookie: cookie,
        },
        redirect: 'manual',
      }
    );

    expect(response.status).toBe(404);
  });
});

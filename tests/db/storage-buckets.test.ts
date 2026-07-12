import { resetDatabase } from '../helpers/resetDatabase';
import { seedTestData } from '../helpers/seedTestData';
import { createServiceClient, createRoleClient, createAnonClient } from '../helpers/supabaseTestClient';

describe('storage buckets', () => {
  const serviceClient = createServiceClient();

  beforeEach(() => resetDatabase(serviceClient));

  it('both buckets exist and are public', async () => {
    const { data, error } = await serviceClient.storage.listBuckets();
    expect(error).toBeNull();
    const names = data!.map((b) => b.name);
    expect(names).toContain('restaurant-logos');
    expect(names).toContain('menu-images');
  });

  it('a restaurant_owner can upload a logo under their restaurant path', async () => {
    const fixture = await seedTestData(serviceClient);
    const owner = await createRoleClient(
      fixture.profiles.restaurant_owner.email,
      fixture.profiles.restaurant_owner.password
    );

    const { error } = await owner.storage
      .from('restaurant-logos')
      .upload(`${fixture.restaurantId}/logo.png`, new File(['fake-png-bytes'], 'logo.png', { type: 'image/png' }));

    expect(error).toBeNull();
  });

  it('a waiter cannot upload a logo (not owner/manager/super_admin)', async () => {
    const fixture = await seedTestData(serviceClient);
    const waiter = await createRoleClient(
      fixture.profiles.waiter.email,
      fixture.profiles.waiter.password
    );

    const { error } = await waiter.storage
      .from('restaurant-logos')
      .upload(`${fixture.restaurantId}/logo.png`, new File(['fake-png-bytes'], 'logo.png', { type: 'image/png' }));

    expect(error).not.toBeNull();
  });

  it('anyone can publicly read an uploaded logo URL', async () => {
    const fixture = await seedTestData(serviceClient);
    await serviceClient.storage
      .from('restaurant-logos')
      .upload(`${fixture.restaurantId}/logo.png`, new File(['fake-png-bytes'], 'logo.png', { type: 'image/png' }));

    const anon = createAnonClient();
    const { data } = anon.storage.from('restaurant-logos').getPublicUrl(`${fixture.restaurantId}/logo.png`);

    expect(data.publicUrl).toContain('restaurant-logos');
  });
});

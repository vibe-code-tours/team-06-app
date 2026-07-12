import { resetDatabase } from '../helpers/resetDatabase';
import { seedTestData } from '../helpers/seedTestData';
import { createServiceClient, createRoleClient, createAnonClient } from '../helpers/supabaseTestClient';

describe('restaurants RLS', () => {
  const serviceClient = createServiceClient();

  beforeEach(() => resetDatabase(serviceClient));

  it('anonymous customers can read active restaurants only', async () => {
    const fixture = await seedTestData(serviceClient);
    await serviceClient
      .from('restaurants')
      .update({ is_active: false })
      .eq('id', fixture.restaurantId);

    const anon = createAnonClient();
    const { data } = await anon.from('restaurants').select('id').eq('id', fixture.restaurantId);

    expect(data).toEqual([]);
  });

  it('a manager cannot update their restaurant (owner-only)', async () => {
    const fixture = await seedTestData(serviceClient);
    const manager = await createRoleClient(
      fixture.profiles.manager.email,
      fixture.profiles.manager.password
    );

    const { data, error } = await manager
      .from('restaurants')
      .update({ name: 'Hacked Name' })
      .eq('id', fixture.restaurantId)
      .select();

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('the restaurant_owner can update their own restaurant', async () => {
    const fixture = await seedTestData(serviceClient);
    const owner = await createRoleClient(
      fixture.profiles.restaurant_owner.email,
      fixture.profiles.restaurant_owner.password
    );

    const { data, error } = await owner
      .from('restaurants')
      .update({ name: 'New Name' })
      .eq('id', fixture.restaurantId)
      .select();

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].name).toBe('New Name');
  });
});

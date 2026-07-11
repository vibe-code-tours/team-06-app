import { resetDatabase } from '../helpers/resetDatabase';
import { seedTestData } from '../helpers/seedTestData';
import { createServiceClient, createRoleClient } from '../helpers/supabaseTestClient';

describe('profiles RLS', () => {
  const serviceClient = createServiceClient();

  beforeEach(() => resetDatabase(serviceClient));

  it('a waiter cannot read other restaurants staff profiles', async () => {
    const fixtureA = await seedTestData(serviceClient);
    const fixtureB = await seedTestData(serviceClient);

    const waiterA = await createRoleClient(
      fixtureA.profiles.waiter.email,
      fixtureA.profiles.waiter.password
    );

    const { data, error } = await waiterA
      .from('profiles')
      .select('id')
      .eq('id', fixtureB.profiles.waiter.userId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('a super_admin can read profiles across restaurants', async () => {
    const fixtureA = await seedTestData(serviceClient);
    const fixtureB = await seedTestData(serviceClient);

    const superAdmin = await createRoleClient(
      fixtureA.profiles.super_admin.email,
      fixtureA.profiles.super_admin.password
    );

    const { data, error } = await superAdmin
      .from('profiles')
      .select('id')
      .in('id', [fixtureA.profiles.waiter.userId, fixtureB.profiles.waiter.userId]);

    expect(error).toBeNull();
    expect(data).toHaveLength(2);
  });

  it('a kitchen_staff cannot insert a new profile', async () => {
    const fixture = await seedTestData(serviceClient);
    const kitchenClient = await createRoleClient(
      fixture.profiles.kitchen_staff.email,
      fixture.profiles.kitchen_staff.password
    );

    const { error } = await kitchenClient.from('profiles').insert({
      id: '11111111-1111-1111-1111-111111111111',
      email: 'nope@test.local',
      role: 'waiter',
      restaurant_id: fixture.restaurantId,
    });

    expect(error).not.toBeNull();
  });
});

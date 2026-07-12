import { resetDatabase } from '../helpers/resetDatabase';
import { seedTestData } from '../helpers/seedTestData';
import { createServiceClient, createRoleClient, createAnonClient } from '../helpers/supabaseTestClient';

describe('menu (categories, menu_items) RLS', () => {
  const serviceClient = createServiceClient();

  beforeEach(() => resetDatabase(serviceClient));

  it('anonymous customers see only available items in active restaurants', async () => {
    const fixture = await seedTestData(serviceClient);
    await serviceClient
      .from('menu_items')
      .update({ is_available: false })
      .eq('id', fixture.menuItemId);

    const anon = createAnonClient();
    const { data } = await anon.from('menu_items').select('id').eq('id', fixture.menuItemId);

    expect(data).toEqual([]);
  });

  it('kitchen_staff can see unavailable items (internal view)', async () => {
    const fixture = await seedTestData(serviceClient);
    await serviceClient
      .from('menu_items')
      .update({ is_available: false })
      .eq('id', fixture.menuItemId);

    const kitchen = await createRoleClient(
      fixture.profiles.kitchen_staff.email,
      fixture.profiles.kitchen_staff.password
    );
    const { data } = await kitchen.from('menu_items').select('id').eq('id', fixture.menuItemId);

    expect(data).toHaveLength(1);
  });

  it('kitchen_staff cannot create a menu item (owner/manager only)', async () => {
    const fixture = await seedTestData(serviceClient);
    const kitchen = await createRoleClient(
      fixture.profiles.kitchen_staff.email,
      fixture.profiles.kitchen_staff.password
    );

    const { error } = await kitchen.from('menu_items').insert({
      restaurant_id: fixture.restaurantId,
      category_id: fixture.categoryId,
      name: 'Unauthorized Item',
      price: 5,
    });

    expect(error).not.toBeNull();
  });
});

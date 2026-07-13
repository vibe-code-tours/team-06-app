import { resetDatabase } from '../helpers/resetDatabase';
import { seedTestData } from '../helpers/seedTestData';
import { createServiceClient } from '../helpers/supabaseTestClient';
import { releaseTable, getTableQrDataUrl } from '../../apps/web/lib/services/tableService';

describe('tableService', () => {
  const serviceClient = createServiceClient();

  beforeEach(() => resetDatabase(serviceClient));

  it('releaseTable cancels unpaid orders and frees the table', async () => {
    const fixture = await seedTestData(serviceClient);
    await serviceClient.rpc('create_order_with_session', {
      p_restaurant_id: fixture.restaurantId,
      p_table_id: fixture.tableId,
      p_items: [{ menu_item_id: fixture.menuItemId, quantity: 1 }],
    });

    const result = await releaseTable(serviceClient, fixture.tableId);

    expect(result).toEqual({ success: true });

    const { data: table } = await serviceClient
      .from('tables')
      .select('status')
      .eq('id', fixture.tableId)
      .single();
    expect(table!.status).toBe('AVAILABLE');
  });

  it('releaseTable returns an error when no active session exists', async () => {
    const fixture = await seedTestData(serviceClient);

    const result = await releaseTable(serviceClient, fixture.tableId);

    expect('error' in result).toBe(true);
  });

  it('getTableQrDataUrl returns a base64 PNG data URL', async () => {
    const fixture = await seedTestData(serviceClient);

    const result = await getTableQrDataUrl(serviceClient, fixture.tableId, 'https://example.app');

    expect('dataUrl' in result).toBe(true);
    if ('dataUrl' in result) {
      expect(result.dataUrl).toMatch(/^data:image\/png;base64,/);
    }
  });

  it('getTableQrDataUrl returns an error for a nonexistent table', async () => {
    const result = await getTableQrDataUrl(
      serviceClient,
      '00000000-0000-0000-0000-000000000000',
      'https://example.app'
    );

    expect('error' in result).toBe(true);
  });
});

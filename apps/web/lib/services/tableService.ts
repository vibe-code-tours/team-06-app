import type { SupabaseClient } from '@supabase/supabase-js';
import { generateTableQrDataUrl } from '@restaurant-qr/shared';

export type ReleaseTableResult = { success: true } | { error: string };
export type GetTableQrResult = { dataUrl: string } | { error: string };

export async function releaseTable(
  client: SupabaseClient,
  tableId: string
): Promise<ReleaseTableResult> {
  const { error } = await client.rpc('release_table', { p_table_id: tableId });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function getTableQrDataUrl(
  client: SupabaseClient,
  tableId: string,
  baseUrl: string
): Promise<GetTableQrResult> {
  const { data: table, error } = await client
    .from('tables')
    .select('restaurant_id, table_number')
    .eq('id', tableId)
    .single();

  if (error || !table) {
    return { error: error?.message ?? 'Table not found' };
  }

  const dataUrl = await generateTableQrDataUrl(table.restaurant_id, table.table_number, baseUrl);
  return { dataUrl };
}

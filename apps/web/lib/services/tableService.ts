import type { SupabaseClient } from '@supabase/supabase-js';
import { generateTableQrDataUrl, type TableInput } from '@restaurant-qr/shared';

export type ReleaseTableResult = { success: true } | { error: string };
export type GetTableQrResult = { dataUrl: string } | { error: string };
export type CreateTableResult = { id: string; qrDataUrl: string } | { error: string };
export type DeleteTableResult = { success: true } | { error: string };

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

// ============================================================================
// TABLE CRUD (Owner Features — Piece 3)
// ============================================================================

export async function createTable(
  client: SupabaseClient,
  restaurantId: string,
  input: TableInput,
  baseUrl: string
): Promise<CreateTableResult> {
  // 1. Insert row (DB trigger sets placeholder qr_code)
  const { data: table, error: insertError } = await client
    .from('tables')
    .insert({
      restaurant_id: restaurantId,
      table_number: input.table_number,
      name: input.name ?? null,
      capacity: input.capacity ?? 4,
      is_active: input.is_active ?? true,
    })
    .select('id, table_number')
    .single();

  if (insertError) {
    return { error: insertError.message };
  }

  // 2. Generate real QR data URL
  const qrDataUrl = await generateTableQrDataUrl(restaurantId, table.table_number, baseUrl);

  // 3. Update row with real QR code
  const { error: updateError } = await client
    .from('tables')
    .update({ qr_code: qrDataUrl })
    .eq('id', table.id);

  if (updateError) {
    return { error: updateError.message };
  }

  return { id: table.id, qrDataUrl };
}

export async function deleteTable(
  client: SupabaseClient,
  tableId: string
): Promise<DeleteTableResult> {
  const { error } = await client
    .from('tables')
    .delete()
    .eq('id', tableId);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

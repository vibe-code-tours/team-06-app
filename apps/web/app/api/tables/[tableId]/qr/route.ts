import { ok, err } from '@restaurant-qr/shared/http/apiResponse';
import { createClient } from '@/lib/supabase/server';
import { getTableQrDataUrl } from '@/lib/services/tableService';

export async function GET(
  request: Request,
  { params }: { params: { tableId: string } }
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err('UNAUTHORIZED', 'Unauthorized', 401);
  }

  const baseUrl = new URL(request.url).origin;
  const result = await getTableQrDataUrl(supabase, params.tableId, baseUrl);

  if ('error' in result) {
    return err('NOT_FOUND', result.error, 404);
  }

  return ok(result, 200);
}

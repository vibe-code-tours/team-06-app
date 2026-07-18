import { ok, err } from '@restaurant-qr/shared/http/apiResponse';
import { createClient } from '@/lib/supabase/server';
import { releaseTable } from '@/lib/services/tableService';

const ALLOWED_ROLES = ['waiter', 'manager', 'restaurant_owner', 'super_admin'];

export async function POST(
  _request: Request,
  { params }: { params: { tableId: string } }
) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err('UNAUTHORIZED', 'Unauthorized', 401);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, restaurant_id')
    .eq('id', user.id)
    .single();

  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return err('FORBIDDEN', 'Forbidden', 403);
  }

  // Restaurant-membership check: ensure the table belongs to the user's restaurant.
  // super_admin (restaurant_id = null) bypasses this check.
  if (profile.restaurant_id !== null) {
    const { data: table } = await supabase
      .from('tables')
      .select('restaurant_id')
      .eq('id', params.tableId)
      .single();

    if (!table) {
      return err('NOT_FOUND', 'Not found', 404);
    }

    if (table.restaurant_id !== profile.restaurant_id) {
      return err('FORBIDDEN', 'Forbidden', 403);
    }
  }

  const result = await releaseTable(supabase, params.tableId);

  if ('error' in result) {
    return err('CONFLICT', result.error, 422);
  }

  return ok(result, 200);
}

import type { SupabaseClient } from '@supabase/supabase-js';

export type RefundPaymentResult = { success: true } | { error: string };

export async function refundPayment(
  client: SupabaseClient,
  paymentId: string,
  reason: string
): Promise<RefundPaymentResult> {
  const { error } = await client.rpc('refund_payment', {
    p_payment_id: paymentId,
    p_reason: reason,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProcessPaymentInput } from '@restaurant-qr/shared';

export type ProcessPaymentResult = { paymentId: string } | { error: string };
export type RefundPaymentResult = { success: true } | { error: string };

export async function processPayment(
  client: SupabaseClient,
  data: ProcessPaymentInput
): Promise<ProcessPaymentResult> {
  const { data: paymentId, error } = await client.rpc('process_payment', {
    p_order_id: data.order_id,
    p_amount: data.amount,
    p_tax_amount: data.tax_amount ?? 0,
    p_discount_amount: data.discount_amount ?? 0,
    p_payment_method: data.payment_method ?? 'CASH',
    p_transaction_id: data.transaction_id ?? null,
    p_notes: data.notes ?? null,
  });

  if (error) {
    return { error: error.message };
  }

  return { paymentId };
}

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

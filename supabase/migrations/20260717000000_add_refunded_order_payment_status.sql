-- =============================================================================
-- Migration: Add REFUNDED to order_payment_status enum
-- =============================================================================
-- Previously refund_payment() set orders.payment_status back to 'UNPAID' since
-- that was the only non-PAID value available. This made a refunded order
-- indistinguishable from one nobody ever paid, so it reappeared in cashier/
-- staff "awaiting payment" views as if it needed a first payment.
--
-- ALTER TYPE ... ADD VALUE cannot run in the same transaction as statements
-- that use the new value, so this is a standalone migration; the follow-up
-- migration updates refund_payment() to use it.

ALTER TYPE public.order_payment_status ADD VALUE 'REFUNDED';

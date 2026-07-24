-- =============================================================================
-- Migration: Enable Realtime for invites table
-- =============================================================================
-- The StaffManagementTab uses a Realtime subscription to react instantly
-- when an invite status changes (pending → pending_approval → accepted).
-- Without this publication, the subscription silently does nothing.

ALTER PUBLICATION supabase_realtime ADD TABLE public.invites;

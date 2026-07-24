-- =============================================================================
-- Migration: Add pending_approval status to invites table
-- =============================================================================
-- Adds columns for user-submitted data and a new status for the approval gate.
-- Owner Approval Gate flow:
--   pending → pending_approval (user accepted, waiting for owner) → accepted

-- 1. Add new columns to invites table
ALTER TABLE public.invites
    ADD COLUMN full_name TEXT,
    ADD COLUMN phone TEXT,
    ADD COLUMN submitted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.invites.full_name IS 'Full name submitted by the invited user during accept flow';
COMMENT ON COLUMN public.invites.phone IS 'Phone number submitted by the invited user during accept flow';
COMMENT ON COLUMN public.invites.submitted_at IS 'Timestamp when the user submitted their accept form';

-- 2. Update CHECK constraint to allow pending_approval status
ALTER TABLE public.invites
    DROP CONSTRAINT IF EXISTS invites_status_check;

ALTER TABLE public.invites
    ADD CONSTRAINT invites_status_check
        CHECK (status IN ('pending', 'pending_approval', 'accepted', 'rejected', 'expired'));

-- 3. RLS policy: invited user can UPDATE their own invite (set status to pending_approval)
--    The invited user matches by email address.
--    They may only update when status is 'pending' (not already approved/rejected).
--    They may only set status to 'pending_approval' — cannot self-approve to 'accepted'.
CREATE POLICY "Invited user can update their own pending invite"
    ON public.invites
    FOR UPDATE
    USING (
        status = 'pending'
        AND email = auth.email()
    )
    WITH CHECK (
        status = 'pending_approval'
        AND email = auth.email()
    );

-- Note: the service_role RLS policy already exists (bypass_id) for admin operations.
-- Owner/manager RLS policies for SELECT already cover viewing pending_approval invites.

-- 4. Grant permissions
GRANT UPDATE ON public.invites TO authenticated;

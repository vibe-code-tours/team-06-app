-- =============================================================================
-- Migration: Create invites table for staff invite tracking
-- =============================================================================

-- Create invites table
CREATE TABLE public.invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    role public.user_role NOT NULL,
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    invited_by UUID REFERENCES public.profiles(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add comments
COMMENT ON TABLE public.invites IS 'Tracks staff invitations sent by restaurant owners.';
COMMENT ON COLUMN public.invites.email IS 'Email address of the invited person.';
COMMENT ON COLUMN public.invites.role IS 'Role assigned to the invited staff member.';
COMMENT ON COLUMN public.invites.restaurant_id IS 'FK to restaurants. The restaurant the staff is invited to.';
COMMENT ON COLUMN public.invites.invited_by IS 'FK to profiles. The owner/manager who sent the invite.';
COMMENT ON COLUMN public.invites.status IS 'Invite status: pending, accepted, rejected, expired.';

-- Indexes for performance
CREATE INDEX idx_invites_restaurant_status ON public.invites(restaurant_id, status);
CREATE INDEX idx_invites_email ON public.invites(email);
CREATE INDEX idx_invites_invited_by ON public.invites(invited_by);

-- Add updated_at trigger
CREATE TRIGGER handle_invites_updated_at
    BEFORE UPDATE ON public.invites
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Enable RLS
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- RLS Policies
-- =============================================================================

-- Owner/Manager can view invites for their restaurant
CREATE POLICY "Owner and manager can view invites"
    ON public.invites
    FOR SELECT
    USING (
        restaurant_id = (SELECT restaurant_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('restaurant_owner', 'manager')
    );

-- Owner can create invites for their restaurant
CREATE POLICY "Owner can create invites"
    ON public.invites
    FOR INSERT
    WITH CHECK (
        restaurant_id = (SELECT restaurant_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'restaurant_owner'
        AND invited_by = auth.uid()
    );

-- Owner can delete (cancel) invites for their restaurant
CREATE POLICY "Owner can delete invites"
    ON public.invites
    FOR DELETE
    USING (
        restaurant_id = (SELECT restaurant_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'restaurant_owner'
    );

-- Owner can update invites (for resend, status change)
CREATE POLICY "Owner can update invites"
    ON public.invites
    FOR UPDATE
    USING (
        restaurant_id = (SELECT restaurant_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'restaurant_owner'
    );

-- Service role can do everything (for admin operations)
CREATE POLICY "Service role can manage invites"
    ON public.invites
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- =============================================================================
-- Grant permissions
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invites TO authenticated;
GRANT ALL ON public.invites TO service_role;

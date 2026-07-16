-- Fix handle_new_user trigger to skip profile creation for invited users.
-- When inviteUserByEmail() creates an auth user, invited_at is SET.
-- Profile should only be created when user completes accept-invite flow.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Skip profile creation for invited users (invited_at is set by inviteUserByEmail)
    -- Profile will be created when user completes the accept-invite flow
    IF NEW.invited_at IS NOT NULL THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.profiles (id, email, full_name, role, restaurant_id)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'customer'),
        (NEW.raw_user_meta_data->>'restaurant_id')::UUID
    );
    RETURN NEW;
END;
$$;

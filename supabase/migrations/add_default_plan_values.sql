-- Update handle_new_user function to set default plan values for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (
    id,
    user_id,
    email,
    name,
    full_name,
    avatar_url,
    token_identifier,
    created_at,
    updated_at,
    -- Add default plan values for new users
    current_plan_id,
    generation_limit,
    generations_used
  ) VALUES (
    NEW.id,
    NEW.id::text,
    NEW.email,
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email,
    NEW.created_at,
    NEW.updated_at,
    -- Set default plan values
    'free',  -- Default 'free' plan
    1,       -- Default limit of 1 for free tier
    0        -- Start with 0 generations used
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 
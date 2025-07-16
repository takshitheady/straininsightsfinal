-- Drop all existing versions of update_user_plan function to resolve conflicts
DROP FUNCTION IF EXISTS public.update_user_plan(text, text, integer);
DROP FUNCTION IF EXISTS public.update_user_plan(uuid, text, integer);

-- Create a single, definitive version that accepts UUID
CREATE OR REPLACE FUNCTION public.update_user_plan(
  user_id_param UUID,
  plan_id_param TEXT,
  limit_param INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  row_count INTEGER;
BEGIN
  -- Log the operation for debugging
  RAISE NOTICE 'Updating user % with plan % and limit %', user_id_param, plan_id_param, limit_param;
  
  -- Update user plan details
  UPDATE public.users
  SET 
    current_plan_id = plan_id_param,
    generation_limit = limit_param,
    generations_used = 0, -- Reset usage counter
    updated_at = NOW()
  WHERE id = user_id_param;
  
  -- Check if update was successful
  GET DIAGNOSTICS row_count = ROW_COUNT;
  
  -- Return success status (true if any rows were updated)
  RETURN row_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment for documentation
COMMENT ON FUNCTION public.update_user_plan(UUID, TEXT, INTEGER) IS 'Updates user plan with UUID parameter only'; 
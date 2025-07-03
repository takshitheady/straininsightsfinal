-- Add a SQL function to directly update user plan details
CREATE OR REPLACE FUNCTION public.update_user_plan(
  user_id_param UUID,
  plan_id_param TEXT,
  limit_param INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  success BOOLEAN;
BEGIN
  -- Direct SQL update with full logging
  RAISE NOTICE 'Updating user % with plan % and limit %', user_id_param, plan_id_param, limit_param;
  
  UPDATE public.users
  SET 
    current_plan_id = plan_id_param,
    generation_limit = limit_param,
    generations_used = 0, -- Reset usage counter since limit_param already includes remaining generations
    updated_at = NOW()
  WHERE id = user_id_param;
  
  -- Check if update affected any rows
  GET DIAGNOSTICS success = ROW_COUNT;
  
  -- If primary key update failed, try by user_id
  IF success = 0 THEN
    RAISE NOTICE 'Primary key update failed, trying user_id column';
    
    UPDATE public.users
    SET 
      current_plan_id = plan_id_param,
      generation_limit = limit_param,
      generations_used = 0,
      updated_at = NOW()
    WHERE user_id = user_id_param::TEXT;
    
    GET DIAGNOSTICS success = ROW_COUNT;
  END IF;
  
  RETURN success > 0;
END;
$$ LANGUAGE plpgsql; 
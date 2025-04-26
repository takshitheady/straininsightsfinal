-- Add operations tracking columns to users table
ALTER TABLE IF EXISTS public.users
ADD COLUMN IF NOT EXISTS operations_available INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS operations_used INTEGER DEFAULT 0;

-- Create a function to reset operations_used monthly for all active users
CREATE OR REPLACE FUNCTION reset_operations_monthly()
RETURNS VOID AS $$
BEGIN
  UPDATE public.users
  SET operations_used = 0,
      updated_at = NOW()
  WHERE operations_used > 0;
END;
$$ LANGUAGE plpgsql;

-- Create a cron job to run the reset function on the 1st of each month
SELECT cron.schedule(
  'reset-operations-monthly',
  '0 0 1 * *', -- Run at midnight on the 1st day of each month
  $$SELECT reset_operations_monthly()$$
);

-- Comment
COMMENT ON COLUMN public.users.operations_available IS 'Number of operations available to user based on subscription plan';
COMMENT ON COLUMN public.users.operations_used IS 'Number of operations used by user in current billing cycle'; 
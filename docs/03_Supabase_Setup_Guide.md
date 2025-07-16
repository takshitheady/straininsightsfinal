# Supabase Setup Guide for StrainInsights (Enhanced with Admin System)

This comprehensive guide walks through setting up a Supabase project for the StrainInsights application, including the complete admin dashboard system, database functions, views, and edge functions.

## 1. Prerequisites

-   A Supabase account ([supabase.com](https://supabase.com))
-   Supabase CLI installed and configured ([Supabase CLI Docs](https://supabase.com/docs/guides/cli))
-   Node.js and npm (or yarn) for frontend development
-   A Stripe account for payment processing
-   A Google Cloud Console account for OAuth setup
-   (Optional) An account with an AI/LLM provider (e.g., OpenAI) for COA processing logic

## 2. Create a New Supabase Project

1.  Go to your Supabase dashboard.
2.  Click "New project".
3.  Choose your organization, provide a project name (e.g., `straininsights-production`), generate a strong database password (and save it securely), and select a region.
4.  Wait for the project to be provisioned.

## 3. Database Schema Setup

Navigate to the SQL Editor in your Supabase dashboard to execute the following schema setup.

### 3.1. Core Tables

#### 3.1.1. Enhanced `users` Table

```sql
-- Create users table with comprehensive subscription and admin support
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  user_id TEXT NOT NULL UNIQUE,
  email TEXT,
  name TEXT,
  full_name TEXT,
  avatar_url TEXT,
  token_identifier TEXT,
  stripe_customer_id TEXT,
  current_plan_id TEXT DEFAULT 'free',
  subscription_status TEXT,
  generations_used INTEGER DEFAULT 0,
  generation_limit INTEGER DEFAULT 1,
  operations_available INTEGER DEFAULT 1,
  operations_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_user_id ON public.users(user_id);
CREATE INDEX IF NOT EXISTS idx_users_plan ON public.users(current_plan_id);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at);
```

#### 3.1.2. `subscriptions` Table

```sql
-- Create subscriptions table for detailed Stripe subscription tracking
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  stripe_id TEXT UNIQUE,
  status TEXT,
  price_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON public.subscriptions(stripe_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
```

#### 3.1.3. `lab_results` Table

```sql
-- Create lab_results table for COA processing
CREATE TABLE IF NOT EXISTS public.lab_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  description TEXT,
  raw_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_lab_results_user_id ON public.lab_results(user_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_status ON public.lab_results(status);
CREATE INDEX IF NOT EXISTS idx_lab_results_created_at ON public.lab_results(created_at);
```

### 3.2. Admin Database Views

#### 3.2.1. Admin User Overview View

```sql
-- Create comprehensive admin user overview view
CREATE OR REPLACE VIEW admin_user_overview AS
SELECT 
  u.id,
  u.user_id,
  u.email,
  u.full_name,
  u.current_plan_id,
  u.generation_limit,
  u.generations_used,
  u.subscription_status,
  u.created_at,
  s.current_period_end,
  COALESCE(lr.total_uploads, 0) as total_uploads
FROM users u
LEFT JOIN subscriptions s ON u.user_id = s.user_id
LEFT JOIN (
  SELECT user_id, COUNT(*) as total_uploads 
  FROM lab_results 
  GROUP BY user_id
) lr ON u.id = lr.user_id
ORDER BY u.created_at DESC;
```

#### 3.2.2. Admin Analytics View

```sql
-- Create user analytics view for admin dashboard
CREATE OR REPLACE VIEW admin_user_analytics AS
SELECT 
  DATE(created_at) as registration_date,
  COUNT(*) as users_registered,
  COUNT(*) FILTER (WHERE current_plan_id = 'free') as free_users,
  COUNT(*) FILTER (WHERE current_plan_id = 'basic') as basic_users,
  COUNT(*) FILTER (WHERE current_plan_id = 'pro') as pro_users
FROM users 
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY registration_date DESC;
```

## 4. Database Functions

### 4.1. User Management Functions

#### 4.1.1. New User Handler

```sql
-- Function to handle new user registration
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
    'free',  -- Default 'free' plan
    1,       -- Default limit of 1 for free tier
    0        -- Start with 0 generations used
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

#### 4.1.2. User Update Handler

```sql
-- Function to handle user profile updates
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.users
  SET
    email = NEW.email,
    name = NEW.raw_user_meta_data->>'name',
    full_name = NEW.raw_user_meta_data->>'full_name',
    avatar_url = NEW.raw_user_meta_data->>'avatar_url',
    updated_at = NEW.updated_at
  WHERE user_id = NEW.id::text;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for user updates
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_update();
```

### 4.2. Admin Functions

#### 4.2.1. Admin Authorization Function

```sql
-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN user_email IN (
    'tim@useheady.com',
    'takshitmathur1201@gmail.com',
    'admin@straininsights.com',
    'ryan@useheady.com'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment for documentation
COMMENT ON FUNCTION is_admin(TEXT) IS 'Checks if user email has admin privileges';
```

#### 4.2.2. User Plan Update Function

```sql
-- Function to update user plans (admin only)
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
COMMENT ON FUNCTION public.update_user_plan(UUID, TEXT, INTEGER) IS 'Updates user plan with UUID parameter only - Admin function';
```

### 4.3. Operational Functions

#### 4.3.1. Monthly Operations Reset

```sql
-- Function to reset monthly operations
CREATE OR REPLACE FUNCTION reset_operations_monthly()
RETURNS VOID AS $$
BEGIN
  UPDATE public.users
  SET operations_used = 0,
      updated_at = NOW()
  WHERE operations_used > 0;
END;
$$ LANGUAGE plpgsql;

-- Schedule monthly reset (requires pg_cron extension)
-- SELECT cron.schedule(
--   'reset-operations-monthly',
--   '0 0 1 * *', -- Run at midnight on the 1st day of each month
--   $$SELECT reset_operations_monthly()$$
-- );
```

## 5. Row Level Security (RLS) Setup

### 5.1. Enable RLS on All Tables

```sql
-- Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Enable RLS on subscriptions table
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Enable RLS on lab_results table
ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;
```

### 5.2. Create RLS Policies

#### 5.2.1. Users Table Policies

```sql
-- Users can view and update their own records
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Service role can do everything (for admin operations)
CREATE POLICY "Service role full access" ON public.users
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
```

#### 5.2.2. Subscriptions Table Policies

```sql
-- Users can view their own subscriptions
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
  FOR SELECT USING (user_id = auth.uid()::text);

-- Service role can do everything
CREATE POLICY "Service role full access subscriptions" ON public.subscriptions
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
```

#### 5.2.3. Lab Results Table Policies

```sql
-- Users can manage their own lab results
CREATE POLICY "Users can view own lab results" ON public.lab_results
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lab results" ON public.lab_results
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lab results" ON public.lab_results
  FOR UPDATE USING (auth.uid() = user_id);

-- Service role can do everything
CREATE POLICY "Service role full access lab results" ON public.lab_results
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
```

## 6. Storage Setup

### 6.1. Create Storage Bucket

```sql
-- Create bucket for lab results
INSERT INTO storage.buckets (id, name, public) 
VALUES ('labresults', 'labresults', false);
```

### 6.2. Storage Policies

```sql
-- Users can upload to their own folder
CREATE POLICY "Users can upload own files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'labresults' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can view their own files
CREATE POLICY "Users can view own files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'labresults' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Service role can access all files
CREATE POLICY "Service role can access all files" ON storage.objects
  FOR ALL USING (bucket_id = 'labresults' AND auth.jwt() ->> 'role' = 'service_role');
```

## 7. Authentication Setup

### 7.1. Email Authentication

1. In Supabase Dashboard → Authentication → Settings
2. Configure email settings:
   - **Site URL**: Your production domain
   - **Redirect URLs**: Add your production and development URLs
   - **Email Templates**: Customize signup/reset emails

### 7.2. Google OAuth Setup

1. **Google Cloud Console Setup**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable Google+ API
   - Create OAuth 2.0 credentials
   - Add authorized redirect URIs: `https://your-project-ref.supabase.co/auth/v1/callback`

2. **Supabase Configuration**:
   - Go to Authentication → Providers → Google
   - Enable Google provider
   - Add Client ID and Client Secret from Google Cloud Console
   - Configure redirect URL

## 8. Edge Functions Deployment

### 8.1. Edge Function Structure

Create the following directory structure:

```
supabase/functions/
├── get-plans/
│   └── index.ts
├── create-checkout/
│   └── index.ts
├── payments-webhook/
│   └── index.ts
└── admin-operations/
    └── index.ts
```

### 8.2. Deploy Edge Functions

```bash
# Deploy all functions
supabase functions deploy get-plans
supabase functions deploy create-checkout
supabase functions deploy payments-webhook
supabase functions deploy admin-operations

# Or deploy all at once
supabase functions deploy
```

### 8.3. Set Environment Variables

In Supabase Dashboard → Edge Functions → Settings, add:

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## 9. Admin System Setup

### 9.1. Configure Admin Emails

Update the `is_admin` function with your admin email addresses:

```sql
-- Update admin emails in the is_admin function
CREATE OR REPLACE FUNCTION is_admin(user_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN user_email IN (
    'your-admin-email@company.com',
    'another-admin@company.com'
    -- Add more admin emails as needed
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 9.2. Test Admin Access

1. Register/login with an admin email
2. Navigate to `/admin` in your application
3. Verify admin dashboard loads with user management interface

## 10. Stripe Integration Setup

### 10.1. Stripe Configuration

1. **Create Products and Prices**:
   ```bash
   # Create Basic Plan Product
   stripe products create \
     --name "Basic Plan" \
     --description "100 generations per month"
   
   # Create Basic Plan Price
   stripe prices create \
     --product prod_xxx \
     --unit-amount 3900 \
     --currency usd \
     --recurring interval=month
   
   # Create Pro Plan Product  
   stripe products create \
     --name "Pro Plan" \
     --description "500 generations per month"
   
   # Create Pro Plan Price
   stripe prices create \
     --product prod_yyy \
     --unit-amount 9900 \
     --currency usd \
     --recurring interval=month
   ```

2. **Configure Webhooks**:
   - Add webhook endpoint: `https://your-project-ref.supabase.co/functions/v1/payments-webhook`
   - Select events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy webhook signing secret to environment variables

### 10.2. Test Stripe Integration

1. Use Stripe test mode initially
2. Test subscription creation and webhook processing
3. Verify user plan updates work correctly
4. Switch to live mode for production

## 11. Verification Checklist

### 11.1. Database Setup
- [ ] All tables created with proper indexes
- [ ] Database functions deployed and working
- [ ] RLS policies enabled and tested
- [ ] Admin views returning correct data

### 11.2. Authentication
- [ ] Email authentication working
- [ ] Google OAuth configured and tested
- [ ] Admin authorization function working
- [ ] User registration creates proper database records

### 11.3. Edge Functions
- [ ] All Edge Functions deployed successfully
- [ ] Environment variables configured
- [ ] Admin operations function working
- [ ] Stripe webhook processing correctly

### 11.4. Admin System
- [ ] Admin emails configured in `is_admin` function
- [ ] Admin dashboard accessible by authorized users
- [ ] User management features working
- [ ] Analytics data displaying correctly

### 11.5. Storage
- [ ] Storage bucket created
- [ ] Storage policies working
- [ ] File upload/download functioning

## 12. Production Deployment

### 12.1. Environment Configuration

**Frontend Environment Variables**:
```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

**Supabase Environment Variables**:
```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### 12.2. Security Review

- [ ] All RLS policies tested and verified
- [ ] Admin access restricted to authorized emails
- [ ] Stripe webhooks using live keys
- [ ] Environment variables secured
- [ ] Database backups enabled

### 12.3. Performance Optimization

- [ ] Database indexes optimized
- [ ] Edge Functions optimized for cold starts
- [ ] Frontend bundle optimized
- [ ] CDN configured for static assets

## 13. Maintenance and Monitoring

### 13.1. Regular Tasks

- **Weekly**: Review admin analytics for user growth
- **Monthly**: Verify subscription webhook processing
- **Quarterly**: Review and update admin user list
- **As needed**: Update Edge Functions and database schema

### 13.2. Monitoring

- Monitor Edge Function logs in Supabase Dashboard
- Track database performance and query times
- Monitor Stripe webhook delivery success rates
- Review admin action logs for security

### 13.3. Backup Strategy

- Enable Supabase automated backups (Pro plan feature)
- Export database schema changes to version control
- Backup environment variables securely
- Document all configuration changes

This comprehensive setup guide ensures a fully functional StrainInsights application with complete admin capabilities, secure subscription management, and robust error handling. 
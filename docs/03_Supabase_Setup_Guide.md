# Supabase Setup Guide for StrainInsights (Enhanced)

This guide walks through the steps to set up a Supabase project similar to the one used by the StrainInsights application, including enhanced features like Google OAuth, generation preservation, and sophisticated subscription management.

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

## 3. Enhanced Database Schema Setup

Navigate to the "Table Editor" in your Supabase dashboard or use SQL migrations with the Supabase CLI.

### 3.1. Enhanced `users` Table

This table complements the built-in `auth.users` table with enhanced subscription management.

-   **Name**: `users`
-   **Columns**:
    -   `id`: Type `uuid`. Set as Primary Key. Set as Foreign Key to `auth.users.id` with `ON UPDATE CASCADE` and `ON DELETE CASCADE` actions.
    -   `email`: Type `text`. Can be nullable if you don't always duplicate it from `auth.users`.
    -   `stripe_customer_id`: Type `text`. Nullable.
    -   `current_plan_id`: Type `text`. Default value `'free'`. Values: `'free'`, `'basic'`, `'pro'`.
    -   `subscription_status`: Type `text`. Nullable. Values: `'active'`, `'canceled'`, `'past_due'`, `'trialing'`.
    -   `generations_used`: Type `int4` (integer). Default value `0`.
    -   `generation_limit`: Type `int4` (integer). Default value `10` (free tier).
    -   `created_at`: Type `timestamptz`. Default value `now()`.
    -   `updated_at`: Type `timestamptz`. Default value `now()`.

**Enhanced Features:**
- Plan-based generation limits: Free (10), Basic (30), Pro (100)
- Generation preservation across plan changes
- Smart account status management

### 3.2. New `subscriptions` Table

Detailed subscription tracking for enhanced billing management.

-   **Name**: `subscriptions`
-   **Columns**:
    -   `id`: Type `uuid`. Set as Primary Key. Default value `gen_random_uuid()`.
    -   `user_id`: Type `uuid`. Set as Foreign Key to `users.id` with `ON UPDATE CASCADE` and `ON DELETE CASCADE`.
    -   `stripe_subscription_id`: Type `text`. Unique constraint.
    -   `stripe_customer_id`: Type `text`.
    -   `status`: Type `text`. Current subscription status from Stripe.
    -   `current_period_start`: Type `timestamptz`. Start of current billing period.
    -   `current_period_end`: Type `timestamptz`. End of current billing period.
    -   `plan_id`: Type `text`. Associated plan identifier.
    -   `created_at`: Type `timestamptz`. Default value `now()`.
    -   `updated_at`: Type `timestamptz`. Default value `now()`.

### 3.3. `lab_results` Table (Unchanged)

-   **Name**: `lab_results`
-   **Columns**:
    -   `id`: Type `uuid`. Set as Primary Key. Default value `gen_random_uuid()`.
    -   `user_id`: Type `uuid`. Set as Foreign Key to `auth.users.id` with `ON UPDATE CASCADE` and `ON DELETE CASCADE` actions.
    -   `file_name`: Type `text`.
    -   `storage_path`: Type `text`.
    -   `status`: Type `text`. Default value `'pending'`.
    -   `description`: Type `text`. Nullable.
    -   `raw_text`: Type `text`. Nullable.
    -   `created_at`: Type `timestamptz`. Default value `now()`.
    -   `updated_at`: Type `timestamptz`. Default value `now()`.

### 3.4. Enhanced SQL Functions

Create a function for atomic plan updates with generation preservation:

```sql
CREATE OR REPLACE FUNCTION update_user_plan(
  p_user_id UUID,
  p_plan_id TEXT,
  p_generation_limit INTEGER,
  p_preserve_generations BOOLEAN DEFAULT TRUE
)
RETURNS VOID AS $$
DECLARE
  current_used INTEGER;
  current_limit INTEGER;
  unused_generations INTEGER;
  new_generation_limit INTEGER;
  new_generations_used INTEGER;
BEGIN
  -- Get current usage data
  SELECT generations_used, generation_limit 
  INTO current_used, current_limit
  FROM users 
  WHERE id = p_user_id;
  
  -- Calculate unused generations if preservation is enabled
  IF p_preserve_generations AND current_used < current_limit THEN
    unused_generations := current_limit - current_used;
    new_generation_limit := p_generation_limit + unused_generations;
    new_generations_used := unused_generations;
  ELSE
    new_generation_limit := p_generation_limit;
    new_generations_used := 0;
  END IF;
  
  -- Update user plan atomically
  UPDATE users 
  SET 
    current_plan_id = p_plan_id,
    generation_limit = new_generation_limit,
    generations_used = new_generations_used,
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;
```

### 3.5. Enhanced Row Level Security (RLS)

Enable RLS for all tables with proper policies:

**For `users` table:**
```sql
-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own profile
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Allow new user creation (for triggers)
CREATE POLICY "Allow user creation" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);
```

**For `subscriptions` table:**
```sql
-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own subscriptions
CREATE POLICY "Users can view own subscriptions" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);
```

**For `lab_results` table:**
```sql
-- Enable RLS
ALTER TABLE lab_results ENABLE ROW LEVEL SECURITY;

-- Allow users full access to their own lab results
CREATE POLICY "Users can manage own lab results" ON lab_results
  FOR ALL USING (auth.uid() = user_id);
```

## 4. Enhanced Authentication Setup

### 4.1. Email/Password Authentication
-   Navigate to "Authentication" -> "Providers" in your Supabase dashboard.
-   Email/Password provider is enabled by default.

### 4.2. Google OAuth Setup

**Step 1: Google Cloud Console Configuration**
1.  Go to [Google Cloud Console](https://console.cloud.google.com/)
2.  Create a new project or select existing one
3.  Enable the Google+ API
4.  Go to "Credentials" -> "Create Credentials" -> "OAuth 2.0 Client IDs"
5.  Configure OAuth consent screen with your app information
6.  Create OAuth 2.0 credentials:
    -   Application type: Web application
    -   Authorized redirect URIs: `https://<your-project-id>.supabase.co/auth/v1/callback`
7.  Note your Client ID and Client Secret

**Step 2: Supabase Google Provider Configuration**
1.  In Supabase Dashboard -> "Authentication" -> "Providers"
2.  Enable Google provider
3.  Add your Google OAuth credentials:
    -   Client ID: From Google Cloud Console
    -   Client Secret: From Google Cloud Console
4.  Configure redirect URLs in "Authentication" -> "Settings":
    -   **Site URL**: Your production frontend URL (e.g., `https://yourdomain.com`)
    -   **Additional Redirect URLs**: Include development URLs if needed

### 4.3. User Profile Creation Trigger

Create a trigger to automatically create user profiles:

```sql
-- Function to create user profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, current_plan_id, generation_limit, generations_used)
  VALUES (NEW.id, NEW.email, 'free', 10, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

## 5. Storage Setup

1.  Navigate to "Storage" in your Supabase dashboard.
2.  Click "New bucket".
3.  **Bucket name**: `labresults`.
4.  **Public bucket**: Keep private for security.
5.  **Configure Storage Policies** for the `labresults` bucket:

```sql
-- Allow authenticated users to upload their own files
CREATE POLICY "Users can upload own files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'labresults' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow authenticated users to read their own files
CREATE POLICY "Users can read own files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'labresults' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );
```

## 6. Enhanced Edge Functions Setup

### 6.1. Function Structure
```
supabase/
  functions/
    get-plans/
      index.ts
    create-checkout/
      index.ts
    process-lab-result/
      index.ts
    process-lab-result-long/
      index.ts
    payments-webhook/
      index.ts
```

### 6.2. Environment Variables for Functions

**Critical: Use LIVE keys for production**

Navigate to "Project Settings" -> "Functions" in your Supabase dashboard and add:

-   `STRIPE_SECRET_KEY`: Your **live** Stripe secret key (`sk_live_...`)
-   `STRIPE_WEBHOOK_SECRET`: Your **live** Stripe webhook signing secret
-   `OPENAI_API_KEY`: API key for AI service
-   `SUPABASE_SERVICE_ROLE_KEY`: For admin operations (auto-configured)

### 6.3. Deploy Functions
```bash
# Link to your project
supabase link --project-ref <YOUR_PROJECT_ID>

# Deploy all functions
supabase functions deploy

# Or deploy individual functions
supabase functions deploy get-plans
supabase functions deploy create-checkout
supabase functions deploy payments-webhook
```

## 7. Enhanced Stripe Setup (Live Mode)

**Critical: All setup must be done in LIVE mode for production**

### 7.1. Create Products and Prices

**Basic Plan:**
1.  Create Product: "Basic Plan"
2.  Create Price: $39.00/month recurring
3.  Note the live Price ID: `price_1RTkaDDa07Wwp5KNnZF36GsC`

**Pro Plan:**
1.  Create Product: "Pro Plan"  
2.  Create Price: $99.00/month recurring
3.  Note the live Price ID: `price_1RTka9Da07Wwp5KNiRxFGnsG`

### 7.2. API Keys (Live Mode)
Get your **live** Stripe API keys from "Developers" -> "API keys":
-   **Publishable Key**: `pk_live_...` (for frontend)
-   **Secret Key**: `sk_live_...` (for backend/Edge Functions)

### 7.3. Webhook Endpoint (Live Mode)

**Critical: Create NEW webhook endpoint for live mode**

1.  Get your deployed `payments-webhook` function URL:
    `https://<YOUR_PROJECT_ID>.supabase.co/functions/v1/payments-webhook`

2.  In **live** Stripe Dashboard -> "Developers" -> "Webhooks":
    -   Click "Add endpoint"
    -   Endpoint URL: Your function URL
    -   Events to send:
        - `checkout.session.completed`
        - `customer.subscription.created`
        - `customer.subscription.updated`
        - `customer.subscription.deleted`
        - `invoice.payment_succeeded`
        - `invoice.payment_failed`

3.  Note the **live** Signing Secret for `STRIPE_WEBHOOK_SECRET`

## 8. Enhanced Frontend Configuration

### 8.1. Environment Variables (Live Mode)

Create `.env` file with **live** credentials:

```env
VITE_SUPABASE_URL=https://<YOUR_PROJECT_ID>.supabase.co
VITE_SUPABASE_ANON_KEY=<YOUR_SUPABASE_ANON_KEY>
VITE_STRIPE_PUBLISHABLE_KEY=<YOUR_LIVE_STRIPE_PUBLISHABLE_KEY>
```

### 8.2. Price ID Configuration

Update your frontend code with live Price IDs:

```typescript
// In your pricing configuration
const LIVE_PRICE_IDS = {
  basic: 'price_1RTkaDDa07Wwp5KNnZF36GsC',
  pro: 'price_1RTka9Da07Wwp5KNiRxFGnsG'
};
```

### 8.3. Production URLs

Ensure all redirect URLs point to your production domain:
-   Stripe checkout success/cancel URLs
-   Google OAuth redirect URIs
-   Supabase site URL and additional redirect URLs

## 9. Enhanced Testing Checklist

### 9.1. Authentication Testing
- [ ] Email/password sign-up and login
- [ ] Google OAuth sign-up and login
- [ ] User profile creation after authentication
- [ ] Proper redirect handling after OAuth

### 9.2. Subscription Management Testing
- [ ] Plan selection and Stripe checkout
- [ ] Webhook processing for new subscriptions
- [ ] Generation preservation during upgrades
- [ ] Plan renewals with generation preservation
- [ ] Account status updates

### 9.3. Generation System Testing
- [ ] Free tier generation limits (10)
- [ ] Basic plan generation limits (30)
- [ ] Pro plan generation limits (100)
- [ ] Generation preservation examples:
  - Basic (29/30 used) → Pro upgrade = 101 total
  - Basic (25/30 used) → Basic renewal = 35 total

### 9.4. UI/UX Testing
- [ ] Glowing button when generations exhausted
- [ ] Plan selection dialog functionality
- [ ] Profile page billing management
- [ ] Navigation to generation history

### 9.5. Security Testing
- [ ] RLS policies working correctly
- [ ] Storage policies protecting user files
- [ ] Webhook signature verification
- [ ] Environment variable security

## 10. Monitoring and Maintenance

### 10.1. Set Up Monitoring
-   Monitor Supabase function logs for errors
-   Set up Stripe webhook monitoring
-   Track user subscription metrics
-   Monitor generation usage patterns

### 10.2. Regular Maintenance
-   Review and rotate API keys periodically
-   Monitor database performance
-   Update dependencies and security patches
-   Review and optimize RLS policies

This enhanced setup guide provides a comprehensive foundation for deploying a production-ready StrainInsights application with sophisticated subscription management, generation preservation, and excellent user experience features. 
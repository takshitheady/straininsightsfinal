# Backend Architecture: Supabase

This document details the backend architecture of the StrainInsights application, which is powered by Supabase.

## 1. Overview

Supabase provides the core backend services for the application, including database, authentication, file storage, and serverless functions (Edge Functions). This BaaS (Backend as a Service) model allows for rapid development by abstracting away much of the traditional backend infrastructure management.

## 2. Supabase Services Used

-   **PostgreSQL Database**: For storing application data such as user profiles, lab result metadata, subscription details, and admin analytics.
-   **Authentication**: Manages user sign-up, login, and session management with support for email/password and Google OAuth.
-   **Storage**: Used for storing uploaded PDF files (Certificates of Analysis).
-   **Edge Functions**: Serverless TypeScript functions for handling business logic that requires a secure environment or interaction with third-party services like Stripe and AI models.
-   **Row Level Security (RLS)**: Database-level access control ensuring users can only access their own data.

## 3. Database Schema

Key tables in the Supabase PostgreSQL database:

### 3.1. `users` Table (Enhanced)

This table stores information about registered users, extending the default Supabase `auth.users` table with subscription and usage tracking.

-   `id` (UUID, Primary Key, Foreign Key to `auth.users.id`): Supabase Auth User ID.
-   `user_id` (TEXT, NOT NULL): String representation of auth user ID for compatibility.
-   `email` (TEXT): User's email address (can be synced or duplicated from `auth.users`).
-   `name` (TEXT, Nullable): User's display name.
-   `full_name` (TEXT, Nullable): User's full name.
-   `avatar_url` (TEXT, Nullable): URL to user's profile picture.
-   `token_identifier` (TEXT, Nullable): Additional token for identification.
-   `stripe_customer_id` (TEXT, Nullable): Stripe Customer ID for managing subscriptions.
-   `current_plan_id` (TEXT, Default: 'free'): The current plan identifier:
    -   `'free'`: Free plan (default for new users)
    -   `'basic'`: Basic plan ($39/month, 100 generations)
    -   `'pro'`: Pro plan ($99/month, 500 generations)
-   `subscription_status` (TEXT, Nullable): Status of the user's Stripe subscription (e.g., `active`, `canceled`, `past_due`, `trialing`).
-   `generations_used` (INTEGER, Default: 0): Number of COA processing generations used by the user in the current billing cycle.
-   `generation_limit` (INTEGER, Default: 1): The maximum number of generations allowed for the user based on their plan:
    -   Free plan: 1 generation
    -   Basic plan: 100 generations  
    -   Pro plan: 500 generations
-   `operations_available` (INTEGER, Default: 1): Number of operations available to user based on subscription plan.
-   `operations_used` (INTEGER, Default: 0): Number of operations used by user in current billing cycle.
-   `created_at` (TIMESTAMPTZ, Default: `now()`)
-   `updated_at` (TIMESTAMPTZ, Default: `now()`)

**Enhanced Features:**
- **Generation Preservation**: When users upgrade or renew plans, unused generations are preserved and added to the new plan limit
- **Smart Status Management**: Account status determination based on plan type and subscription status
- **Plan Migration Support**: Seamless transitions between plan tiers

### 3.2. `subscriptions` Table

Stores detailed subscription information linked to Stripe subscriptions.

-   `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
-   `user_id` (TEXT, Foreign Key to `users.user_id`): The user who owns this subscription
-   `stripe_id` (TEXT, UNIQUE): Stripe Subscription ID
-   `status` (TEXT): Current subscription status (`active`, `canceled`, `past_due`, etc.)
-   `price_id` (TEXT): Stripe Price ID associated with this subscription
-   `current_period_start` (TIMESTAMPTZ): Start of current billing period
-   `current_period_end` (TIMESTAMPTZ): End of current billing period
-   `cancel_at_period_end` (BOOLEAN, Default: false): Whether subscription will cancel at period end
-   `metadata` (JSONB): Additional metadata from Stripe
-   `created_at` (TIMESTAMPTZ, Default: `now()`)
-   `updated_at` (TIMESTAMPTZ, Default: `now()`)

### 3.3. `lab_results` Table

Stores metadata and processing results for uploaded Certificate of Analysis (COA) files.

-   `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
-   `user_id` (UUID, Foreign Key to `auth.users.id`): The user who uploaded the file
-   `file_name` (TEXT): Original filename of the uploaded file
-   `storage_path` (TEXT): Path in Supabase Storage where the file is stored
-   `status` (TEXT, Default: 'pending'): Processing status ('pending', 'processing', 'completed', 'error')
-   `description` (TEXT, Nullable): AI-generated analysis/description of the COA
-   `raw_text` (TEXT, Nullable): Extracted text content from the PDF
-   `created_at` (TIMESTAMPTZ, Default: `now()`)
-   `updated_at` (TIMESTAMPTZ, Default: `now()`)

### 3.4. Admin Database Views *(NEW)*

#### 3.4.1. `admin_user_overview` View
Comprehensive user overview for admin dashboard:

```sql
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

#### 3.4.2. `admin_user_analytics` View
Daily user registration analytics:

```sql
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

#### 4.1.1. `handle_new_user()` Trigger Function
Automatically creates user records when new users register:

```sql
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
```

#### 4.1.2. `handle_user_update()` Trigger Function
Syncs user profile updates from auth.users to users table:

```sql
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
```

### 4.2. Admin Functions *(NEW)*

#### 4.2.1. `is_admin(user_email)` Function
Determines if a user has admin privileges:

```sql
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
```

#### 4.2.2. `update_user_plan(user_id_param, plan_id_param, limit_param)` Function
Handles admin user plan updates with proper type handling:

```sql
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
```

### 4.3. Operational Functions

#### 4.3.1. `reset_operations_monthly()` Function
Monthly reset of user operations (scheduled via cron):

```sql
CREATE OR REPLACE FUNCTION reset_operations_monthly()
RETURNS VOID AS $$
BEGIN
  UPDATE public.users
  SET operations_used = 0,
      updated_at = NOW()
  WHERE operations_used > 0;
END;
$$ LANGUAGE plpgsql;
```

## 5. Row Level Security (RLS) Policies

### 5.1. `users` Table Policies
```sql
-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can view and update their own records
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);
```

### 5.2. `lab_results` Table Policies
```sql
-- Enable RLS
ALTER TABLE lab_results ENABLE ROW LEVEL SECURITY;

-- Users can only access their own lab results
CREATE POLICY "Users can view own lab results" ON lab_results
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lab results" ON lab_results
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

### 5.3. `subscriptions` Table Policies
```sql
-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscriptions
CREATE POLICY "Users can view own subscriptions" ON subscriptions
  FOR SELECT USING (user_id = auth.uid()::text);
```

## 6. Edge Functions Architecture

### 6.1. Overview
Edge Functions provide serverless execution environment for business logic requiring:
- Secure API key handling
- Third-party service integration
- Database operations with elevated privileges
- Webhook processing

### 6.2. Function Deployment Structure
```
supabase/functions/
├── get-plans/
│   └── index.ts
├── create-checkout/
│   └── index.ts
├── payments-webhook/
│   └── index.ts
└── admin-operations/      ← NEW
    └── index.ts
```

### 6.3. Edge Function Details

#### 6.3.1. `get-plans`
**Purpose**: Fetch active Stripe pricing plans for frontend display

**Features**:
- Retrieves live Stripe pricing data
- Expands product information
- Handles rate limiting and error states
- Returns structured plan data

**Response Format**:
```typescript
interface PlanResponse {
  id: string;
  object: string;
  active: boolean;
  currency: string;
  unit_amount: number;
  product: {
    id: string;
    name: string;
    description?: string;
  };
}
```

#### 6.3.2. `create-checkout`
**Purpose**: Generate Stripe Checkout Sessions for subscriptions

**Features**:
- Creates/retrieves Stripe customers
- Handles subscription checkout sessions
- Embeds user metadata for webhook processing
- Supports promotion codes
- Configures success/cancel URLs

**Request Format**:
```typescript
interface CheckoutRequest {
  priceId: string;
  userId: string;
  userEmail: string;
  returnUrlPath?: string;
}
```

#### 6.3.3. `payments-webhook`
**Purpose**: Process Stripe webhook events for subscription management

**Supported Events**:
- `checkout.session.completed`: New subscription activation
- `customer.subscription.updated`: Plan changes and renewals  
- `customer.subscription.deleted`: Subscription cancellations

**Enhanced Generation Preservation Logic**:
```typescript
// Preserve unused generations when upgrading
const { data: currentUserData } = await supabaseClient
  .from('users')
  .select('current_plan_id, generation_limit, generations_used')
  .eq('id', userToUpdate.id)
  .single();

let newGenerationLimit = generationLimit;
if (currentUserData && currentUserData.generations_used < currentUserData.generation_limit) {
  const unusedGenerations = currentUserData.generation_limit - currentUserData.generations_used;
  newGenerationLimit = generationLimit + unusedGenerations;
}
```

#### 6.3.4. `admin-operations` *(NEW)*
**Purpose**: Handle all admin-related database operations with secure service role access

**Supported Operations**:

**Update User Plan**:
```typescript
interface UpdateUserPlanRequest {
  action: 'update_user_plan';
  userId: string;
  planId: 'free' | 'basic' | 'pro';
  generationLimit: number;
}
```

**Delete User**:
```typescript
interface DeleteUserRequest {
  action: 'delete_user';
  userId: string;
}
```

**Get Users (with pagination)**:
```typescript
interface GetUsersRequest {
  action: 'get_users';
  page?: number;
  pageSize?: number;
  search?: string;
  planFilter?: string;
}
```

**Get Analytics**:
```typescript
interface GetAnalyticsRequest {
  action: 'get_analytics';
  type: 'user_growth' | 'revenue' | 'platform_metrics';
  period?: 'week' | 'month' | 'year';
}
```

**Security Implementation**:
```typescript
// Verify admin status before any operation
const { data: isAdminData, error: adminError } = await supabase.rpc('is_admin', {
  user_email: user.email
});

if (adminError || !isAdminData) {
  throw new Error('Insufficient permissions');
}
```

**Data Type Handling**:
```typescript
// Convert user_id string to UUID for database functions
const { data: userData, error: userError } = await supabase
  .from('users')
  .select('id')
  .eq('user_id', userId)
  .single();

// Use UUID for database function calls
const { data, error } = await supabase.rpc('update_user_plan', {
  user_id_param: userData.id,  // UUID instead of string
  plan_id_param: planId,
  limit_param: generationLimit
});
```

## 7. Enhanced Subscription Management

### 7.1. Generation Preservation System

**Business Logic:**
- **New Subscriptions**: User gets full plan limit, usage reset to 0
- **Renewals**: User gets plan limit + unused generations from previous period
- **Upgrades**: User gets new plan limit + unused generations from previous plan
- **Downgrades**: User gets new plan limit (excess generations preserved up to new limit)

**Implementation Example:**
```sql
-- Example: User with Basic plan (100 limit, 95 used = 5 remaining) upgrades to Pro
-- Result: 500 (Pro limit) + 5 (unused) = 505 total generations
```

### 7.2. Account Status Logic

**Status Determination:**
- **Free Plan Users**: Status = "inactive" (encourages upgrades)
- **Basic/Pro Plan Users**: Status = "active" (when subscription is valid)
- **Canceled Plans**: Status = "inactive" (after subscription expires)

### 7.3. Plan Migration Database Function

**SQL Function: `update_user_plan`**
- Handles plan transitions with generation preservation
- Updates user plan information atomically
- Maintains data consistency during subscription changes
- Supports rollback on errors

## 8. Admin System Database Architecture *(NEW)*

### 8.1. Admin Access Control
- **Role Verification**: `is_admin(user_email)` function checks against approved admin emails
- **Service Role Operations**: Admin Edge Function uses service role key to bypass RLS
- **Audit Trail**: All admin operations logged for security tracking

### 8.2. Admin Data Views
- **`admin_user_overview`**: Comprehensive user data for management interface
- **`admin_user_analytics`**: Daily registration metrics for analytics dashboard
- **Real-time Queries**: Direct database access for up-to-date admin information

### 8.3. Admin Operation Types

**User Management**:
- View all users with pagination and filtering
- Update user plans and generation limits
- Delete user accounts (with cascade deletion of related data)
- Search users by email or name

**Analytics**:
- User growth tracking
- Plan distribution metrics
- Revenue analytics
- Platform usage statistics

**Platform Management**:
- System-wide settings
- Admin user management
- Operational controls

## 9. Environment Variables

Enhanced environment configuration for production deployment:

**Stripe Configuration:**
-   `STRIPE_SECRET_KEY`: **Live** Stripe secret API key
-   `STRIPE_WEBHOOK_SECRET`: **Live** Stripe webhook signing secret
-   `VITE_STRIPE_PUBLISHABLE_KEY`: **Live** Stripe publishable key

**Supabase Configuration:**
-   `SUPABASE_URL`: Project URL
-   `SUPABASE_ANON_KEY`: Anonymous key for client-side operations
-   `SUPABASE_SERVICE_ROLE_KEY`: Service role key for Edge Functions and admin operations

**AI Service Configuration:**
-   AI processing service API keys and endpoints (implementation-specific)

## 10. Backup and Disaster Recovery

### 10.1. Database Backups
-   **Automated Daily Backups**: Supabase provides automatic daily backups
-   **Point-in-Time Recovery**: Available for Pro and Team plans
-   **Export Capabilities**: Manual database exports for additional backup

### 10.2. Code and Configuration Backup
-   **Version Control**: All Edge Functions and migrations stored in Git
-   **Environment Variables**: Securely stored in Supabase dashboard
-   **Migration History**: Complete record of all database schema changes

## 11. Performance Optimization

### 11.1. Database Optimization
- **Indexes**: Strategic indexing on frequently queried columns
- **Views**: Pre-computed admin views for faster dashboard loading
- **Connection Pooling**: Built-in Supabase connection management

### 11.2. Edge Function Optimization
- **Cold Start Management**: Minimal dependencies for faster startup
- **Caching**: Strategic caching of frequently accessed data
- **Error Handling**: Comprehensive error management for reliability

## 12. Security Considerations

### 12.1. Authentication Security
-   **JWT Tokens**: Secure session management with automatic refresh
-   **OAuth Integration**: Secure Google authentication flow
-   **Session Storage**: Secure client-side session persistence

### 12.2. Database Security
-   **Row Level Security**: Comprehensive RLS policies for all tables
-   **Function Security**: SECURITY DEFINER for elevated privilege operations
-   **Admin Access Control**: Multi-layer admin verification system

### 12.3. API Security
-   **CORS Configuration**: Proper cross-origin resource sharing setup
-   **Rate Limiting**: Built-in Supabase rate limiting for Edge Functions
-   **Input Validation**: Comprehensive validation in all Edge Functions

This backend architecture provides a robust, scalable foundation for the StrainInsights application, with comprehensive admin capabilities, secure subscription management, and efficient data processing workflows. 
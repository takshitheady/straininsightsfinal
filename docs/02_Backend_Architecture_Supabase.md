# Backend Architecture: Supabase

This document details the backend architecture of the StrainInsights application, which is powered by Supabase.

## 1. Overview

Supabase provides the core backend services for the application, including database, authentication, file storage, and serverless functions (Edge Functions). This BaaS (Backend as a Service) model allows for rapid development by abstracting away much of the traditional backend infrastructure management.

## 2. Supabase Services Used

-   **PostgreSQL Database**: For storing application data such as user profiles, lab result metadata, and subscription details.
-   **Authentication**: Manages user sign-up, login, and session management with support for email/password and Google OAuth.
-   **Storage**: Used for storing uploaded PDF files (Certificates of Analysis).
-   **Edge Functions**: Serverless TypeScript functions for handling business logic that requires a secure environment or interaction with third-party services like Stripe and AI models.

## 3. Database Schema

Key tables in the Supabase PostgreSQL database:

### 3.1. `users` Table (Enhanced)

This table stores information about registered users, extending the default Supabase `auth.users` table with subscription and usage tracking.

-   `id` (UUID, Primary Key, Foreign Key to `auth.users.id`): Supabase Auth User ID.
-   `email` (TEXT): User's email address (can be synced or duplicated from `auth.users`).
-   `stripe_customer_id` (TEXT, Nullable): Stripe Customer ID for managing subscriptions.
-   `current_plan_id` (TEXT, Default: 'free'): The current plan identifier:
    -   `'free'`: Free plan (default for new users)
    -   `'basic'`: Basic plan ($39/month, 30 generations)
    -   `'pro'`: Pro plan ($99/month, 100 generations)
-   `subscription_status` (TEXT, Nullable): Status of the user's Stripe subscription (e.g., `active`, `canceled`, `past_due`, `trialing`).
-   `generations_used` (INTEGER, Default: 0): Number of COA processing generations used by the user in the current billing cycle.
-   `generation_limit` (INTEGER, Default: 10): The maximum number of generations allowed for the user based on their plan:
    -   Free plan: 10 generations
    -   Basic plan: 30 generations  
    -   Pro plan: 100 generations
-   `created_at` (TIMESTAMPTZ, Default: `now()`)
-   `updated_at` (TIMESTAMPTZ, Default: `now()`)

**Enhanced Features:**
- **Generation Preservation**: When users upgrade or renew plans, unused generations are preserved and added to the new plan limit
- **Smart Status Management**: Account status determination based on plan type and subscription status
- **Plan Migration Support**: Seamless transitions between plan tiers

### 3.2. `subscriptions` Table (New)

Stores detailed subscription information linked to Stripe subscriptions.

-   `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
-   `user_id` (UUID, Foreign Key to `users.id`): The user who owns this subscription
-   `stripe_subscription_id` (TEXT, Unique): Stripe subscription ID
-   `stripe_customer_id` (TEXT): Stripe customer ID
-   `status` (TEXT): Current subscription status from Stripe
-   `current_period_start` (TIMESTAMPTZ): Start of current billing period
-   `current_period_end` (TIMESTAMPTZ): End of current billing period
-   `plan_id` (TEXT): Associated plan identifier
-   `created_at` (TIMESTAMPTZ, Default: `now()`)
-   `updated_at` (TIMESTAMPTZ, Default: `now()`)

### 3.3. `lab_results` Table

Stores metadata and results for uploaded Certificates of Analysis (COAs).

-   `id` (UUID, Primary Key, Default: `gen_random_uuid()`): Unique identifier for the lab result record.
-   `user_id` (UUID, Foreign Key to `auth.users.id`): The user who uploaded the COA.
-   `file_name` (TEXT): Original name of the uploaded PDF file.
-   `storage_path` (TEXT): Path to the PDF file in Supabase Storage (e.g., `public/labresults/<user_id>/<timestamp>-<filename>`).
-   `status` (TEXT, Default: `'pending'`): Processing status of the COA. Possible values:
    -   `pending`: File uploaded, awaiting processing.
    -   `processing`: Edge Function is currently analyzing the COA.
    -   `completed`: Processing finished successfully, description available.
    -   `error`: An error occurred during processing.
-   `description` (TEXT, Nullable): The AI-generated description/analysis of the COA.
-   `raw_text` (TEXT, Nullable): Raw text extracted from the PDF (optional, for debugging or future use).
-   `created_at` (TIMESTAMPTZ, Default: `now()`)
-   `updated_at` (TIMESTAMPTZ, Default: `now()`)

*Note: Row Level Security (RLS) policies are crucial for these tables to ensure users can only access and modify their own data.*

## 4. Authentication (Enhanced)

**Multi-Provider Authentication System:**

-   **Email/Password Authentication**: Traditional authentication flow
-   **Google OAuth**: Seamless Google sign-in integration
    -   Configured in Supabase Dashboard → Authentication → Providers
    -   Automatic user profile creation on first sign-in
    -   Redirect to `/upload` after successful authentication

-   **Session Management**: 
    -   The `src/supabase/auth.tsx` file provides a React context (`AuthProvider`)
    -   Manages user sessions and authentication status
    -   Supports multiple authentication methods through unified interface

-   **Security**: RLS policies in the database are tied to `auth.uid()` to enforce data access rules.

## 5. Storage

-   Supabase Storage is used to store the PDF files (COAs) uploaded by users.
-   A bucket named `labresults` is used.
-   Files are stored with a path structure like `<user_id>/<timestamp>-<filename>.pdf` to ensure uniqueness and organization.
-   Access to files in the bucket is controlled by Storage policies, typically allowing authenticated users to upload and read their own files.
-   The frontend uploads files directly to this bucket after the user selects a file.

## 6. Edge Functions (Enhanced)

Serverless TypeScript functions deployed on Supabase with enhanced subscription management capabilities.

-   **Location**: Stored in the `supabase/functions/` directory in the project.
-   **Deployment**: Deployed via the Supabase CLI (`supabase functions deploy <function_name>`).
-   **Invocation**: Called from the frontend client using `supabase.functions.invoke('<function_name>', { body: ... })`.

### Key Edge Functions:

#### 6.1. Subscription Management Functions

-   **`get-plans`**: Retrieves active pricing plans from Stripe
    -   Returns plan details with correct pricing: Basic ($39), Pro ($99)
    -   Includes plan features and generation limits
    -   Cached on frontend for performance

-   **`create-checkout`**: Creates Stripe Checkout Sessions
    -   Handles multiple plan types (Basic/Pro)
    -   Supports upgrade and renewal flows
    -   Includes user metadata for webhook processing
    -   Enables promotion codes for discounts

-   **`payments-webhook`**: Enhanced Stripe webhook handler
    -   **Generation Preservation Logic**: Preserves unused generations when upgrading/renewing
    -   **Smart Plan Updates**: Distinguishes between new subscriptions, renewals, and upgrades
    -   **Status Management**: Updates user subscription status and plan information
    -   **Event Handling**: Processes multiple Stripe events:
        - `checkout.session.completed`: New subscription activation
        - `customer.subscription.updated`: Plan changes and renewals
        - `customer.subscription.deleted`: Cancellations and downgrades
        - `invoice.payment_succeeded`: Successful payments
        - `invoice.payment_failed`: Failed payments

#### 6.2. COA Processing Functions

-   **`process-lab-result` / `process-lab-result-long`**: The core COA processing functions. They:
    -   Are triggered after a file is uploaded and its metadata is saved.
    -   Fetch the PDF from Supabase Storage.
    -   Extract text from the PDF.
    -   Call external AI/LLM service to generate description/analysis.
    -   Update the corresponding record in the `lab_results` table with the generated `description` and set `status` to `'completed'` or `'error'`.

## 7. Enhanced Subscription Management

### 7.1. Generation Preservation System

**Business Logic:**
- **New Subscriptions**: User gets full plan limit, usage reset to 0
- **Renewals**: User gets plan limit + unused generations from previous period
- **Upgrades**: User gets new plan limit + unused generations from previous plan
- **Downgrades**: User gets new plan limit (excess generations preserved up to new limit)

**Implementation:**
```sql
-- Example: User with Basic plan (30 limit, 29 used = 1 remaining) upgrades to Pro
-- Result: 100 (Pro limit) + 1 (unused) = 101 total generations
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

## 8. Environment Variables

Enhanced environment configuration for production deployment:

**Stripe Configuration:**
-   `STRIPE_SECRET_KEY`: **Live** Stripe secret API key
-   `STRIPE_WEBHOOK_SECRET`: **Live** Stripe webhook signing secret
-   `VITE_STRIPE_PUBLISHABLE_KEY`: **Live** Stripe publishable key

**AI Service Configuration:**
-   `OPENAI_API_KEY`: API key for AI service used in COA processing

**Supabase Configuration:**
-   `VITE_SUPABASE_URL`: Supabase project URL
-   `VITE_SUPABASE_ANON_KEY`: Supabase anonymous key
-   Auto-configured within Supabase environment for Edge Functions

**OAuth Configuration:**
-   Google OAuth credentials configured in Supabase Dashboard
-   No additional environment variables needed for frontend

## 9. Security Considerations

**Enhanced Security Measures:**

-   **Row Level Security (RLS)**: Implemented on all tables (`users`, `subscriptions`, `lab_results`) to ensure users can only access their own data.
-   **Storage Policies**: Configured for the `labresults` bucket to control file access.
-   **Environment Variable Management**: All API keys and secrets stored securely as environment variables.
-   **Webhook Security**: Stripe webhook endpoints verify signatures using live webhook secrets.
-   **Input Validation**: Edge Functions validate all inputs received from clients.
-   **OAuth Security**: Google OAuth configured with proper redirect URIs and scopes.
-   **Session Management**: Secure session handling with automatic token refresh.

## 10. Recent Enhancements

### 10.1. Subscription System Improvements
- Generation preservation across plan changes
- Smart status management based on plan types
- Enhanced webhook processing for complex subscription scenarios

### 10.2. Authentication Enhancements
- Google OAuth integration with seamless user experience
- Multi-provider authentication support
- Improved session management and security

### 10.3. Database Schema Updates
- Added `subscriptions` table for detailed subscription tracking
- Enhanced `users` table with improved plan management
- Added SQL functions for atomic plan updates

### 10.4. Business Logic Improvements
- Fair billing system that preserves user value
- Clear account status determination
- Support for complex subscription scenarios (upgrades, downgrades, renewals)

This architecture leverages Supabase's integrated services to provide a robust and scalable backend with enhanced subscription management capabilities and minimal operational overhead. The recent improvements focus on creating a fair, user-friendly billing system while maintaining data integrity and security. 
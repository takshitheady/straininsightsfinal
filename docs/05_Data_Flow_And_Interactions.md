# Data Flow and System Interactions

This document illustrates key data flows and interactions between the frontend, Supabase backend (Database, Auth, Storage, Edge Functions), and external services like Stripe and AI models.

## Flow 1: User Registration (Enhanced with Google OAuth)

### 1A: Email/Password Registration
1.  **Frontend (`SignUpForm.tsx`)**: User enters email and password.
2.  **Frontend**: Calls `supabase.auth.signUp({ email, password })`.
3.  **Supabase Auth**: Creates a new user in `auth.users` table.
4.  **Supabase Auth**: Sends a confirmation email to the user.
5.  **(Post-confirmation)**:
    *   A Supabase Database Trigger on `auth.users` table creates a corresponding record in the public `users` table.
    *   This new record has `id` (from `auth.users.id`), `email`, `current_plan_id: 'free'`, default `generation_limit: 10`, and `generations_used: 0`.
6.  **Frontend**: Redirects to confirmation page or login page.

### 1B: Google OAuth Registration
1.  **Frontend (`SignUpForm.tsx`)**: User clicks "Continue with Google" button.
2.  **Frontend**: Calls `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: '/upload' } })`.
3.  **Supabase Auth**: Redirects user to Google OAuth consent screen.
4.  **Google**: User grants permissions and is redirected back to Supabase.
5.  **Supabase Auth**: Creates new user in `auth.users` table with Google profile data.
6.  **Database Trigger**: Automatically creates corresponding record in `users` table with default free plan settings.
7.  **Frontend**: User is redirected to `/upload` with active session.

## Flow 2: User Login (Enhanced with Google OAuth)

### 2A: Email/Password Login
1.  **Frontend (`LoginForm.tsx`)**: User enters email and password.
2.  **Frontend**: Calls `supabase.auth.signInWithPassword({ email, password })`.
3.  **Supabase Auth**: Verifies credentials, creates session, returns JWT.
4.  **Frontend (`AuthProvider`)**: Stores session, updates user state.
5.  **Frontend**: User accesses protected routes with JWT authentication.

### 2B: Google OAuth Login
1.  **Frontend (`LoginForm.tsx`)**: User clicks "Continue with Google" button.
2.  **Frontend**: Calls `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: '/upload' } })`.
3.  **Supabase Auth**: Redirects to Google OAuth.
4.  **Google**: User authenticates and is redirected back.
5.  **Supabase Auth**: Creates session with existing user account.
6.  **Frontend**: User is redirected to `/upload` with active session.

## Flow 3: Viewing Pricing Plans (Homepage & Upgrade Dialog)

1.  **Frontend (`home.tsx` or `PricingSection.tsx`)**: Component mounts or is displayed.
2.  **Frontend**: Checks `localStorage` for cached plans data (`pricingPlans` and `pricingPlansTimestamp`).
    *   **Cache Hit (Valid)**: Uses cached data to display plans.
    *   **Cache Miss (or Expired)**: Proceeds to fetch from API.
3.  **Frontend**: Calls `supabase.functions.invoke('get-plans')`.
4.  **Supabase Edge Function (`get-plans`)**: Receives the request.
    *   Uses **live** `STRIPE_SECRET_KEY` to initialize Stripe client.
    *   Calls `stripe.prices.list({ active: true, expand: ['data.product'] })` to fetch active prices.
    *   Returns enhanced JSON array with correct pricing:
        ```json
        [
          {
            "id": "price_1RTkaDDa07Wwp5KNnZF36GsC",
            "amount": 3900, // $39.00
            "nickname": "Basic Plan",
            "generation_limit": 30
          },
          {
            "id": "price_1RTka9Da07Wwp5KNiRxFGnsG", 
            "amount": 9900, // $99.00
            "nickname": "Pro Plan",
            "generation_limit": 100
          }
        ]
        ```
5.  **Frontend**: Receives plan data, caches it, and renders pricing cards with correct features and pricing.

## Flow 4: Enhanced Profile Management

### 4A: Account Status Determination
1.  **Frontend (`Profile.tsx`)**: Page loads for authenticated user.
2.  **Frontend**: Fetches user data from `users` table including `current_plan_id`, `generation_limit`, `generations_used`.
3.  **Frontend**: Determines account status:
    *   **Free Plan (`current_plan_id: 'free'`)**: Status = "inactive" (encourages upgrades)
    *   **Basic/Pro Plans**: Fetches subscription data and sets status = "active" if valid
4.  **Frontend**: Displays appropriate status and plan information.

### 4B: Billing Management with Plan Selection
1.  **Frontend**: User clicks "Manage Billing" button.
2.  **Frontend**: Checks if generations are exhausted (`generations_used >= generation_limit`):
    *   **If exhausted**: Button glows with pulse animation and shows "Upgrade Plan - No Generations Left!"
3.  **Frontend**: Opens plan selection dialog based on current plan:
    *   **Free Users**: Can choose Basic or Pro plans
    *   **Basic Users**: Can renew Basic or upgrade to Pro
    *   **Pro Users**: Can renew Pro or downgrade to Basic
4.  **Frontend**: User selects plan and proceeds to Stripe checkout (see Flow 5).

### 4C: Navigation Integration
1.  **Frontend**: User clicks "View Generation History".
2.  **Frontend**: Navigates to `/output-history` using React Router.
3.  **Frontend**: Displays user's COA processing history from `lab_results` table.

## Flow 5: File Upload, Processing, and Result Display (`UploadPage.tsx`)

1.  **Frontend**: User clicks an "Upload" call-to-action button.
    *   **Auth Check**: If not authenticated, redirected to `/login` with redirect parameter.
    *   If authenticated, user selects/drops a PDF file.
    *   Client-side validation (type, size).
    *   User usage is fetched to check if upload is allowed.
    *   If limit reached, upload disabled and upgrade dialog shown.
2.  **Frontend**: User clicks "Extract COA Data" (short or long analysis).
    *   `handleUpload` / `handleUploadLong` function triggered.
    *   UI status set to `'uploading'`.
3.  **Frontend (`uploadToSupabase` function)**:
    *   **Upload to Storage**: File uploaded to `labresults` bucket under `<user_id>/<timestamp>-<filename>.pdf`.
    *   **DB Insert**: New record in `lab_results` table with `status: 'pending'`.
    *   **Update Usage**: `generations_used` incremented in `users` table.
    *   **Update Status**: `lab_results` status updated to `'processing'`.
    *   **Invoke Edge Function**: Calls appropriate processing function with `pdfStoragePath` and `labResultId`.
4.  **Supabase Edge Function (`process-lab-result`)**: 
    *   Downloads PDF from storage.
    *   Extracts text from PDF.
    *   Sends to AI/LLM service for analysis.
    *   Updates `lab_results` with generated description and `status: 'completed'`.
5.  **Frontend (Polling)**: Polls `lab_results` table for completion and displays results.

## Flow 6: Enhanced User Subscription (Stripe Checkout with Generation Preservation)

1.  **Frontend**: User clicks plan selection from Profile page or pricing section.
    *   **Auth Check**: If not authenticated, redirected to login.
2.  **Frontend (`initiateCheckout`)**: Calls `supabase.functions.invoke('create-checkout')` with enhanced metadata:
    ```javascript
    {
      body: {
        price_id: "price_1RTkaDDa07Wwp5KNnZF36GsC", // Live Price ID
        user_id: user.id,
        return_url: `${window.location.origin}/profile`,
        checkout_type: "upgrade" // or "renewal", "new_subscription"
      }
    }
    ```
3.  **Supabase Edge Function (`create-checkout`)**: 
    *   Initializes Stripe client with live keys.
    *   Manages Stripe customer creation/retrieval.
    *   Creates checkout session with enhanced metadata for webhook processing.
    *   Returns session URL.
4.  **Frontend**: Redirects to Stripe checkout page.
5.  **Stripe**: User completes payment and is redirected to success URL.
6.  **Stripe Webhook**: Sends events to `payments-webhook` Edge Function.

## Flow 7: Enhanced Stripe Webhook Processing with Generation Preservation

1.  **Stripe**: Sends webhook events to `payments-webhook` Edge Function.
2.  **Supabase Edge Function (`payments-webhook`)**: 
    *   Verifies Stripe signature using live webhook secret.
    *   Parses event object.
    
    **Enhanced `checkout.session.completed` Handling**:
    *   Extracts user and subscription information.
    *   **Generation Preservation Logic**:
        ```typescript
        // Get current user data
        const currentUserData = await supabaseClient
          .from('users')
          .select('current_plan_id, generation_limit, generations_used')
          .eq('id', userId)
          .single();

        // Calculate unused generations
        const unusedGenerations = Math.max(0, 
          currentUserData.generation_limit - currentUserData.generations_used
        );

        // Set new limits with preservation
        const newGenerationLimit = planGenerationLimit + unusedGenerations;
        ```
    *   Updates `users` table with preserved generations.
    *   Creates detailed subscription record in `subscriptions` table.
    
    **Enhanced `customer.subscription.updated` Handling**:
    *   Maps Stripe Price IDs to plan names:
        ```typescript
        const priceIdToPlanName = {
          'price_1RTkaDDa07Wwp5KNnZF36GsC': 'basic',
          'price_1RTka9Da07Wwp5KNiRxFGnsG': 'pro'
        };
        ```
    *   Applies generation preservation for plan changes.
    *   Updates both `users` and `subscriptions` tables.
    
    **Enhanced `customer.subscription.deleted` Handling**:
    *   Downgrades user to free plan.
    *   Preserves unused generations up to free tier limit (10).
    *   Updates subscription status appropriately.

3.  **Database Updates**: User's subscription details synchronized with generation preservation.
4.  **Frontend**: Subsequent loads reflect updated subscription status and preserved generation limits.

## Flow 8: Generation Preservation Examples

### Example 1: Basic to Pro Upgrade
- **Before**: Basic plan (30 limit, 29 used = 1 unused)
- **After Upgrade**: Pro plan (100 + 1 = 101 total generations)
- **Result**: User gets full Pro benefits plus preserved unused generation

### Example 2: Basic Plan Renewal
- **Before**: Basic plan (30 limit, 25 used = 5 unused)
- **After Renewal**: Basic plan (30 + 5 = 35 total generations)
- **Result**: User gets fresh Basic plan plus unused generations

### Example 3: Pro to Free Downgrade
- **Before**: Pro plan (100 limit, 90 used = 10 unused)
- **After Downgrade**: Free plan (10 limit, preserves up to 10)
- **Result**: User gets maximum free tier generations

## Flow 9: Enhanced User Experience Features

### 9A: Glowing Button for Exhausted Generations
1.  **Frontend (`Profile.tsx`)**: Checks if `generations_used >= generation_limit`.
2.  **Frontend**: If true, applies glowing animation to "Manage Billing" button:
    *   `animate-pulse` for pulsing effect
    *   `ring-2 ring-brand-green/50` for glowing ring
    *   Changes text to "Upgrade Plan - No Generations Left!"
3.  **Frontend**: User clicks glowing button and is directed to plan selection.

### 9B: Smart Plan Selection Dialog
1.  **Frontend**: Opens plan selection modal based on current user plan.
2.  **Frontend**: Shows appropriate plans with:
    *   Current plan highlighted with badge
    *   Upgrade/renewal options clearly labeled
    *   Feature comparisons and pricing
3.  **Frontend**: Handles plan selection and checkout initiation.

These enhanced flows illustrate the sophisticated interplay between user interface, authentication systems, subscription management, and generation preservation, creating a fair and user-friendly billing system while maintaining data integrity and providing excellent user experience. 
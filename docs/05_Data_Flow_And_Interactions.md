# Data Flow and System Interactions

This document illustrates key data flows and interactions between the frontend, Supabase backend (Database, Auth, Storage, Edge Functions), and external services like Stripe and AI models.

## Flow 1: User Registration

1.  **Frontend (`SignUpForm.tsx`)**: User enters email and password.
2.  **Frontend**: Calls `supabase.auth.signUp({ email, password })`.
3.  **Supabase Auth**: Creates a new user in `auth.users` table.
4.  **Supabase Auth**: (Typically) Sends a confirmation email to the user.
5.  **(Post-confirmation / Optional Trigger)**:
    *   A Supabase Database Trigger on `auth.users` table (for new inserts) OR a custom function called after successful sign-up on the client-side could create a corresponding record in the public `users` table.
    *   This new record in `users` would have `user_id` (from `auth.users.id`), `email`, default `generation_limit` (e.g., 10 for a free tier), and `generations_used` (0).
6.  **Frontend**: Redirects to a confirmation page or login page.

## Flow 2: User Login

1.  **Frontend (`LoginForm.tsx`)**: User enters email and password.
2.  **Frontend**: Calls `supabase.auth.signInWithPassword({ email, password })`.
3.  **Supabase Auth**: Verifies credentials, creates a session, and returns session data (including JWT).
4.  **Frontend (`AuthProvider` in `src/supabase/auth.tsx`)**: Stores session, updates user state.
5.  **Frontend**: User can now access protected routes. Subsequent API calls to Supabase (database, storage, functions) from the client will include the JWT for authentication and RLS enforcement.

## Flow 3: Viewing Pricing Plans (Homepage & Upgrade Dialog)

1.  **Frontend (`home.tsx` or `PricingSection.tsx`)**: Component mounts or is displayed.
2.  **Frontend**: Checks `localStorage` for cached plans data (`pricingPlans` and `pricingPlansTimestamp`).
    *   **Cache Hit (Valid)**: Uses cached data to display plans.
    *   **Cache Miss (or Expired)**: Proceeds to fetch from API.
3.  **Frontend**: Calls `supabase.functions.invoke('get-plans')` (or the correctly named alias like `supabase-functions-get-plans`).
4.  **Supabase Edge Function (`get-plans`)**: Receives the request.
    *   Uses `STRIPE_SECRET_KEY` to initialize Stripe client.
    *   Calls `stripe.prices.list({ active: true, expand: ['data.product'] })` to fetch active prices and associated product details.
    *   Returns a JSON array of Stripe Price objects.
5.  **Frontend**: Receives the plan data.
    *   Stores the fetched data in `localStorage` with a new timestamp.
    *   Updates component state with plan data (`allPlans`).
    *   Renders the pricing cards:
        *   Plan names are determined client-side (e.g., based on `plan.amount` or `plan.id` mapped to `planNames` object).
        *   Features are determined client-side (e.g., `getPlanFeatures(plan.id)` in `home.tsx` or based on `plan.amount` in `PricingSection.tsx`).

## Flow 4: File Upload, Processing, and Result Display (`UploadPage.tsx`)

1.  **Frontend**: User selects/drops a PDF file.
    *   Client-side validation (type, size).
    *   User usage (`generations_used`, `generation_limit`) is fetched from the Supabase `users` table to check if the user can upload.
    *   If limit reached, upload is disabled, and an upgrade dialog is shown (see Flow 3 for dialog plan display).
2.  **Frontend**: User clicks "Extract COA Data" (short or long analysis).
    *   `handleUpload` / `handleUploadLong` function is triggered.
    *   UI status set to `'uploading'`.
3.  **Frontend (`uploadToSupabase` function)**:
    *   **Upload to Storage**: File is uploaded to Supabase Storage (`labresults` bucket) under `<user_id>/<timestamp>-<filename>.pdf`.
    *   **DB Insert**: A new record is inserted into `lab_results` table with `user_id`, `file_name`, `storage_path`, and `status: 'pending'`.
The `id` of this new record (`labResultId`) is retrieved.
    *   **Update Usage**: `generations_used` for the user in the `users` table is incremented.
    *   **Update Status**: The `lab_results` record status is updated to `'processing'` for `labResultId`.
    *   **Invoke Edge Function**: `supabase.functions.invoke('process-lab-result' or 'process-lab-result-long', { body: { pdfStoragePath, labResultId } })` is called.
4.  **Supabase Edge Function (`process-lab-result` / `-long`)**: Receives `pdfStoragePath` and `labResultId`.
    *   Downloads the PDF from `pdfStoragePath` in Supabase Storage.
    *   Extracts text from the PDF.
    *   Sends extracted text to an AI/LLM service (e.g., OpenAI via `OPENAI_API_KEY`) with a specific prompt.
    *   Receives the generated description.
    *   Updates the `lab_results` table for `labResultId`: sets `description` to the AI output and `status` to `'completed'`.
    *   If any error occurs, updates `status` to `'error'`.
5.  **Frontend (Polling - `fetchDescription` function)**:
    *   While UI status is `'processing'`, the frontend polls the `lab_results` table every few seconds for the record matching `currentLabResultId`.
    *   Checks the `status` and `description` fields.
    *   **If `status` is `'completed'`**: Fetches `description`, displays it, and sets UI status to `'complete'`.
    *   **If `status` is `'error'`**: Displays an error message, sets UI status to `'failed'`.
    *   **If polling times out**: Displays a timeout message.

## Flow 5: User Subscribes to a Plan (Stripe Checkout)

1.  **Frontend (`home.tsx` or `PricingSection.tsx` in `UploadPage.tsx` dialog)**: User clicks "Choose Plan" or "Upgrade".
2.  **Frontend (`handleCheckout` / `initiateCheckout`)**: Calls `supabase.functions.invoke('create-checkout', { body: { price_id, user_id, return_url }, headers: { 'X-Customer-Email': user.email } })`.
    *   `price_id`: The Stripe Price ID of the selected plan.
    *   `user_id`: The authenticated user's ID.
    *   `return_url`: URL to redirect to after checkout (e.g., `/profile`).
3.  **Supabase Edge Function (`create-checkout`)**: Receives the request.
    *   Initializes Stripe client (`STRIPE_SECRET_KEY`).
    *   Fetches the user's `stripe_customer_id` from the Supabase `users` table. If none, creates a new Stripe Customer and saves the ID to the `users` table.
    *   Creates a Stripe Checkout Session with `customer`, `price_id`, `mode: 'subscription'`, `success_url`, `cancel_url`, and `metadata` (including `user_id`).
    *   Returns the `session.url` to the frontend.
4.  **Frontend**: Receives the Stripe Checkout Session URL.
5.  **Frontend**: Redirects the browser to `session.url`.
6.  **Stripe**: User completes the payment on Stripe's hosted checkout page.
7.  **Stripe**: Redirects the user to the `success_url` (e.g., `/profile?session_id={CHECKOUT_SESSION_ID}`).
8.  **(Webhook - Asynchronous)**: Stripe sends a `checkout.session.completed` event (and other subscription events) to the `payments-webhook` Edge Function.

## Flow 6: Stripe Webhook Processing (`payments-webhook`)

1.  **Stripe**: Sends an event (e.g., `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`) to the configured webhook URL pointing to the `payments-webhook` Edge Function.
2.  **Supabase Edge Function (`payments-webhook`)**: Receives the HTTP POST request from Stripe.
    *   Verifies the Stripe signature using `Stripe-Signature` header and `STRIPE_WEBHOOK_SECRET`.
    *   Parses the event object.
    *   **Handles `checkout.session.completed`**:
        *   Extracts `stripe_customer_id`, `subscription_id`, and `user_id` (from metadata).
        *   Updates the Supabase `users` table for the `user_id`: sets `stripe_customer_id`, `current_plan_id` (from the subscription's price ID), `subscription_status` to `'active'`, updates `generation_limit` based on the new plan, and resets `generations_used`.
    *   **Handles `customer.subscription.updated`**:
        *   Extracts Stripe `customer_id`, new `plan.id` (Price ID), and `status`.
        *   Finds user by `stripe_customer_id` in `users` table.
        *   Updates `current_plan_id`, `subscription_status`, `generation_limit`.
        *   Resets `generations_used` if a new billing period starts.
    *   **Handles `customer.subscription.deleted`**:
        *   Extracts Stripe `customer_id`.
        *   Finds user by `stripe_customer_id`.
        *   Updates `subscription_status` to `'canceled'`, sets `current_plan_id` to `null`, and adjusts `generation_limit` (e.g., to a free tier level).
    *   Uses a Supabase admin client (with service role key) for database updates if necessary.
    *   Returns a `200 OK` response to Stripe to acknowledge event receipt.
3.  **Supabase Database (`users` table)**: User's subscription details, plan limits, and usage are now synchronized with Stripe.
4.  **Frontend**: On subsequent loads (e.g., `ProfilePage.tsx`, `UploadPage.tsx`), fetches the updated user data from the Supabase `users` table, reflecting the new subscription status and limits.

These flows illustrate the interplay between the user interface, client-side logic, Supabase backend services, and external APIs, forming the complete operational cycle of the StrainInsights application. 
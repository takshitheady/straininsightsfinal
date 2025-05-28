# Supabase Setup Guide for StrainInsights

This guide walks through the steps to set up a Supabase project similar to the one used by the StrainInsights application.

## 1. Prerequisites

-   A Supabase account ([supabase.com](https://supabase.com))
-   Supabase CLI installed and configured ([Supabase CLI Docs](https://supabase.com/docs/guides/cli))
-   Node.js and npm (or yarn) for frontend development.
-   A Stripe account for payment processing.
-   (Optional) An account with an AI/LLM provider (e.g., OpenAI) if you intend to replicate the COA processing logic.

## 2. Create a New Supabase Project

1.  Go to your Supabase dashboard.
2.  Click "New project".
3.  Choose your organization, provide a project name (e.g., `straininsights-clone`), generate a strong database password (and save it securely), and select a region.
4.  Wait for the project to be provisioned.

## 3. Database Schema Setup

Once the project is ready, navigate to the "Table Editor" in your Supabase dashboard or use SQL migrations with the Supabase CLI.

### 3.1. `users` Table

This table complements the built-in `auth.users` table.

-   **Name**: `users`
-   **Columns**:
    -   `user_id`: Type `uuid`. Set as Primary Key. Set as Foreign Key to `auth.users.id` with `ON UPDATE CASCADE` and `ON DELETE CASCADE` actions.
    -   `email`: Type `text`. Can be nullable if you don't always duplicate it from `auth.users`.
    -   `stripe_customer_id`: Type `text`. Nullable.
    -   `current_plan_id`: Type `text`. Nullable. (This would be a **live** Stripe Price ID in production, e.g., `price_1RTkaDDa07Wwp5KNnZF36GsC`).
    -   `subscription_status`: Type `text`. Nullable.
    -   `generations_used`: Type `int4` (integer). Default value `0`.
    -   `generation_limit`: Type `int4` (integer). Default value (e.g., `10` for a free tier, or a higher value if you have default paid plans).
    -   `created_at`: Type `timestamptz`. Default value `now()`.
    -   `updated_at`: Type `timestamptz`. Default value `now()`.

### 3.2. `lab_results` Table

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

### 3.3. Row Level Security (RLS)

RLS is critical for protecting user data. Enable RLS for both `users` and `lab_results` tables.

**Example RLS Policy for `users` table (Allow users to manage their own profile):**

-   **Policy Name**: `Allow individual user access to their own data`
-   **Target Roles**: `authenticated`
-   **Command**: `ALL` (or select specific ones like `SELECT`, `UPDATE`)
-   **USING expression**: `auth.uid() = user_id`
-   **WITH CHECK expression**: `auth.uid() = user_id`

**Example RLS Policies for `lab_results` table (Allow users to manage their own lab results):**

-   **Policy Name**: `Allow individual user CRUD on their lab_results`
-   **Target Roles**: `authenticated`
-   **Command**: `ALL`
-   **USING expression**: `auth.uid() = user_id`
-   **WITH CHECK expression**: `auth.uid() = user_id`

*Note: You might also need a policy to allow service roles (used by Edge Functions) to bypass RLS or have broader access if they need to operate on data across users (e.g., an admin function). However, for user-initiated actions, RLS scoped to `auth.uid()` is standard.* Consider if new users can insert into the `users` table or if that's handled by a trigger/function after sign-up.

## 4. Authentication Setup

-   Navigate to "Authentication" -> "Providers" in your Supabase dashboard.
-   Email/Password provider is enabled by default. Configure other providers if needed.
-   Under "Authentication" -> "Settings", you can configure email templates, redirect URLs, etc.
    -   **Site URL**: Set this to your frontend deployment URL (e.g., `http://localhost:5174` for local dev, or your **production URL** for live).
    -   **Additional Redirect URLs**: Add any other URLs your app might redirect to after authentication, ensuring production URLs are used for the live environment.

## 5. Storage Setup

1.  Navigate to "Storage" in your Supabase dashboard.
2.  Click "New bucket".
3.  **Bucket name**: `labresults`.
4.  **Public bucket**: Decide if the bucket should be public. For user-uploaded COAs, it's generally better to keep it private and control access via Storage Policies.
5.  **Configure Storage Policies** for the `labresults` bucket.
    Example Policies:
    -   **Allow authenticated users to upload their own files:**
        -   `Allowed operations`: `insert`
        -   `Target roles`: `authenticated`
        -   `Policy definition` (SQL): `bucket_id = 'labresults' AND auth.uid()::text = (storage.foldername(name))[1]` (This policy assumes files are stored in a folder named after the user's ID, e.g., `<user_id>/file.pdf`)
    -   **Allow authenticated users to read their own files:**
        -   `Allowed operations`: `select`
        -   `Target roles`: `authenticated`
        -   `Policy definition` (SQL): `bucket_id = 'labresults' AND auth.uid()::text = (storage.foldername(name))[1]`
    -   *Adjust these policies based on your exact file path structure and security needs.* If Edge Functions need to access these files using a service role key, they usually bypass these user-level policies.

## 6. Edge Functions Setup

1.  **Initialize Supabase locally** (if not already done for your project clone):
    ```bash
    supabase init
    ```
2.  **Link your local project to your Supabase project**:
    ```bash
    supabase login
    supabase link --project-ref <YOUR_PROJECT_ID>
    ```
    Replace `<YOUR_PROJECT_ID>` with your actual Supabase project ID (from project settings).
3.  **Create Edge Functions**: The functions (`supabase-functions-get-plans`, `create-checkout`, `process-lab-result`, `payments-webhook`, etc.) are located in the `supabase/functions/` directory. Each function is typically in its own sub-directory with an `index.ts` file.

    Example structure:
    ```
    supabase/
      functions/
        supabase-functions-get-plans/
          index.ts
        process-lab-result/
          index.ts
        ...
    ```

4.  **Environment Variables for Functions**:
    -   Go to "Project Settings" -> "Functions" in your Supabase dashboard.
    -   Add necessary environment variables (secrets) that your Edge Functions will use. **For a live/production environment, ensure you use your LIVE Stripe keys.**
        -   `STRIPE_SECRET_KEY`: Your **live** Stripe secret key (e.g., `sk_live_...`).
        -   `STRIPE_WEBHOOK_SECRET`: Your **live** Stripe webhook signing secret (obtained when creating the live webhook endpoint in Stripe).
        -   `OPENAI_API_KEY` (or similar): API key for your AI service.
        -   The Supabase URL and Anon Key are usually available by default to functions, but for some operations (like using the admin client), you might need `SUPABASE_SERVICE_ROLE_KEY`.

5.  **Deploy Functions**:
    ```bash
    supabase functions deploy <function_name>
    ```
    Or deploy all functions:
    ```bash
    supabase functions deploy
    ```
    *Ensure Deno is installed if you are testing functions locally or if your CLI version requires it explicitly.*

## 7. Stripe Setup

**Important Note for Live Environment**: When transitioning from a test/sandbox environment to a live production environment, all Stripe entities (Products, Prices, API Keys, Webhook Endpoints) must be recreated or switched to their live mode equivalents within your Stripe dashboard. Live entities will have different IDs than their test counterparts.

1.  **Create Products and Prices in Stripe (Live Mode)**:
    -   Log in to your **live** Stripe Dashboard.
    -   Go to "Products" and create products for your plans (e.g., "Basic Plan", "Premium Plan").
    -   For each product, create one or more prices (e.g., a monthly recurring price). Note the **live Price IDs** (e.g., `price_live_xxxxxxxxxxxx`). These live IDs are used by your application (`current_plan_id` in `users` table, and for checkout). If you use a frontend mapping for plan names (like `planNames`), ensure it uses these live Price IDs.
    -   When creating prices or products, you can configure if they are eligible for promotion codes under their respective settings in the Stripe dashboard if you intend to use coupons.
2.  **API Keys (Live Mode)**: Get your **live** Stripe API keys (Publishable Key for frontend, Secret Key for backend/Edge Functions) from the Stripe Dashboard under "Developers" -> "API keys".
3.  **Webhook Endpoint (Live Mode)**: For the `payments-webhook` Edge Function:
    -   In your Supabase dashboard, get the URL for your deployed `payments-webhook` function (this URL is usually static, like `https://<YOUR_PROJECT_ID>.supabase.co/functions/v1/payments-webhook`).
    -   In your **live** Stripe Dashboard, go to "Developers" -> "Webhooks".
    -   Click "Add endpoint". **You must create a new endpoint for live mode; you cannot reuse a sandbox endpoint.**
    -   Paste the Edge Function URL as the "Endpoint URL".
    -   Select the events to listen for (e.g., `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`).
    -   Note the **Signing secret** for this **live** webhook endpoint. You'll set this as `STRIPE_WEBHOOK_SECRET` (the live version) in your Supabase function settings.

## 8. Frontend Configuration

1.  **Install Dependencies**:
    ```bash
    npm install # or yarn install
    ```
2.  **Environment Variables for Frontend (Live Mode)**:
    Create a `.env` file (or configure environment variables in your deployment platform) in the root of your frontend project with your Supabase URL, Anon Key, and **live Stripe Publishable Key**:
    ```
    VITE_SUPABASE_URL=https://<YOUR_PROJECT_ID>.supabase.co
    VITE_SUPABASE_ANON_KEY=<YOUR_SUPABASE_ANON_KEY>
    VITE_STRIPE_PUBLISHABLE_KEY=<YOUR_LIVE_STRIPE_PUBLISHABLE_KEY> # e.g., pk_live_...
    ```
    Replace placeholders with your actual Supabase project URL, Anon Key (from Project Settings -> API in your Supabase dashboard), and your live Stripe Publishable Key.
3.  **Update Supabase Client**: Ensure `src/supabase/supabase.ts` is correctly initialized with these environment variables.
4.  **Production Redirect URLs**: Ensure that the `return_url` used when creating Stripe checkout sessions (typically in `home.tsx` or `stripeUtils.ts`) points to your production domain (e.g., `https://yourdomain.com/profile`).

## 9. Testing

-   Test user sign-up and login.
-   Test file uploads and check if records are created in `lab_results` and files appear in Storage.
-   Test the Stripe checkout flow (use Stripe's test card numbers).
-   Verify that webhooks are correctly updating the `users` table in Supabase after subscription changes.
-   Check browser console and Supabase function logs for errors.

This guide provides a comprehensive overview of setting up Supabase for an application like StrainInsights. Remember to consult the official Supabase and Stripe documentation for more detailed information on specific features and configurations. 
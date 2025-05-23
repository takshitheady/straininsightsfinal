# Backend Architecture: Supabase

This document details the backend architecture of the StrainInsights application, which is powered by Supabase.

## 1. Overview

Supabase provides the core backend services for the application, including database, authentication, file storage, and serverless functions (Edge Functions). This BaaS (Backend as a Service) model allows for rapid development by abstracting away much of the traditional backend infrastructure management.

## 2. Supabase Services Used

-   **PostgreSQL Database**: For storing application data such as user profiles, lab result metadata, and subscription details.
-   **Authentication**: Manages user sign-up, login, and session management.
-   **Storage**: Used for storing uploaded PDF files (Certificates of Analysis).
-   **Edge Functions**: Serverless TypeScript functions for handling business logic that requires a secure environment or interaction with third-party services like Stripe and AI models.

## 3. Database Schema

Key tables in the Supabase PostgreSQL database:

### 3.1. `users` Table

This table stores information about registered users, extending the default Supabase `auth.users` table.

-   `user_id` (UUID, Primary Key, Foreign Key to `auth.users.id`): Supabase Auth User ID.
-   `email` (TEXT): User's email address (can be synced or duplicated from `auth.users`).
-   `stripe_customer_id` (TEXT, Nullable): Stripe Customer ID for managing subscriptions.
-   `current_plan_id` (TEXT, Nullable): The Stripe Price ID of the user's current active subscription plan (e.g., `price_1RDlb8IxCwq8UET9kVsVYIsN`).
-   `subscription_status` (TEXT, Nullable): Status of the user's Stripe subscription (e.g., `active`, `canceled`, `past_due`).
-   `generations_used` (INTEGER, Default: 0): Number of COA processing generations used by the user in the current billing cycle or based on their plan.
-   `generation_limit` (INTEGER, Default: 10): The maximum number of generations allowed for the user based on their plan. (e.g., Basic: 100, Premium: 500. Default 10 might be for a free tier or initial state).
-   `created_at` (TIMESTAMPTZ, Default: `now()`)
-   `updated_at` (TIMESTAMPTZ, Default: `now()`)

*Note: The default `generation_limit` for new users might be set via a trigger or default value during user profile creation, often corresponding to a free or trial tier.*

### 3.2. `lab_results` Table

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

## 4. Authentication

-   Supabase Auth is used for user registration (sign-up) and login.
-   It supports email/password authentication.
-   The frontend interacts with Supabase Auth using the `supabase-js` client library.
-   The `src/supabase/auth.tsx` file provides a React context (`AuthProvider`) for managing user sessions and providing authentication status to components.
-   RLS policies in the database are tied to `auth.uid()` to enforce data access rules.

## 5. Storage

-   Supabase Storage is used to store the PDF files (COAs) uploaded by users.
-   A bucket named `labresults` is used.
-   Files are stored with a path structure like `<user_id>/<timestamp>-<filename>.pdf` to ensure uniqueness and organization.
-   Access to files in the bucket is controlled by Storage policies, typically allowing authenticated users to upload and read their own files.
-   The frontend uploads files directly to this bucket after the user selects a file.

## 6. Edge Functions

Serverless TypeScript functions deployed on Supabase. They handle backend logic and interact with third-party services.

-   **Location**: Stored in the `supabase/functions/` directory in the project.
-   **Deployment**: Deployed via the Supabase CLI (`supabase functions deploy <function_name>`).
-   **Invocation**: Called from the frontend client using `supabase.functions.invoke('<function_name>', { body: ... })`.

Key Edge Functions:

-   **`supabase-functions-get-plans`**: Retrieves active pricing plans from Stripe.
-   **`supabase-functions-create-checkout`**: Creates a Stripe Checkout Session for a user to subscribe to a plan.
-   **`process-lab-result` / `process-lab-result-long`**: The core COA processing functions. They:
    -   Are triggered after a file is uploaded and its metadata is saved.
    -   Fetch the PDF from Supabase Storage.
    -   Extract text from the PDF.
    -   (Presumably) Call an external AI/LLM service to generate a description/analysis based on the extracted text.
    -   Update the corresponding record in the `lab_results` table with the generated `description` and set `status` to `'completed'` or `'error'`.
-   **`payments-webhook`**: A Stripe webhook handler.
    -   Listens for events from Stripe (e.g., `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`).
    -   Updates the `users` table in Supabase with the latest subscription status, `current_plan_id`, `stripe_customer_id`, and potentially resets `generations_used` or updates `generation_limit` based on the new plan.

(Detailed descriptions of each Edge Function are in `docs/04_Edge_Functions_InDepth.md`)

## 7. Environment Variables

Supabase Edge Functions and the Supabase project itself rely on environment variables for configuration, especially for API keys.

-   `STRIPE_SECRET_KEY`: Stripe secret API key (for backend functions).
-   `STRIPE_WEBHOOK_SECRET`: Stripe webhook signing secret for verifying webhook events.
-   `OPENAI_API_KEY` (or similar for other AI services): API key for the AI service used in `process-lab-result` functions.
-   Supabase URL and Anon Key: Used by the frontend client and Edge Functions to interact with Supabase services. These are typically set automatically within the Supabase environment for functions, and in `.env` files for local frontend development.

## 8. Security Considerations

-   **Row Level Security (RLS)**: Implemented on Supabase tables (`users`, `lab_results`) to ensure users can only access their own data.
-   **Storage Policies**: Configured for the `labresults` bucket to control file access.
-   **Environment Variable Management**: API keys and secrets are stored as environment variables in Supabase, not hardcoded.
-   **Webhook Security**: Stripe webhook endpoints verify signatures to prevent malicious requests.
-   **Input Validation**: Edge Functions should validate inputs received from the client.

This architecture leverages Supabase's integrated services to provide a robust and scalable backend with minimal operational overhead. 
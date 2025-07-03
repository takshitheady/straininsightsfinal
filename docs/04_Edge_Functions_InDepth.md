# Supabase Edge Functions: In-Depth

This document provides a detailed look into the Supabase Edge Functions used in the StrainInsights application.

Edge Functions are serverless TypeScript functions that run on Deno. They are used for backend logic, interacting with third-party APIs (like Stripe and AI services), and performing operations that require a secure environment.

## Common Setup for Edge Functions

-   **Location**: `supabase/functions/<function-name>/index.ts`
-   **CORS Headers**: Most functions include CORS headers to allow requests from the frontend. A common pattern is:
    ```typescript
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*', // Or your specific frontend domain for production
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    };
    // ...
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }
    ```
-   **Error Handling**: Functions typically include `try...catch` blocks to handle errors gracefully and return appropriate JSON responses with error messages and status codes.
-   **Stripe Client**: Functions interacting with Stripe initialize the Stripe SDK:
    ```typescript
    import Stripe from "https://esm.sh/stripe@<version>?target=deno";
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
        apiVersion: '2023-10-16', // Or your target API version
        httpClient: Stripe.createFetchHttpClient(),
    });
    // Note: For production, STRIPE_SECRET_KEY must be the live secret key from Stripe.
    ```
-   **Supabase Client**: For database interactions, functions might use the Supabase client, often with a service role key for elevated privileges if necessary.

## 1. `get-plans` (Enhanced)

-   **File**: `supabase/functions/get-plans/index.ts`
-   **Purpose**: To fetch active pricing plans from Stripe with enhanced plan details and correct pricing information.
-   **Trigger**: Called by the frontend (e.g., `PricingSection.tsx`, `home.tsx`) when pricing information is needed.
    ```javascript
    // Frontend invocation example
    const { data, error } = await supabase.functions.invoke("get-plans"); 
    ```
-   **Logic**:
    1.  Handles CORS preflight (`OPTIONS`) requests.
    2.  Initializes the Stripe client using `STRIPE_SECRET_KEY` (live key in production).
    3.  Calls `stripe.prices.list({ active: true, expand: ['data.product'] })` to retrieve active prices and associated product details.
    4.  Returns the list of plan/price objects as a JSON response with enhanced metadata.
-   **Key Environment Variables**: `STRIPE_SECRET_KEY` (Live key for production).
-   **Returns**: A JSON array of Stripe Price objects with enhanced plan information.
    ```json
    // Example structure with correct pricing
    [
      {
        "id": "price_1RTkaDDa07Wwp5KNnZF36GsC", // Basic Plan Price ID
        "object": "price",
        "active": true,
        "amount": 3900, // $39.00 in cents
        "currency": "usd",
        "interval": "month",
        "product": "prod_SOXfKdwnyRuvc3", // Product ID or expanded Product object
        "nickname": "Basic Plan",
        "generation_limit": 30
      },
      {
        "id": "price_1RTka9Da07Wwp5KNiRxFGnsG", // Pro Plan Price ID
        "object": "price",
        "active": true,
        "amount": 9900, // $99.00 in cents
        "currency": "usd",
        "interval": "month",
        "product": "prod_SOXfKdwnyRuvc4", // Product ID or expanded Product object
        "nickname": "Pro Plan",
        "generation_limit": 100
      }
    ]
    ```

## 2. `create-checkout` (Enhanced)

-   **File**: `supabase/functions/create-checkout/index.ts`
-   **Purpose**: To create Stripe Checkout Sessions with enhanced support for upgrades, renewals, and plan selection.
-   **Trigger**: Called by the frontend from multiple sources:
    - Profile page billing management
    - Pricing section plan selection
    - Upgrade dialogs
    ```javascript
    // Frontend invocation example
    const { data, error } = await supabase.functions.invoke(
      "create-checkout",
      {
        body: {
          price_id: "price_1RTkaDDa07Wwp5KNnZF36GsC", // Live Price ID
          user_id: "auth_user_id_xxxx",
          return_url: `${window.location.origin}/profile`,
          checkout_type: "upgrade" // or "renewal", "new_subscription"
        },
        headers: {
          "X-Customer-Email": "user@example.com"
        }
      }
    );
    ```
-   **Enhanced Logic**:
    1.  Handles CORS and input validation.
    2.  Extracts `price_id`, `user_id`, `return_url`, and `checkout_type` from the request body.
    3.  Initializes Stripe client (using live `STRIPE_SECRET_KEY` in production).
    4.  **Customer Management**: 
        - Retrieves or creates Stripe customer
        - Links customer to user account
        - Handles existing subscription scenarios
    5.  **Checkout Session Creation** with enhanced features:
        -   `customer`: The Stripe Customer ID
        -   `payment_method_types`: [`'card'`]
        -   `line_items`: Contains the correct Price ID and quantity
        -   `mode`: `'subscription'`
        -   `success_url`: Points to production frontend URL with session tracking
        -   `cancel_url`: Proper fallback URL
        -   `allow_promotion_codes`: `true` (enables coupon/discount codes)
        -   `metadata`: Enhanced metadata for webhook processing:
            ```typescript
            metadata: {
              user_id: user_id,
              checkout_type: checkout_type,
              previous_plan: currentPlanId,
              timestamp: new Date().toISOString()
            }
            ```
    6.  Returns the Stripe Checkout Session URL with additional metadata.
-   **Key Environment Variables**: `STRIPE_SECRET_KEY` (Live key for production).
-   **Enhanced Features**:
    - Support for upgrade/renewal/new subscription flows
    - Proper customer management
    - Enhanced metadata for webhook processing
    - Validation of plan transitions
-   **Returns**: `{ "url": "<stripe_checkout_session_url>", "session_id": "<session_id>" }`

## 3. `process-lab-result` / `process-lab-result-long`

-   **File**: `supabase/functions/process-lab-result/index.ts` and `supabase/functions/process-lab-result-long/index.ts`.
-   **Purpose**: To process an uploaded COA PDF: extract text, generate an SEO-friendly description using an AI model, and save the result.
-   **Trigger**: Called by the frontend (`uploadToSupabase` function in `UploadPage.tsx`) after a file is successfully uploaded to Supabase Storage and its initial metadata record is created in `lab_results` with `status: 'processing'`.
    ```javascript
    // Frontend invocation example
    const { error: functionError } = await supabase.functions.invoke(
      isLongAnalysis ? 'process-lab-result-long' : 'process-lab-result',
      {
        body: {
          pdfStoragePath: "user_id/timestamp-filename.pdf",
          labResultId: "uuid_for_lab_results_record"
        }
      }
    );
    ```
-   **Logic**:
    1.  Handles CORS.
    2.  Extracts `pdfStoragePath` and `labResultId` from the request body.
    3.  **Download PDF**: Downloads the PDF file from Supabase Storage using the `pdfStoragePath`.
        ```typescript
        // Example using Supabase client (service role might be needed for direct access)
        // const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
        // const { data: fileData, error: downloadError } = await supabaseAdmin.storage.from('labresults').download(pdfStoragePath);
        ```
    4.  **PDF Text Extraction**: Uses a PDF parsing library (e.g., `pdf-parse` adapted for Deno, or a WASM-based solution) to extract raw text from the downloaded PDF buffer.
    5.  **AI Content Generation**:
        a.  Initializes an AI client (e.g., OpenAI) using `OPENAI_API_KEY`.
        b.  Constructs a prompt for the AI model, including the extracted text and instructions to generate an SEO-friendly description. The prompt might differ between the short and long analysis versions.
        c.  Sends the prompt to the AI model (e.g., GPT-3.5-turbo, GPT-4).
        d.  Receives the generated description from the AI.
    6.  **Update Database**: Updates the `lab_results` table for the given `labResultId`:
        -   Sets `description` to the AI-generated content.
        -   Sets `status` to `'completed'`.
        -   Optionally saves `raw_text`.
    7.  If any step fails (download, parsing, AI call, DB update), it updates the `lab_results` record `status` to `'error'` and logs the error.
    8.  Returns a success or error JSON response. The frontend typically relies on polling the `lab_results` table for the final status and description, so the function's direct return might just confirm invocation.
-   **Key Environment Variables**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (if admin client is used), `OPENAI_API_KEY` (or equivalent for other AI services).
-   **Interactions**:
    -   Reads files from Supabase Storage (`labresults` bucket).
    -   Writes `description`, `status`, `raw_text` to the `lab_results` table.
    -   Calls external AI/LLM API.
-   **Returns**: Typically a simple success/error message, as the main result is written to the database and polled by the frontend.
    ```json
    // Example success
    { "message": "Processing initiated for labResultId: <uuid>" }
    // Example error during function execution (before DB update to 'error')
    { "error": "Failed to process PDF: <reason>" }
    ```

## 4. `payments-webhook` (Enhanced)

-   **File**: `supabase/functions/payments-webhook/index.ts`
-   **Purpose**: Enhanced webhook handler for Stripe events with generation preservation and smart subscription management.
-   **Trigger**: Triggered by Stripe when specific events occur (configured in Stripe webhook settings for the live environment).
-   **Enhanced Logic**:
    1.  Handles CORS (though less critical for webhooks, still good practice for testing).
    2.  **Verify Stripe Signature**: Crucial for security. Reads the `Stripe-Signature` header and the raw request body. Uses `stripe.webhooks.constructEvent` with the live `STRIPE_WEBHOOK_SECRET` (from environment variables) to verify the event's authenticity.
        ```typescript
        // const signature = req.headers.get('Stripe-Signature');
        // const body = await req.text(); // Raw body
        // let event;
        // try {
        //   event = stripe.webhooks.constructEvent(body, signature, Deno.env.get('STRIPE_WEBHOOK_SECRET'));
        // } catch (err) {
        //   return new Response(`Webhook Error: ${err.message}`, { status: 400 });
        // }
        // Note: For production, STRIPE_WEBHOOK_SECRET must be the live webhook signing secret from Stripe.
        ```
    3.  **Enhanced Event Handling**: Uses a `switch` statement on `event.type` with improved logic:
        
        -   **`checkout.session.completed`**: Occurs when a user successfully completes a Stripe Checkout Session.
            -   Extract `stripe_customer_id` and `subscription_id` from the session object (`event.data.object`).
            -   Extract `user_id` and `checkout_type` from session `metadata`.
            -   **Generation Preservation Logic**: 
                ```typescript
                // Get current user data to preserve unused generations
                const { data: currentUserData } = await supabaseClient
                  .from('users')
                  .select('current_plan_id, generation_limit, generations_used')
                  .eq('id', userToUpdate.id)
                  .single();

                let newGenerationLimit = generationLimit;
                let newGenerationsUsed = 0;

                // If user has unused generations, preserve them
                if (currentUserData && currentUserData.generations_used < currentUserData.generation_limit) {
                  const unusedGenerations = currentUserData.generation_limit - currentUserData.generations_used;
                  newGenerationLimit = generationLimit + unusedGenerations;
                  newGenerationsUsed = unusedGenerations;
                }
                ```
            -   Update the `users` table with preserved generations and new plan information.
            -   Create subscription record in `subscriptions` table for detailed tracking.
        
        -   **`customer.subscription.created` / `customer.subscription.updated`**: Enhanced subscription change handling.
            -   Extract subscription details including `plan.id` (Stripe Price ID) and `status`.
            -   **Smart Plan Detection**: Map Stripe Price IDs to plan names:
                ```typescript
                const priceIdToPlanName = {
                  'price_1RTkaDDa07Wwp5KNnZF36GsC': 'basic',
                  'price_1RTka9Da07Wwp5KNiRxFGnsG': 'pro'
                };
                ```
            -   **Generation Limit Mapping**: Set correct generation limits:
                ```typescript
                const planToGenerationLimit = {
                  'basic': 30,
                  'pro': 100,
                  'free': 10
                };
                ```
            -   Apply generation preservation logic for plan changes.
            -   Update both `users` and `subscriptions` tables.
        
        -   **`customer.subscription.deleted`**: Enhanced cancellation handling.
            -   Extract `customer` (Stripe Customer ID) and `status`.
            -   Find the user by `stripe_customer_id`.
            -   Set `subscription_status` to `'canceled'`.
            -   Set `current_plan_id` to `'free'` (downgrade to free plan).
            -   Set `generation_limit` to free tier limit (10).
            -   Preserve any unused generations up to the free tier limit.
        
        -   **`invoice.payment_succeeded`**: Handle successful recurring payments.
            -   Confirm ongoing subscription payments.
            -   Reset `generations_used` for new billing period if applicable.
            -   Update subscription period information.
        
        -   **`invoice.payment_failed`**: Handle failed payments.
            -   Update subscription status to reflect payment issues.
            -   Potentially restrict access based on payment failure policies.
    
    4.  **Enhanced Database Operations**:
        -   **Atomic Updates**: Use transactions for complex operations.
        -   **Fallback Mechanisms**: SQL functions for direct database updates if needed.
        -   **Detailed Logging**: Comprehensive logging for debugging and monitoring.
    
    5.  Returns a `200 OK` response to Stripe to acknowledge receipt of the event.

-   **Key Environment Variables**: 
    - `STRIPE_SECRET_KEY` (Live key)
    - `STRIPE_WEBHOOK_SECRET` (Live key)
    - `SUPABASE_URL`
    - `SUPABASE_SERVICE_ROLE_KEY` (for Supabase admin client)

-   **Enhanced Features**:
    - **Generation Preservation**: Unused generations are preserved across plan changes
    - **Smart Plan Management**: Proper handling of upgrades, downgrades, and renewals
    - **Detailed Subscription Tracking**: Comprehensive subscription state management
    - **Error Handling**: Robust error handling with fallback mechanisms
    - **Audit Trail**: Detailed logging for subscription changes

-   **Interactions**:
    -   Reads/writes to the `users` table in Supabase with generation preservation
    -   Manages the `subscriptions` table for detailed subscription tracking
    -   Interacts with the Stripe API using live keys
    -   Calls SQL functions for atomic database operations

-   **Returns**: `200 OK` to Stripe with detailed response body for debugging:
    ```json
    {
      "received": true,
      "event_type": "checkout.session.completed",
      "user_updated": true,
      "generations_preserved": 5,
      "new_plan": "pro",
      "timestamp": "2024-01-01T00:00:00Z"
    }
    ```

## 5. Recent Enhancements

### 5.1. Generation Preservation System
- **Smart Logic**: Preserves unused generations when users upgrade or renew plans
- **Fair Billing**: Users don't lose value when changing plans
- **Atomic Operations**: Database transactions ensure data consistency

### 5.2. Enhanced Subscription Management
- **Multi-Plan Support**: Proper handling of Basic ($39) and Pro ($99) plans
- **Status Management**: Smart account status determination based on plan types
- **Subscription Tracking**: Detailed subscription state management

### 5.3. Improved Error Handling
- **Fallback Mechanisms**: SQL functions for direct database updates
- **Comprehensive Logging**: Detailed logging for debugging and monitoring
- **Graceful Degradation**: Proper error handling with user-friendly responses

### 5.4. Security Enhancements
- **Webhook Verification**: Proper signature verification for all webhook events
- **Input Validation**: Comprehensive input validation and sanitization
- **Environment Security**: Proper handling of live API keys and secrets

These Edge Functions form the core of the enhanced backend logic, enabling dynamic data retrieval, secure interactions with Stripe, AI-powered content generation, and sophisticated subscription management with generation preservation. The recent enhancements focus on creating a fair, user-friendly billing system while maintaining data integrity and security. 
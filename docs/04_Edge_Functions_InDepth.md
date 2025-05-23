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
    ```
-   **Supabase Client**: For database interactions, functions might use the Supabase client, often with a service role key for elevated privileges if necessary.

## 1. `supabase-functions-get-plans`

-   **File**: `supabase/functions/get-plans/index.ts` (Mistakenly named in frontend as `supabase-functions-get-plans`, actual might be `get-plans`)
-   **Purpose**: To fetch active pricing plans from Stripe to display on the frontend.
-   **Trigger**: Called by the frontend (e.g., `PricingSection.tsx`, `home.tsx`) when pricing information is needed.
    ```javascript
    // Frontend invocation example
    const { data, error } = await supabase.functions.invoke("get-plans"); 
    // Note: Frontend code uses "supabase-functions-get-plans", ensure this matches deployed function name.
    ```
-   **Logic**:
    1.  Handles CORS preflight (`OPTIONS`) requests.
    2.  Initializes the Stripe client using `STRIPE_SECRET_KEY`.
    3.  Calls `stripe.plans.list({ active: true })` to retrieve all active plans from Stripe.
        -   *Correction*: The Stripe API uses `stripe.prices.list({ active: true, expand: ['data.product'] })` to get prices and their associated product details. Plans are an older API. If using `stripe.plans.list`, it's likely for an older Stripe integration. The frontend seems to expect `price` objects (with `id`, `amount`, `currency`, `interval`, `product` which could be an ID or an expanded object).
    4.  Returns the list of plan/price objects as a JSON response.
-   **Key Environment Variables**: `STRIPE_SECRET_KEY`.
-   **Returns**: A JSON array of Stripe Price/Plan objects.
    ```json
    // Example structure if returning Stripe Price objects
    [
      {
        "id": "price_1RDlb8IxCwq8UET9kVsVYIsN",
        "object": "price",
        "active": true,
        "amount": 1500, // in cents
        "currency": "usd",
        "interval": "month",
        "product": "prod_S81eTeDgrCfV5l", // Product ID or expanded Product object
        "nickname": "Basic Plan", // Or null
        // ... other price fields
      }
    ]
    ```

## 2. `supabase-functions-create-checkout`

-   **File**: `supabase/functions/create-checkout/index.ts`
-   **Purpose**: To create a Stripe Checkout Session for a user to subscribe to a selected pricing plan.
-   **Trigger**: Called by the frontend (`initiateCheckout` in `lib/stripeUtils.ts` or `handleCheckout` in `home.tsx`) when a user clicks a "Choose Plan" or "Upgrade" button.
    ```javascript
    // Frontend invocation example
    const { data, error } = await supabase.functions.invoke(
      "create-checkout", // Or "supabase-functions-create-checkout"
      {
        body: {
          price_id: "price_xxxxxxxxxxxx",
          user_id: "auth_user_id_xxxx",
          return_url: `${window.location.origin}/profile` // Or /success
        },
        headers: {
          "X-Customer-Email": "user@example.com"
        }
      }
    );
    ```
-   **Logic**:
    1.  Handles CORS.
    2.  Extracts `price_id`, `user_id`, and `return_url` from the request body.
    3.  Initializes Stripe client.
    4.  Retrieves the user's `stripe_customer_id` from the `users` table in Supabase. If it doesn't exist, a new Stripe Customer is created using the user's email (passed in `X-Customer-Email` header or fetched from DB) and the ID is saved to the `users` table.
    5.  Creates a Stripe Checkout Session using `stripe.checkout.sessions.create()`:
        -   `customer`: The Stripe Customer ID.
        -   `payment_method_types`: `['card']`.
        -   `line_items`: Contains the `price_id` and quantity (usually 1).
        -   `mode`: `'subscription'`.
        -   `success_url`: The `return_url` provided by the client (e.g., `${frontend_url}/profile?session_id={CHECKOUT_SESSION_ID}`).
        -   `cancel_url`: A URL to redirect to if the user cancels (e.g., `${frontend_url}/` or back to pricing page).
        -   `metadata`: Can include `user_id` or other useful information for tracking or webhooks.
    6.  Returns the Stripe Checkout Session URL (`{ url: session.url }`) as JSON.
-   **Key Environment Variables**: `STRIPE_SECRET_KEY`.
-   **Interactions**:
    -   Reads/writes `stripe_customer_id` in the Supabase `users` table.
    -   Creates Stripe Customer and Checkout Session objects.
-   **Returns**: `{ "url": "<stripe_checkout_session_url>" }`

## 3. `process-lab-result` / `process-lab-result-long`

-   **File**: `supabase/functions/process-lab-result/index.ts` and potentially `supabase/functions/process-lab-result-long/index.ts`.
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

## 4. `payments-webhook`

-   **File**: `supabase/functions/payments-webhook/index.ts`
-   **Purpose**: To handle webhook events from Stripe, keeping user subscription data in Supabase synchronized with Stripe.
-   **Trigger**: Triggered by Stripe when specific events occur (configured in Stripe webhook settings).
-   **Logic**:
    1.  Handles CORS (though less critical for webhooks, still good practice for testing).
    2.  **Verify Stripe Signature**: Crucial for security. Reads the `Stripe-Signature` header and the raw request body. Uses `stripe.webhooks.constructEvent` with the `STRIPE_WEBHOOK_SECRET` to verify the event's authenticity.
        ```typescript
        // const signature = req.headers.get('Stripe-Signature');
        // const body = await req.text(); // Raw body
        // let event;
        // try {
        //   event = stripe.webhooks.constructEvent(body, signature, Deno.env.get('STRIPE_WEBHOOK_SECRET'));
        // } catch (err) {
        //   return new Response(`Webhook Error: ${err.message}`, { status: 400 });
        // }
        ```
    3.  **Handle Specific Events**: Uses a `switch` statement on `event.type`:
        -   **`checkout.session.completed`**: Occurs when a user successfully completes a Stripe Checkout Session.
            -   Extract `stripe_customer_id` and `subscription_id` from the session object (`event.data.object`).
            -   Extract `user_id` from session `metadata` (if set during checkout creation).
            -   Update the `users` table for the `user_id`:
                -   Set `stripe_customer_id`.
                -   Set `current_plan_id` (from a line item in the session or by fetching the subscription).
                -   Set `subscription_status` to `'active'` (or the subscription's status).
                -   Update `generation_limit` based on the new plan.
                -   Reset `generations_used` to `0`.
        -   **`customer.subscription.created` / `customer.subscription.updated`**: Occurs when a subscription is created or changes (e.g., upgrade, downgrade, renewal).
            -   Extract `customer` (Stripe Customer ID), `plan.id` (Stripe Price ID), and `status` from the subscription object (`event.data.object`).
            -   Find the user in the `users` table by `stripe_customer_id`.
            -   Update `current_plan_id`, `subscription_status`.
            -   Update `generation_limit` according to the new plan.
            -   Reset `generations_used` if it's a new billing cycle or plan change.
        -   **`customer.subscription.deleted`**: Occurs when a subscription is canceled and ends.
            -   Extract `customer` (Stripe Customer ID) and `status` (`canceled`).
            -   Find the user by `stripe_customer_id`.
            -   Set `subscription_status` to `'canceled'` (or similar).
            -   Optionally, set `generation_limit` to a free tier limit or `0`.
            -   Set `current_plan_id` to `null`.
        -   **`invoice.payment_succeeded`**: Can be used to confirm ongoing subscription payments and ensure `generations_used` is reset for the new period if not handled by `customer.subscription.updated`.
    4.  Returns a `200 OK` response to Stripe to acknowledge receipt of the event. If Stripe doesn't receive a 2xx response, it will retry sending the webhook.
-   **Key Environment Variables**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (for Supabase admin client).
-   **Interactions**:
    -   Reads/writes to the `users` table in Supabase.
    -   Interacts with the Stripe API (e.g., to fetch subscription details if not fully included in the event).
-   **Returns**: `200 OK` to Stripe. Body can be `{ received: true }`.

These Edge Functions form the core of the backend logic, enabling dynamic data retrieval, secure interactions with Stripe, AI-powered content generation, and synchronization of subscription states. 
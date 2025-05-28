# System Interaction Flowcharts

This document contains flowcharts illustrating key interactions within the StrainInsights application, primarily between the frontend, Supabase Edge Functions, and external services.

## Main Interaction Flow (Sequence Diagram)

This diagram shows the sequence of events for major operations like fetching pricing plans, user checkout, lab result processing, and Stripe webhook handling.

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend (React App)
    participant SupaClient as Supabase Client (JS)
    participant EdgeGetPlans as Edge Function (get-plans)
    participant EdgeCreateCheckout as Edge Function (create-checkout)
    participant EdgeProcessLab as Edge Function (process-lab-result)
    participant EdgePaymentsWebhook as Edge Function (payments-webhook)
    participant SupaDB as Supabase DB
    participant SupaStorage as Supabase Storage
    participant StripeAPI as Stripe API
    participant AIService as AI/LLM Service

    %% Fetching Pricing Plans
    User->>FE: Views Pricing Page
    FE->>SupaClient: supabase.functions.invoke('get-plans')
    SupaClient->>EdgeGetPlans: Invoke
    EdgeGetPlans->>StripeAPI: List active prices (Live)
    StripeAPI-->>EdgeGetPlans: Price list (Live Price IDs)
    EdgeGetPlans-->>SupaClient: Return price list
    SupaClient-->>FE: Update plans data
    FE->>User: Display Plans (using live product names/local map with Live Price IDs)

    %% User Initiates Checkout
    User->>FE: Clicks "Choose Plan"
    FE->>FE: Check Auth Status
    alt User Not Authenticated
        FE->>User: Redirect to Login Page
    else User Authenticated
        FE->>SupaClient: supabase.functions.invoke('create-checkout', {livePriceId, userId, returnUrl})
        SupaClient->>EdgeCreateCheckout: Invoke with livePriceId, userId, returnUrl (prod)
    EdgeCreateCheckout->>SupaDB: Get/Create Stripe Customer ID for user
    SupaDB-->>EdgeCreateCheckout: Stripe Customer ID
        EdgeCreateCheckout->>StripeAPI: Create Checkout Session (allow_promotion_codes: true)
    StripeAPI-->>EdgeCreateCheckout: Session URL
    EdgeCreateCheckout-->>SupaClient: Return Session URL
    SupaClient-->>FE: Redirect to Stripe
    FE->>User: Redirects to Stripe Checkout Page
    User->>StripeAPI: Completes Payment
        StripeAPI->>User: Redirects to Success URL (Frontend - prod)
    end

    %% File Upload and Processing
    User->>FE: Clicks "Upload PDF"
    FE->>FE: Check Auth Status
    alt User Not Authenticated
        FE->>User: Redirect to Login Page
    else User Authenticated
    User->>FE: Uploads PDF COA
    FE->>SupaClient: Upload file to Supabase Storage
    SupaClient->>SupaStorage: Store file
    SupaStorage-->>SupaClient: File path
    SupaClient->>SupaDB: Create lab_results record (status: pending)
    SupaDB-->>SupaClient: labResultId
    SupaClient->>SupaDB: Update lab_results record (status: processing)
    SupaClient->>EdgeProcessLab: Invoke with {storagePath, labResultId}
    EdgeProcessLab->>SupaStorage: Download PDF from storagePath
    SupaStorage-->>EdgeProcessLab: PDF data
    EdgeProcessLab->>AIService: Send PDF text for analysis
    AIService-->>EdgeProcessLab: Generated description
    EdgeProcessLab->>SupaDB: Update lab_results (description, status: completed)
    loop Polling for results
        FE->>SupaClient: Fetch lab_results by labResultId
        SupaClient->>SupaDB: Query lab_results
        SupaDB-->>SupaClient: Result data
        SupaClient-->>FE: Update UI
    end
    FE->>User: Display COA Description
    end

    %% Stripe Webhook for Subscription Update
    StripeAPI->>EdgePaymentsWebhook: Event (e.g., checkout.session.completed) from Live Stripe
    EdgePaymentsWebhook->>EdgePaymentsWebhook: Verify Stripe Signature (using Live Webhook Secret)
    EdgePaymentsWebhook->>SupaDB: Update user record (subscription status, Live Price ID, limits)
    SupaDB-->>EdgePaymentsWebhook: Confirm update
    EdgePaymentsWebhook-->>StripeAPI: 200 OK
```

This diagram provides a visual overview of the communication paths for the application's core functionalities. 
# System Architecture Mermaid Charts

This document contains Mermaid charts that visualize different aspects of the StrainInsights system architecture, focusing on component relationships and data structures.

## Component Relationship Diagram (Simplified)

This diagram shows the main components and their primary relationships.

```mermaid
classDiagram
    direction LR

    User --|> Frontend

    Frontend --|> SupabaseClientJS : Uses
    SupabaseClientJS --|> SupabaseAuth : Interacts with
    SupabaseClientJS --|> SupabaseDB : Interacts with
    SupabaseClientJS --|> SupabaseStorage : Interacts with
    SupabaseClientJS --|> EdgeFunctions : Invokes

    EdgeFunctions --|> SupabaseDB : Accesses
    EdgeFunctions --|> SupabaseStorage : Accesses
    EdgeFunctions --|> StripeAPI : Calls
    EdgeFunctions --|> AIService : Calls

    StripeAPI --|> EdgeFunctions : Sends Webhooks

    class User {
        <<Actor>>
    }

    class Frontend {
        <<React App>>
        +Handles UI/UX
        +Manages client-side state
        +Initiates API calls
    }

    class SupabaseClientJS {
        <<supabase-js>>
        +Provides interface to Supabase
    }

    class SupabaseAuth {
        <<Supabase Service>>
        +Handles user authentication
    }

    class SupabaseDB {
        <<PostgreSQL>>
        +users table
        +lab_results table
        +RLS Policies
    }

    class SupabaseStorage {
        <<S3-compatible>>
        +labresults bucket
        +Storage Policies
    }

    class EdgeFunctions {
        <<Deno Runtime>>
        +get-plans() (fetches live plans)
        +create-checkout() (handles live price IDs, allow_promotion_codes)
        +process-lab-result()
        +payments-webhook() (handles live events & secrets)
    }

    class StripeAPI {
        <<External Service>>
        +Manages products, prices (live & test), subscriptions
        +Processes payments
        +Sends webhook events (for live & test environments)
    }

    class AIService {
        <<External LLM/AI>>
        +Generates text descriptions
    }
```

## Database Schema (Simplified ERD-like view)

This diagram shows the key tables and their relationships in the Supabase database.

```mermaid
erDiagram
    USERS {
        uuid user_id PK
        text email
        text stripe_customer_id
        text current_plan_id "Live Stripe Price ID"
        text subscription_status
        int generations_used
        int generation_limit
    }

    LAB_RESULTS {
        uuid id PK
        uuid user_id FK
        text file_name
        text storage_path
        text status
        text description
        text raw_text
    }

    USERS ||--o{ LAB_RESULTS : "has"

    %% Relationships to auth.users table (conceptual)
    %% auth.users { uuid id PK ... }
    %% USERS::user_id -- auth.users::id : "extends"
```

These charts offer a visual representation of the system's structure and data organization, complementing the textual documentation. 
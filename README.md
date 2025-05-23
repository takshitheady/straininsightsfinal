# StrainInsights - COA Analysis Platform

StrainInsights is a web application designed to help users analyze Certificates of Analysis (COAs) for cannabis products. It allows users to upload COA PDFs, extracts relevant data, and generates SEO-friendly descriptions using AI.
The application also features a subscription model managed via Stripe, allowing users to access different tiers of service.

## Tech Stack

-   **Frontend**: React, Vite, TypeScript, Tailwind CSS, Shadcn/ui, Framer Motion, React Router DOM
-   **Backend**: Supabase (PostgreSQL, Authentication, Storage, Edge Functions)
-   **Payment Processing**: Stripe
-   **AI Service**: (e.g., OpenAI GPT models)

## Getting Started

### Prerequisites

-   Node.js (v18+ recommended)
-   npm or yarn
-   Supabase Account & CLI setup (see `docs/03_Supabase_Setup_Guide.md`)
-   Stripe Account & CLI setup (see `docs/03_Supabase_Setup_Guide.md`)
-   API Key for an AI service (e.g., OpenAI)

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd straininsights
    ```

2.  **Install frontend dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Set up Supabase Backend:**
    Follow the detailed instructions in `docs/03_Supabase_Setup_Guide.md` to:
    *   Create your Supabase project.
    *   Set up the database schema (`users`, `lab_results` tables).
    *   Configure Row Level Security (RLS).
    *   Set up Supabase Storage (`labresults` bucket and policies).
    *   Deploy Edge Functions (`get-plans`, `create-checkout`, `process-lab-result`, `payments-webhook`).
    *   Configure necessary environment variables for Supabase functions (Stripe keys, AI keys).

4.  **Configure Frontend Environment Variables:**
    Create a `.env` file in the root of the project (where `package.json` is) and add your Supabase project details:
    ```env
    VITE_SUPABASE_URL=https://your-project-id.supabase.co
    VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
    ```
    Replace `your-project-id` and `your-supabase-anon-key` with your actual Supabase project ID and anon key.

5.  **Set up Stripe Products & Webhooks:**
    *   Create products and prices in your Stripe dashboard.
    *   Set up a webhook endpoint pointing to your deployed `payments-webhook` Edge Function. Details can be found in `docs/03_Supabase_Setup_Guide.md` and `docs/04_Edge_Functions_InDepth.md`.

### Running the Application

1.  **Start the development server:**
    ```bash
    npm run dev
    # or
    yarn dev
    ```
    This will typically start the application on `http://localhost:5174`.

2.  **Deploy Supabase Edge Functions:**
    If you haven't already, or if you make changes to them:
    ```bash
    supabase functions deploy
    ```

## Documentation

This project includes comprehensive documentation to help understand its architecture, setup, and data flows. You can find detailed information in the following files located in the `docs/` directory:

1.  **`01_Frontend_Architecture.md`**: Describes the frontend structure, technologies used, component organization, routing, state management, and key user flows related to the UI.
2.  **`02_Backend_Architecture_Supabase.md`**: Outlines the backend setup using Supabase, including services used (Database, Auth, Storage, Edge Functions), database schema, and security considerations.
3.  **`03_Supabase_Setup_Guide.md`**: A step-by-step guide to setting up a new Supabase project to run this application, including database creation, RLS, storage, Edge Function deployment, and Stripe integration.
4.  **`04_Edge_Functions_InDepth.md`**: Provides a detailed look into each Supabase Edge Function, explaining their purpose, triggers, logic, key environment variables, and interactions.
5.  **`05_Data_Flow_And_Interactions.md`**: Illustrates key data flows and system interactions, such as user registration, pricing plan display, file upload and processing, Stripe checkout, and webhook handling.
6.  **`06_Flowchart_Interactions.md`**: Contains a Mermaid sequence diagram visually representing the main interactions between the frontend, Edge Functions, Supabase services, and external APIs.
7.  **`07_Mermaid_Charts.md`**: Includes Mermaid class and entity-relationship diagrams to visualize component relationships and the database schema.

## Key Features

-   User Authentication (Sign-up, Login)
-   PDF COA Upload and AI-powered Description Generation
-   Subscription Plans with Stripe Integration
-   User Dashboard for managing uploads and profile
-   Responsive Design

## Contributing

(Placeholder for contribution guidelines if this were an open-source project)

## License

(Placeholder for license information)

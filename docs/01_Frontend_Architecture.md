# Frontend Architecture

This document outlines the frontend architecture of the StrainInsights application.

## 1. Overview

The frontend is a single-page application (SPA) built using **React** and **Vite**. It leverages **TypeScript** for type safety and improved developer experience. Styling is primarily handled by **Tailwind CSS** along with UI components from **Shadcn/ui**.

## 2. Core Technologies

-   **React**: For building the user interface components.
-   **Vite**: As the build tool and development server, providing fast HMR and optimized builds.
-   **TypeScript**: For static typing.
-   **Tailwind CSS**: A utility-first CSS framework for rapid UI development.
-   **Shadcn/ui**: A collection of beautifully designed, accessible, and customizable UI components built on top of Radix UI and Tailwind CSS.
-   **Lucide React**: For icons.
-   **Framer Motion**: For animations and transitions.
-   **React Router DOM**: For client-side routing.

## 3. Project Structure (Key Directories in `src/`)

-   `components/`: Contains reusable UI components.
    -   `auth/`: Authentication-related components (LoginForm, SignUpForm).
    -   `dashboard/`: Components specific to user dashboards (e.g., `ActivityFeed.tsx`).
    -   `home/`: Components for the landing/home page (e.g., `PricingSection.tsx`).
    -   `pages/`: Top-level page components that correspond to routes (e.g., `home.tsx`, `Upload.tsx`, `Profile.tsx`).
    -   `ui/`: Shadcn/ui components (Button, Card, Dialog, etc.).
-   `lib/`: Utility functions and helper modules (e.g., `stripeUtils.ts`).
-   `stories/`: Storybook stories for component development and testing (not extensively used in this project).
-   `supabase/`: Supabase client setup and authentication context (`auth.tsx`, `supabase.ts`).
-   `App.tsx`: The main application component, sets up routing.
-   `main.tsx`: The entry point of the application.

## 4. Routing

Client-side routing is managed by `react-router-dom`. The main routes are defined in `src/App.tsx`.

-   `/`: Home page (`src/components/pages/home.tsx`)
-   `/login`: Login page (`src/components/auth/LoginForm.tsx`)
-   `/signup`: Sign up page (`src/components/auth/SignUpForm.tsx`)
-   `/upload`: File upload page (`src/components/pages/Upload.tsx`) - Private Route
-   `/output-history`: User's COA processing history (`src/components/pages/OutputHistory.tsx`) - Private Route
-   `/profile`: User profile and subscription management (`src/components/pages/Profile.tsx`) - Private Route
-   `/success`: Page displayed after successful Stripe checkout.

A `PrivateRoute` higher-order component in `src/App.tsx` protects routes that require authentication. It checks the user's authentication status using the `useAuth` hook from `src/supabase/auth.tsx`.

## 5. State Management

-   **Component-Level State**: Primarily managed using React's `useState` and `useEffect` hooks for local component data and side effects.
-   **Authentication State**: Managed globally via `src/supabase/auth.tsx`, which provides an `AuthProvider` context. The `useAuth` hook allows any component to access the current user's authentication status and profile information.
-   **Data Fetching & Caching**:
    -   Pricing plans on the homepage (`src/components/pages/home.tsx`) are fetched from a Supabase Edge Function and cached in `localStorage` for 24 hours to reduce API calls.
    -   User-specific data (like generation usage and limits on `UploadPage`) is fetched directly from the Supabase database.

## 6. UI Components and Styling

-   **Shadcn/ui**: Provides a base set of unstyled, accessible components (e.g., `Button`, `Card`, `Dialog`, `Input`, `Toast`). These are then customized with Tailwind CSS.
-   **Tailwind CSS**: Used extensively for styling. Utility classes are applied directly in the JSX.
-   **Custom Components**: Specific components like `PricingSection.tsx` and the file upload interface in `UploadPage.tsx` are custom-built using Shadcn/ui primitives and Tailwind CSS.
-   **Framer Motion**: Used for page transitions and micro-interactions to enhance the user experience.

## 7. Key User Interactions & Flows

### 7.1. Authentication

-   Users can sign up or log in using email and password.
-   Supabase handles the authentication flow.
-   The `useAuth` hook provides user session information and methods like `signInWithEmail`, `signUp`, and `signOut`.
-   Authenticated users are redirected to protected routes, while unauthenticated users attempting to access protected routes are redirected to the login page.

### 7.2. Viewing Pricing Plans

-   **Homepage (`home.tsx`)**:
    -   Fetches plan details (ID, amount, currency, interval, product name) from the `supabase-functions-get-plans` Edge Function.
    -   Caches this data in `localStorage`.
    -   Displays plan names and features. Plan names are hardcoded based on plan amount/ID for consistency. Features are also determined client-side based on plan amount/ID.
-   **Upload Page Dialog (`Upload.tsx` using `PricingSection.tsx`)**:
    -   When a user hits their generation limit, a dialog appears showing available plans.
    -   The `PricingSection.tsx` component is reused here.
    -   It also fetches plan details.
    -   Plan names and features are determined client-side, with overrides possible via props to `PricingSection`.

### 7.3. File Upload and Processing (`UploadPage.tsx`)

-   **User Usage Tracking**:
    -   Fetches `generations_used` and `generation_limit` for the logged-in user from the `users` table in Supabase.
    -   Disables upload functionality if the limit is reached.
-   **File Selection**:
    -   Users can drag-and-drop or use a file input to select a PDF (max 1MB).
    -   Basic client-side validation for file type and size.
-   **Upload Process**:
    1.  `handleUpload` or `handleUploadLong` is triggered.
    2.  The `uploadToSupabase` function is called:
        a.  File is uploaded to Supabase Storage in the `labresults` bucket with a unique name (`<user_id>/<timestamp>-<filename>`).
        b.  A record is inserted into the `lab_results` table with `status: 'pending'`.
        c.  The user's `generations_used` count in the `users` table is incremented.
        d.  The status of the `lab_results` record is updated to `processing`.
        e.  The appropriate Edge Function (`process-lab-result` or `process-lab-result-long`) is invoked with the `storagePath` and `labResultId`.
    3.  The UI updates to show an "uploading" and then "processing" state.
-   **Polling for Results**:
    -   Once the Edge Function is invoked, the frontend starts polling the `lab_results` table for the specific `labResultId`.
    -   The `fetchDescription` function in `UploadPage.tsx` polls every 3 seconds (for up to 15 attempts).
    -   It checks the `status` and `description` fields.
    -   If `status` becomes `'completed'` and `description` is available, it's displayed.
    -   If `status` becomes `'error'` or polling times out, an error message is shown.
-   **Upgrade Dialog**:
    -   If `generations_used >= generation_limit`, the upload UI is disabled, and an upgrade dialog is presented.
    -   This dialog reuses the `PricingSection.tsx` component, configured with explicit plan features passed as props to ensure consistency with the homepage, even if the underlying Stripe plan data (via `supabase-functions-get-plans`) might differ slightly.

### 7.4. Stripe Checkout Integration

-   Initiated from either the `PricingSection.tsx` (in the upgrade dialog) or the main pricing section on `home.tsx`.
-   The `handleCheckout` function is called (either passed as a prop or imported from `stripeUtils.ts`).
-   The `initiateCheckout` function in `lib/stripeUtils.ts` (or a similar one on `home.tsx`) calls the `supabase-functions-create-checkout` Edge Function.
    -   This function takes the `priceId` and `userId`.
    -   The Edge Function creates a Stripe Checkout Session and returns the session URL.
-   The frontend redirects the user to the Stripe Checkout URL.
-   After payment, Stripe redirects the user to a success URL (e.g., `/profile` or `/success`).

## 8. Styling and Theme

-   **Theme**: The `PricingSection.tsx` component supports a `theme` prop ('light' or 'dark') to adjust its appearance, primarily used in the `UploadPage.tsx` dialog for a light theme. The main site uses a dark theme.
-   **Responsive Design**: Tailwind CSS's responsive prefixes (e.g., `md:`, `lg:`) are used to ensure the application is usable across different screen sizes.

This frontend architecture allows for a reactive user experience, with clear separation of concerns for UI, state, and interactions with the Supabase backend. 
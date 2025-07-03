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
    -   `auth/`: Authentication-related components (LoginForm, SignUpForm) with Google OAuth support.
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

A `PrivateRoute` higher-order component in `src/App.tsx` protects routes that require authentication. It checks the user's authentication status using the `useAuth` hook from `src/supabase/auth.tsx`. Additionally, key call-to-action buttons (like "Upload" or "Choose Plan") incorporate checks: if a user is not authenticated, they are prompted to log in, often redirecting to the login page with a return path.

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

**Enhanced Authentication System with Google OAuth:**

-   **Email/Password Authentication**: Traditional sign-up and login using email and password.
-   **Google OAuth Integration**: 
    -   Users can sign up or log in using their Google accounts
    -   Implemented in both `LoginForm.tsx` and `SignUpForm.tsx`
    -   Features official Google branding and consistent UI/UX
    -   Includes loading states and comprehensive error handling
    -   Automatic redirect to `/upload` after successful Google authentication

-   **Authentication Context**: The `useAuth` hook provides user session information and methods:
    -   `signInWithEmail`: Email/password login
    -   `signInWithGoogle`: Google OAuth login
    -   `signUp`: Email/password registration
    -   `signOut`: User logout

-   **Protected Routes**: Authenticated users are redirected to protected routes. Unauthenticated users attempting to access protected routes or specific CTAs are redirected to the login page with a redirect query parameter.

### 7.2. Profile Page & Subscription Management

**Comprehensive Profile Management System:**

-   **Account Status Logic**:
    -   **Free Plan Users**: Show "inactive" status to encourage upgrades
    -   **Basic/Pro Plan Users**: Show "active" status when subscription is valid
    -   Status determination considers subscription records and plan types

-   **Enhanced Billing Management**:
    -   **Plan Selection Dialog**: Modal with side-by-side plan comparison
    -   **Smart Plan Options**:
        - **Free Users**: Can choose Basic ($39) or Pro ($99) plans
        - **Basic Users**: Can renew Basic plan or upgrade to Pro
        - **Pro Users**: Can renew Pro or downgrade to Basic
    -   **Visual Indicators**: Current plan highlighted with badges and colored borders
    -   **Loading States**: Processing indicators during checkout

-   **Generation Limit Management**:
    -   **Glowing Button Feature**: When users exhaust their generation limit (`operations_used >= operations_limit`), the "Manage Billing" button:
        - Glows with pulse animation (`animate-pulse`)
        - Shows glowing ring (`ring-2 ring-brand-green/50`)
        - Changes text to "Upgrade Plan - No Generations Left!"
        - Works for all plan types (Free, Basic, Pro)

-   **Navigation Integration**:
    -   "View Generation History" button properly navigates to `/output-history`
    -   Seamless integration with existing routing system

### 7.3. Viewing Pricing Plans

-   **Homepage (`home.tsx`) and `PricingSection.tsx`**:
    -   Fetches plan details (Price ID, amount, currency, interval, and expanded product information including `product.name`) from the `supabase-functions-get-plans` Edge Function.
    -   Caches this data in `localStorage` for 24 hours.
    -   Displays plan names by prioritizing `plan.product.name` from Stripe, then falling back to a local `planNames` map (keyed by live Price IDs), then `plan.nickname`, and finally the Price ID itself.
    -   Features are determined client-side based on plan details.
-   **Upload Page Dialog (`UploadPage.tsx` using `PricingSection.tsx`)**:
    -   When a user hits their generation limit, a dialog appears showing available plans.
    -   The `PricingSection.tsx` component is reused here, and it follows the same logic for fetching and displaying plan details and names.
    -   Plan names and features are determined client-side, with overrides possible via props to `PricingSection`.

### 7.4. File Upload and Processing (`UploadPage.tsx`)

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

### 7.5. Stripe Checkout Integration

**Enhanced Checkout System:**

-   **Initiation**: Triggered from:
    -   `PricingSection.tsx` (upgrade dialogs)
    -   Main pricing section on `home.tsx`
    -   Profile page billing management

-   **Checkout Process**:
    -   Uses `initiateCheckout` function from `lib/stripeUtils.ts`
    -   Calls `supabase-functions-create-checkout` Edge Function
    -   Creates Stripe Checkout Session with:
        - Correct Price IDs: `price_1RTkaDDa07Wwp5KNnZF36GsC` (Basic), `price_1RTka9Da07Wwp5KNiRxFGnsG` (Pro)
        - `allow_promotion_codes: true` for coupon support
        - User metadata for webhook processing
    -   Redirects to Stripe-hosted checkout page

-   **Post-Payment**: Stripe redirects to success URL with updated subscription status

## 8. Styling and Theme

-   **Theme**: The `PricingSection.tsx` component supports a `theme` prop ('light' or 'dark') to adjust its appearance, primarily used in the `UploadPage.tsx` dialog for a light theme. The main site uses a dark theme.
-   **Responsive Design**: Tailwind CSS's responsive prefixes (e.g., `md:`, `lg:`) are used to ensure the application is usable across different screen sizes.
-   **Interactive Elements**: 
    -   Glowing animations for urgent actions (billing management when generations exhausted)
    -   Loading states with spinners and disabled controls
    -   Hover effects and transitions for enhanced user experience

## 9. Recent Enhancements

### 9.1. Google OAuth Integration
- Seamless Google sign-in/sign-up across authentication forms
- Consistent branding and user experience
- Automatic redirect handling post-authentication

### 9.2. Enhanced Profile Management
- Comprehensive billing management with plan selection dialogs
- Smart account status determination based on plan types
- Visual indicators for current plans and upgrade options

### 9.3. Generation Preservation System
- Unused generations preserved when upgrading/renewing plans
- Fair billing system that maintains user value
- Clear visual feedback for generation limits and usage

### 9.4. Improved User Experience
- Glowing buttons for urgent actions
- Loading states throughout the application
- Responsive design with consistent theming

This frontend architecture allows for a reactive user experience, with clear separation of concerns for UI, state, and interactions with the Supabase backend. The recent enhancements focus on improving user onboarding, subscription management, and overall user experience while maintaining code quality and maintainability. 
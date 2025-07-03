# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Recent Updates

### Profile Page Fixes (Latest)
Fixed critical issues in the Profile page component:

**Account Status Issue:**
- **Problem:** Google sign-in users showed "inactive" status despite successful authentication
- **Root Cause:** Faulty logic assumed free plan users needed subscription records
- **Fix:** Updated status determination logic in `src/components/pages/Profile.tsx` (lines 115-130)
- **Result:** Free plan users now correctly show "active" status

**Enhanced Billing Management:**
- **Problem:** "Manage Billing" button only logged to console and provided limited upgrade options
- **Fix:** Implemented comprehensive plan selection system:
  - **Free Users:** Can choose between Basic ($39) or Pro ($99) plans
  - **Basic Users:** Can **renew their Basic plan** or upgrade to Pro
  - **Pro Users:** Can renew Pro or downgrade to Basic plan
  - **All Users:** Get appropriate plan options with feature comparisons
- **Features:**
  - Modal dialog with plan comparison cards
  - Real-time pricing and feature display
  - Loading states during checkout processing
  - Stripe integration for seamless payment processing
  - Dynamic button text based on user's current plan
  - **Latest Update:** Basic users now see both Basic (renew) and Pro (upgrade) options
  - **Glowing Button Feature:** When users exhaust their generation limit (operations_used >= operations_limit), the "Manage Billing" button glows with pulse animation and changes text to "Upgrade Plan - No Generations Left!"
  - **Account Status Logic Update:** Free plan users now show "inactive" status to encourage upgrades (previously showed "active")
  - **Generation Preservation:** When upgrading/renewing plans, remaining unused generations are preserved and added to the new plan limit
- **Location:** `src/components/pages/Profile.tsx`, `supabase/functions/payments-webhook/index.ts`

**View Generation History:**
- **Problem:** Button had no functionality
- **Fix:** Wrapped with Link component to navigate to `/output-history`
- **Result:** Users can now access their generation history

**Technical Implementation:**
- Uses actual Stripe Price IDs: `price_1RTkaDDa07Wwp5KNnZF36GsC` (Basic), `price_1RTka9Da07Wwp5KNiRxFGnsG` (Pro)
- Integrates with existing `initiateCheckout` utility from `stripeUtils.ts`
- Responsive dialog component with plan comparison cards
- Loading states and error handling for smooth UX

### Database Schema Understanding
- `users` table: Contains `current_plan_id`, `generation_limit`, `generations_used`
- `subscriptions` table: Only populated for paid plans, not free users
- Free users: `current_plan_id = 'free'`, `generation_limit = 1`, no subscription record
- Status logic: Free plans = "active", paid plans check subscription table

## Development Commands

### Frontend Development
- `npm run dev` - Start development server (runs on http://localhost:5174)
- `npm run build` - Build project for production (includes TypeScript compilation)
- `npm run build-no-errors` - Build without failing on TypeScript errors
- `npm run lint` - Run ESLint with TypeScript extensions
- `npm run preview` - Preview production build

### Supabase Development
- `supabase functions deploy` - Deploy all Edge Functions
- `npm run types:supabase` - Generate TypeScript types from Supabase schema
- `supabase start` - Start local Supabase instance
- `supabase db reset` - Reset local database

## Core Architecture Principles

This is a **SaaS COA (Certificate of Analysis) processing platform** for cannabis products with AI-powered analysis and subscription-based access controls.

### **Key Design Patterns:**
- **Event-Driven Architecture**: Uses Stripe webhooks for subscription state management
- **Optimistic Updates**: UI updates immediately with rollback on failures
- **Progressive Enhancement**: Features unlock based on authentication and subscription status
- **Defensive Programming**: Extensive error handling and fallback mechanisms
- **Cache-First Strategy**: 24-hour pricing data caching to reduce API calls

## Detailed Architecture Analysis

### Frontend Architecture (`src/`)

#### **State Management Strategy:**
- **Authentication**: Global React Context (`AuthProvider`) manages user sessions
- **Component State**: Local useState for UI-specific state (upload progress, modal visibility)
- **Data Fetching**: Direct Supabase client calls with error boundaries
- **Cache Management**: LocalStorage for pricing data with 24-hour TTL

#### **Component Architecture Patterns:**
- **Compound Components**: `PricingSection` reusable across multiple contexts
- **Higher-Order Components**: `PrivateRoute` for authentication guards
- **Render Props**: Modal dialogs with flexible content rendering
- **Controlled Components**: Form handling with React Hook Form + Zod validation

#### **Upload Workflow (`src/components/pages/Upload.tsx`):**
1. **Pre-upload Validation**: File type, size, user authentication, usage limits
2. **Optimistic UI Updates**: Immediate user feedback before server confirmation
3. **Multi-step Process**: Upload → Database record → Edge Function invocation
4. **Polling Pattern**: 3-second intervals, 15 attempts max for result fetching
5. **Error Recovery**: Cleanup failed uploads, rollback usage counts

#### **Authentication System (`supabase/auth.tsx`):**
- **Dual Session Management**: Initial session check + real-time auth state changes
- **Metadata Handling**: Stores `full_name` in Supabase user metadata
- **Error Classification**: Distinguishes between network, auth, and user errors
- **Duplicate Detection**: Uses `identities.length === 0` to detect existing emails

### Backend Architecture (Supabase)

#### **Database Schema Design:**
```sql
-- Core user management with subscription tracking
users (
  user_id UUID PRIMARY KEY,           -- Links to auth.users.id
  email TEXT,
  stripe_customer_id TEXT,
  current_plan_id TEXT,               -- Live Stripe Price ID
  subscription_status TEXT,
  generations_used INTEGER DEFAULT 0,
  generation_limit INTEGER DEFAULT 10
)

-- COA processing results with status tracking
lab_results (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  file_name TEXT,
  storage_path TEXT,                  -- Supabase Storage path
  status TEXT DEFAULT 'pending',     -- 'pending'|'processing'|'completed'|'error'
  description TEXT,                   -- AI-generated analysis
  raw_text TEXT                       -- Extracted PDF text
)

-- Subscription management with billing details
subscriptions (
  id UUID PRIMARY KEY,
  user_id TEXT,
  stripe_id TEXT UNIQUE,              -- Stripe Subscription ID
  status TEXT,
  current_period_end TIMESTAMPTZ
)
```

#### **Row Level Security (RLS) Implementation:**
- **users table**: `auth.uid() = user_id` ensures users access only their data
- **lab_results table**: `auth.uid() = user_id` for upload/result isolation
- **Edge Functions**: Use service role keys to bypass RLS for administrative operations

### Edge Functions Architecture (`supabase/functions/`)

#### **Microservices Pattern:**
Each function has a single responsibility with consistent patterns:

#### **get-plans (`get-plans/index.ts`):**
- **Purpose**: Fetch active Stripe pricing plans
- **Caching Strategy**: Frontend caches for 24 hours to reduce API calls
- **Data Expansion**: Uses `expand: ['data.product']` for product details
- **Error Handling**: Graceful fallback with empty plan list

#### **create-checkout (`create-checkout/index.ts`):**
- **Purpose**: Generate Stripe Checkout Sessions for subscriptions
- **Customer Management**: Auto-creates Stripe customers if needed
- **Metadata Embedding**: Stores `user_id` for webhook processing
- **URL Construction**: Dynamic success/cancel URLs based on frontend origin
- **Promotion Codes**: Enables `allow_promotion_codes: true` for coupon support

#### **payments-webhook (`payments-webhook/index.ts`):**
- **Purpose**: Synchronize Stripe subscription state with database
- **Security**: Verifies Stripe signatures to prevent malicious requests
- **Event Processing**: Handles 6 different Stripe event types
- **User Resolution**: Multiple strategies for matching Stripe customers to users
- **Idempotent Operations**: Handles duplicate webhook events safely
- **Audit Trail**: Logs all events to `webhook_events` table

### Stripe Integration Patterns

#### **Environment Separation:**
- **Development**: Uses test keys and webhooks
- **Production**: Requires live Stripe keys and webhook endpoints
- **Price ID Mapping**: Frontend maps live Price IDs to plan names

#### **Checkout Flow Architecture:**
1. **Frontend**: User clicks "Choose Plan" → `initiateCheckout()`
2. **Edge Function**: Creates Stripe Checkout Session with metadata
3. **Stripe**: User completes payment on hosted checkout page
4. **Webhook**: Stripe sends events to `payments-webhook`
5. **Database**: User subscription data synchronized

#### **Plan Name Resolution (Cascading Strategy):**
1. **Primary**: `plan.product.name` from Stripe Product object
2. **Secondary**: Local `planNames` mapping by Price ID
3. **Tertiary**: `plan.nickname` from Stripe Price
4. **Fallback**: Price ID itself

### AI Integration Architecture

#### **COA Processing Workflow:**
1. **File Upload**: PDF stored in Supabase Storage (`labresults` bucket)
2. **Database Record**: Entry created with `status: 'pending'`
3. **Edge Function**: `process-lab-result` or `process-lab-result-long`
4. **Text Extraction**: PDF parsed to extract raw text
5. **AI Analysis**: Text sent to LLM (OpenAI) with specialized prompts
6. **Result Storage**: Generated description saved with `status: 'completed'`

#### **Analysis Types:**
- **Short Analysis**: Quick extraction for basic COA data
- **Long Analysis**: Comprehensive analysis with detailed insights

### Key Implementation Patterns

#### **Error Handling Strategy:**
- **Multi-Layer Validation**: Client-side, Edge Function, and database validation
- **Graceful Degradation**: UI remains functional when services are unavailable
- **User-Friendly Messages**: Technical errors translated to actionable feedback
- **Comprehensive Logging**: Detailed console output for debugging

#### **Performance Optimizations:**
- **Pricing Cache**: 24-hour localStorage cache reduces Stripe API calls
- **Optimistic Updates**: Immediate UI feedback before server confirmation
- **Progressive Loading**: Skeleton states and lazy loading
- **Efficient Polling**: Limited attempts with exponential backoff

#### **Security Considerations:**
- **Authentication Guards**: Protected routes require valid sessions
- **File Validation**: Size limits, type checking, malicious file prevention
- **Usage Limits**: Subscription-based generation limits enforced
- **Webhook Verification**: Stripe signature validation prevents spoofing

## Development Workflow Patterns

### **Frontend Development:**
1. Use Vite dev server for hot reloading
2. Supabase client connects to hosted instance
3. Environment variables in `.env` file
4. Component development with Storybook (optional)

### **Edge Function Development:**
1. Local testing with `supabase functions serve`
2. Deploy to staging for integration testing
3. Production deployment with live environment variables
4. Webhook testing with Stripe CLI

### **Database Management:**
1. Schema changes via Supabase migrations
2. Type generation with `npm run types:supabase`
3. RLS policies for data security
4. Regular backups and monitoring

## Critical Environment Variables

### **Frontend (.env):**
```env
VITE_SUPABASE_URL=https://project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_... # Live key for production
```

### **Edge Functions (Supabase Dashboard):**
```env
STRIPE_SECRET_KEY=sk_live_...           # Live secret key
STRIPE_WEBHOOK_SECRET=whsec_...         # Live webhook secret
OPENAI_API_KEY=sk-...                   # AI service API key
SUPABASE_SERVICE_ROLE_KEY=eyJ...        # Admin database access
```

## Testing and Quality Assurance

### **Testing Strategy:**
- **Unit Tests**: Component testing with React Testing Library
- **Integration Tests**: End-to-end user flows with Cypress
- **API Testing**: Edge Function testing with curl/Postman
- **Webhook Testing**: Stripe CLI for webhook simulation

### **Code Quality:**
- **TypeScript**: Strong typing with minimal `any` usage
- **ESLint**: Configured for React and TypeScript best practices
- **Prettier**: Consistent code formatting
- **shadcn/ui**: Accessible, customizable UI components

This architecture demonstrates production-ready patterns for a subscription-based SaaS platform with complex file processing, AI integration, and robust payment handling.
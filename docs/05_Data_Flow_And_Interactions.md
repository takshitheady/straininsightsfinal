# Data Flow and Interactions

This document details the data flow and interactions within the StrainInsights application, including the comprehensive admin management system.

## 1. Overview

The StrainInsights application follows a multi-tier architecture with clear separation between frontend, backend services, and data persistence layers. Data flows through well-defined channels with proper authentication, authorization, and error handling.

## 2. System Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  React Frontend │────│  Supabase Edge   │────│   PostgreSQL    │
│                 │    │    Functions     │    │    Database     │
│  - User UI      │    │  - Business      │    │  - User Data    │
│  - Admin UI     │    │    Logic         │    │  - Subscriptions│
│  - Auth UI      │    │  - Payments      │    │  - Lab Results  │
└─────────────────┘    │  - Admin Ops     │    │  - Admin Views  │
         │              └──────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌──────────────────┐    ┌─────────────────┐
         └──────────────│  Supabase Auth   │────│  Stripe API     │
                        │                  │    │                 │
                        │  - JWT Tokens    │    │  - Payments     │
                        │  - Google OAuth  │    │  - Webhooks     │
                        │  - Session Mgmt  │    │  - Subscriptions│
                        └──────────────────┘    └─────────────────┘
```

## 3. Core Data Flows

### 3.1. User Authentication Flow

#### Standard User Authentication
```
1. User Login Request
   ├─ Frontend (LoginForm.tsx)
   ├─ Supabase Auth (email/password or Google OAuth)
   ├─ JWT Token Generation
   ├─ Database Trigger (handle_new_user/handle_user_update)
   └─ Frontend State Update (useAuth hook)

2. Session Management
   ├─ Automatic Token Refresh
   ├─ Persistent Session Storage
   ├─ Route Protection (PrivateRoute component)
   └─ Context Propagation (AuthProvider)
```

#### Admin Authentication Flow *(NEW)*
```
1. Admin Login
   ├─ Standard User Authentication (above)
   ├─ Admin Authorization Check
   │  ├─ AdminAuthGuard Component
   │  ├─ Database Function Call: is_admin(user_email)
   │  └─ Admin Status Verification
   └─ Admin Dashboard Access Grant/Deny

2. Admin Session Verification
   ├─ JWT Token Validation
   ├─ Admin Role Re-verification (on sensitive operations)
   ├─ Service Role Access (for database operations)
   └─ Audit Logging
```

### 3.2. User Registration and Profile Management

#### New User Registration
```
1. Frontend Registration
   ├─ SignUpForm.tsx (email/password or Google OAuth)
   ├─ Supabase Auth.signUp()
   └─ Redirect to Email Verification (if email/password)

2. Database Profile Creation
   ├─ Auth Trigger: on_auth_user_created
   ├─ Function: handle_new_user()
   ├─ Insert into users table with defaults:
   │  ├─ current_plan_id: 'free'
   │  ├─ generation_limit: 1
   │  └─ generations_used: 0
   └─ User Profile Ready

3. Profile Updates
   ├─ Auth Trigger: on_auth_user_updated
   ├─ Function: handle_user_update()
   └─ Sync profile data between auth.users and users tables
```

## 4. Subscription Management Flows

### 4.1. Plan Selection and Checkout

```
1. Plan Selection
   ├─ Frontend: PricingSection.tsx
   ├─ Get Plans: supabase.functions.invoke('get-plans')
   ├─ Edge Function: get-plans
   ├─ Stripe API: stripe.prices.list()
   └─ Frontend: Display plans with pricing

2. Checkout Initiation
   ├─ Frontend: initiateCheckout() (stripeUtils.ts)
   ├─ Edge Function: create-checkout
   ├─ Customer Management:
   │  ├─ Retrieve or Create Stripe Customer
   │  └─ Link to User Account
   ├─ Checkout Session Creation:
   │  ├─ Subscription Mode
   │  ├─ User Metadata Embedding
   │  └─ Success/Cancel URL Configuration
   └─ Redirect: Stripe Checkout Page

3. Payment Processing
   ├─ Stripe Checkout Completion
   ├─ Webhook Event: checkout.session.completed
   ├─ Edge Function: payments-webhook
   └─ User Plan Activation (see Webhook Processing)
```

### 4.2. Enhanced Webhook Processing with Generation Preservation

```
1. Webhook Event Reception
   ├─ Stripe sends webhook to payments-webhook function
   ├─ Signature Verification (security)
   ├─ Event Type Routing
   └─ Event Processing

2. checkout.session.completed
   ├─ Extract user and subscription data
   ├─ Generation Preservation Logic:
   │  ├─ Get current user data
   │  ├─ Calculate unused generations
   │  ├─ Add to new plan limit
   │  └─ Set preserved usage count
   ├─ User Plan Update:
   │  ├─ current_plan_id → new plan
   │  ├─ generation_limit → preserved limit
   │  └─ generations_used → preserved usage
   └─ Subscription Record Creation

3. customer.subscription.updated
   ├─ Plan Change Detection
   ├─ Generation Preservation Application
   ├─ Subscription Status Update
   └─ Billing Period Management

4. customer.subscription.deleted
   ├─ Cancellation Processing
   ├─ Downgrade to Free Plan
   ├─ Generation Limit Adjustment
   └─ Status Cleanup
```

### 4.3. Generation Preservation Logic

```
// Example: Basic plan user (100 limit, 75 used = 25 remaining) upgrades to Pro
Current State:
├─ Plan: Basic
├─ Limit: 100
├─ Used: 75
└─ Remaining: 25

Upgrade Process:
├─ New Plan: Pro (500 base limit)
├─ Preserved Generations: 25
├─ New Total Limit: 525 (500 + 25)
└─ New Usage Count: 25 (preserves remaining as "used")

Final State:
├─ Plan: Pro
├─ Limit: 525
├─ Used: 25
└─ Available: 500 (effective new generations)
```

## 5. Admin System Data Flows *(NEW)*

### 5.1. Admin Dashboard Overview

```
1. Admin Dashboard Access
   ├─ Frontend: /admin route
   ├─ AdminAuthGuard verification
   ├─ Admin dashboard load
   └─ Multiple data requests in parallel:
      ├─ Platform metrics
      ├─ User analytics
      ├─ Recent user activity
      └─ System status

2. Admin Data Fetching
   ├─ Frontend: AdminOverview.tsx
   ├─ Edge Function: admin-operations
   ├─ Action: get_analytics
   ├─ Database Views:
   │  ├─ admin_user_overview
   │  └─ admin_user_analytics
   └─ Aggregated Response to Frontend
```

### 5.2. User Management Operations

#### User List with Pagination
```
1. User List Request
   ├─ Frontend: UserManagement.tsx
   ├─ Search/Filter Parameters
   ├─ Pagination Settings
   └─ Edge Function Call: admin-operations

2. Admin Operations Processing
   ├─ JWT Authentication Verification
   ├─ Admin Authorization Check: is_admin()
   ├─ Database Query: admin_user_overview view
   ├─ Search Filters Applied:
   │  ├─ Email/Name Search (ILIKE)
   │  └─ Plan Filter (exact match)
   ├─ Pagination Applied:
   │  ├─ OFFSET calculation
   │  ├─ LIMIT application
   │  └─ Total count
   └─ Structured Response with pagination metadata

3. Frontend Update
   ├─ User List State Update
   ├─ Pagination Controls Update
   └─ Loading State Management
```

#### User Plan Updates
```
1. Plan Update Request
   ├─ Frontend: EditUserModal (UserManagement.tsx)
   ├─ Form Data Collection:
   │  ├─ planId ('free' | 'basic' | 'pro')
   │  └─ generationLimit (number)
   ├─ Edge Function: admin-operations
   └─ Action: update_user_plan

2. Secure Plan Update Processing
   ├─ Admin Authorization Verification
   ├─ User ID Resolution:
   │  ├─ Convert user_id string to UUID
   │  └─ Database lookup for actual UUID
   ├─ Database Function Call: update_user_plan()
   │  ├─ Plan assignment
   │  ├─ Generation limit setting
   │  └─ Usage counter reset
   ├─ Audit Logging
   └─ Success Response

3. Frontend State Synchronization
   ├─ User List Update
   ├─ Modal Close
   ├─ Toast Notification
   └─ UI Refresh
```

#### User Deletion
```
1. Delete Request
   ├─ Frontend: Confirmation Dialog
   ├─ Edge Function: admin-operations
   └─ Action: delete_user

2. Cascade Deletion Processing
   ├─ Admin Authorization Check
   ├─ Related Data Deletion:
   │  ├─ lab_results (user's uploads)
   │  └─ subscriptions (billing data)
   ├─ User Record Deletion
   ├─ Audit Logging
   └─ Success Response

3. Frontend Cleanup
   ├─ User List Refresh
   ├─ Success Notification
   └─ UI State Update
```

### 5.3. Analytics and Reporting

#### Platform Metrics Flow
```
1. Metrics Request
   ├─ Frontend: AdminOverview.tsx
   ├─ Edge Function: admin-operations
   └─ Action: get_analytics (type: platform_metrics)

2. Data Aggregation
   ├─ User Statistics:
   │  ├─ Total users count
   │  ├─ Plan distribution (free/basic/pro)
   │  └─ Active subscribers count
   ├─ Upload Statistics:
   │  └─ Total lab results processed
   └─ Real-time Calculation

3. Response and Display
   ├─ Structured metrics object
   ├─ Frontend: Metrics cards display
   └─ Visual indicators and trends
```

#### User Growth Analytics
```
1. Growth Data Request
   ├─ Frontend: Analytics section
   ├─ Time period selection (week/month/year)
   └─ Edge Function: admin-operations

2. Database View Query
   ├─ admin_user_analytics view
   ├─ Date range filtering
   ├─ Registration metrics:
   │  ├─ Daily user registrations
   │  └─ Plan distribution by date
   └─ Ordered by date (newest first)

3. Frontend Visualization
   ├─ Chart/Graph rendering
   ├─ Trend analysis
   └─ Growth indicators
```

## 6. File Upload and Processing Flows

### 6.1. COA Upload Process

```
1. File Selection and Validation
   ├─ Frontend: Upload.tsx
   ├─ Client-side validation:
   │  ├─ File type (PDF only)
   │  ├─ File size (max 1MB)
   │  └─ User generation limit check
   └─ Upload initiation

2. File Upload to Storage
   ├─ Supabase Storage: labresults bucket
   ├─ File path: {user_id}/{timestamp}-{filename}
   ├─ Storage policies: User-specific access
   └─ Upload confirmation

3. Database Record Creation
   ├─ Insert into lab_results table:
   │  ├─ user_id (FK to auth.users)
   │  ├─ file_name
   │  ├─ storage_path
   │  └─ status: 'pending'
   ├─ Increment user generations_used
   └─ Update status to 'processing'

4. AI Processing (Edge Function)
   ├─ process-lab-result function invocation
   ├─ PDF text extraction
   ├─ AI/LLM analysis
   ├─ Description generation
   └─ Database update: status → 'completed'

5. Result Polling and Display
   ├─ Frontend: Polling mechanism (3-second intervals)
   ├─ Status check: lab_results table
   ├─ Description retrieval when completed
   └─ UI update with results
```

## 7. Data Security and Access Control

### 7.1. Row Level Security (RLS) Implementation

```
Database Table Access Control:

users table:
├─ User Access: auth.uid() = id (own records only)
├─ Service Role: Full access (admin operations)
└─ Triggers: Auto-creation on auth events

subscriptions table:
├─ User Access: user_id = auth.uid()::text (own subscriptions)
├─ Service Role: Full access (webhook processing)
└─ Admin Access: Via service role only

lab_results table:
├─ User Access: auth.uid() = user_id (own uploads)
├─ Service Role: Full access (processing functions)
└─ CRUD Operations: User-scoped only

Admin Views:
├─ admin_user_overview: Service role access only
├─ admin_user_analytics: Service role access only
└─ No direct user access (admin functions only)
```

### 7.2. Authentication Layers

```
Security Stack:

1. Frontend Authentication
   ├─ JWT Token Validation
   ├─ Route Protection (PrivateRoute)
   ├─ Admin Route Protection (AdminAuthGuard)
   └─ Session Management

2. Edge Function Security
   ├─ CORS Configuration
   ├─ Authorization Header Validation
   ├─ Admin Role Verification
   └─ Input Validation and Sanitization

3. Database Security
   ├─ Row Level Security Policies
   ├─ Function Security (SECURITY DEFINER)
   ├─ Service Role Access Control
   └─ Admin Function Restrictions

4. API Security
   ├─ Stripe Webhook Signature Verification
   ├─ Rate Limiting (planned)
   ├─ Environment Variable Protection
   └─ Error Information Filtering
```

## 8. Error Handling and Recovery

### 8.1. Frontend Error Handling

```
Error Handling Strategy:

1. User Interface Errors
   ├─ Form Validation Messages
   ├─ Toast Notifications for Actions
   ├─ Loading States and Indicators
   └─ Graceful Degradation

2. API Communication Errors
   ├─ Network Error Handling
   ├─ Timeout Management
   ├─ Retry Logic (where appropriate)
   └─ User-Friendly Error Messages

3. Admin Interface Errors
   ├─ Operation Failure Notifications
   ├─ Validation Error Display
   ├─ Rollback Capability (where applicable)
   └─ Detailed Error Logging
```

### 8.2. Backend Error Recovery

```
Edge Function Error Handling:

1. Webhook Processing
   ├─ Signature Verification Failures
   ├─ Database Operation Failures
   ├─ Fallback Mechanisms (SQL functions)
   └─ Stripe Retry Prevention (200 responses)

2. Admin Operations
   ├─ Authorization Failures
   ├─ Database Query Errors
   ├─ Data Type Mismatches
   └─ Comprehensive Error Logging

3. Payment Processing
   ├─ Customer Creation Failures
   ├─ Checkout Session Errors
   ├─ Plan Resolution Issues
   └─ Generation Preservation Failures
```

## 9. Performance Optimization Flows

### 9.1. Caching Strategies

```
Frontend Caching:
├─ Plan Data: localStorage (24 hours)
├─ User Session: Persistent storage
├─ Admin Data: Component-level state
└─ Query Results: Short-term memory cache

Backend Optimization:
├─ Database Views: Pre-computed admin data
├─ Indexes: Strategic indexing on query columns
├─ Connection Pooling: Built-in Supabase management
└─ Edge Function Cold Start: Minimal dependencies
```

### 9.2. Database Query Optimization

```
Optimized Query Patterns:

1. Admin User Queries
   ├─ Selective Field Selection
   ├─ Indexed Column Filtering
   ├─ Proper Pagination with OFFSET/LIMIT
   └─ Efficient JOIN Operations in Views

2. Analytics Queries
   ├─ Pre-computed Views
   ├─ Date-based Indexing
   ├─ Aggregation Optimization
   └─ Result Set Limiting

3. Real-time Operations
   ├─ Single-row Updates
   ├─ Atomic Transactions
   ├─ Minimal Data Transfer
   └─ Efficient Status Polling
```

## 10. Monitoring and Observability

### 10.1. Application Monitoring

```
Frontend Monitoring:
├─ Error Boundary Components
├─ Performance Metrics (planned)
├─ User Action Tracking
└─ Admin Operation Logging

Backend Monitoring:
├─ Edge Function Logs (Supabase Dashboard)
├─ Database Performance Metrics
├─ Webhook Success/Failure Rates
└─ Admin Action Audit Trail
```

### 10.2. Data Integrity Monitoring

```
Data Consistency Checks:
├─ User-Subscription Relationship Integrity
├─ Generation Count Accuracy
├─ Plan Assignment Validation
└─ Admin Operation Success Verification

Health Checks:
├─ Database Connection Status
├─ Edge Function Availability
├─ Stripe Integration Status
└─ Authentication Service Health
```

This comprehensive data flow documentation ensures understanding of all system interactions, from basic user operations to complex admin management tasks, providing a complete picture of how data moves through the StrainInsights application ecosystem. 
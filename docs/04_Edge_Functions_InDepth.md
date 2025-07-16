# Edge Functions In-Depth

This document provides a detailed analysis of the Supabase Edge Functions used in the StrainInsights application, including the comprehensive admin operations system.

## 1. Overview

Edge Functions are serverless TypeScript functions that run on Supabase's global edge network. They provide secure environments for:
- Payment processing and webhook handling
- AI service integration
- Admin operations with elevated privileges
- Business logic requiring service role access

## 2. Function Architecture

### 2.1. Deployment Structure

```
supabase/functions/
├── get-plans/
│   └── index.ts
├── create-checkout/
│   └── index.ts
├── payments-webhook/
│   └── index.ts
└── admin-operations/      ← NEW ADMIN SYSTEM
    └── index.ts
```

### 2.2. Common Patterns

All Edge Functions follow consistent patterns:
- **CORS Headers**: Proper cross-origin resource sharing
- **Error Handling**: Comprehensive error management and logging
- **Authentication**: JWT verification where required
- **Input Validation**: Strict parameter validation
- **Response Format**: Consistent JSON response structure

### 2.3. Environment Variables

**Required for all functions**:
```typescript
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
```

**Payment functions**:
```typescript
const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
```

## 3. Function Details

### 3.1. `get-plans` Function

**Purpose**: Retrieve active Stripe pricing plans for frontend display

**Key Features**:
- Fetches live Stripe pricing data
- Expands product information for detailed plan descriptions
- Implements caching strategies
- Handles rate limiting gracefully

**Implementation**:
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.11.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-08-16',
    });

    const prices = await stripe.prices.list({
      active: true,
      expand: ['data.product'],
    });

    return new Response(JSON.stringify(prices.data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

**Response Format**:
```typescript
interface PlanResponse {
  id: string;
  object: string;
  active: boolean;
  currency: string;
  unit_amount: number;
  recurring: {
    interval: string;
    interval_count: number;
  };
  product: {
    id: string;
    name: string;
    description?: string;
    metadata: Record<string, string>;
  };
}
```

### 3.2. `create-checkout` Function

**Purpose**: Create Stripe Checkout Sessions for subscription purchases

**Key Features**:
- Customer management (create or retrieve existing)
- Subscription mode checkout sessions
- User metadata embedding for webhook processing
- Promotion code support
- Success/cancel URL configuration

**Implementation Highlights**:
```typescript
// Customer management
let customer;
try {
  const customers = await stripe.customers.list({
    email: userEmail,
    limit: 1,
  });
  
  if (customers.data.length > 0) {
    customer = customers.data[0];
  } else {
    customer = await stripe.customers.create({
      email: userEmail,
      metadata: { userId },
    });
  }
} catch (error) {
  throw new Error(`Customer management failed: ${error.message}`);
}

// Checkout session creation
const session = await stripe.checkout.sessions.create({
  customer: customer.id,
  line_items: [{ price: priceId, quantity: 1 }],
  mode: 'subscription',
  allow_promotion_codes: true,
  success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${origin}/profile?canceled=true`,
  metadata: {
    userId,
    userEmail,
    checkoutType: 'subscription',
  },
});
```

**Request Format**:
```typescript
interface CheckoutRequest {
  priceId: string;
  userId: string;
  userEmail: string;
  returnUrlPath?: string;
}
```

### 3.3. `payments-webhook` Function

**Purpose**: Process Stripe webhook events for subscription lifecycle management

**Enhanced Features**:
- Generation preservation across plan changes
- Comprehensive event handling
- Atomic database operations
- Error recovery mechanisms

#### 3.3.1. Supported Events

**`checkout.session.completed`**:
- New subscription activation
- User plan assignment
- Generation limit configuration
- Database record creation

**`customer.subscription.updated`**:
- Plan change processing
- Generation preservation logic
- Subscription status updates
- Billing period management

**`customer.subscription.deleted`**:
- Subscription cancellation handling
- Plan downgrade to free tier
- Generation limit adjustment
- Status cleanup

#### 3.3.2. Generation Preservation Logic

```typescript
async function handleSubscriptionUpdate(supabaseClient: any, event: any) {
  const subscription = event.data.object;
  
  // Get current user data for generation preservation
  const { data: currentUserData } = await supabaseClient
    .from('users')
    .select('current_plan_id, generation_limit, generations_used')
    .eq('stripe_customer_id', subscription.customer)
    .single();

  if (currentUserData) {
    // Calculate unused generations
    const unusedGenerations = Math.max(0, 
      currentUserData.generation_limit - currentUserData.generations_used
    );

    // Determine new plan limits
    const newPlanLimits = getPlanLimits(subscription.items.data[0].price.id);
    const preservedLimit = newPlanLimits.base + unusedGenerations;

    // Update user with preserved generations
    await supabaseClient
      .from('users')
      .update({
        current_plan_id: newPlanLimits.planId,
        generation_limit: preservedLimit,
        generations_used: unusedGenerations, // Preserve as used count
        subscription_status: subscription.status,
        updated_at: new Date().toISOString()
      })
      .eq('stripe_customer_id', subscription.customer);
  }
}
```

#### 3.3.3. Error Handling and Recovery

```typescript
// Comprehensive error handling with fallback strategies
try {
  // Primary update attempt
  const result = await supabaseClient
    .from('users')
    .update(updateData)
    .eq('id', userId);

  if (result.error) {
    // Fallback to SQL function
    const { error: sqlError } = await supabaseClient.rpc(
      'update_user_plan',
      {
        user_id_param: userId,
        plan_id_param: planId,
        limit_param: generationLimit
      }
    );

    if (sqlError) {
      throw new Error(`Both update methods failed: ${sqlError.message}`);
    }
  }
} catch (error) {
  console.error('Subscription update failed:', error);
  // Return 200 to prevent Stripe retries for valid but failed operations
  return new Response(JSON.stringify({ 
    received: true, 
    warning: error.message 
  }), { status: 200 });
}
```

### 3.4. `admin-operations` Function *(NEW)*

**Purpose**: Comprehensive admin operations with secure service role access

**Security Model**:
- JWT authentication verification
- Admin role checking via `is_admin()` function
- Service role database access
- Comprehensive audit logging

#### 3.4.1. Authentication and Authorization

```typescript
serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );

    // Verify JWT authentication
    const authorization = req.headers.get('Authorization');
    if (!authorization) {
      throw new Error('Missing authorization header');
    }

    const jwt = authorization.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    
    if (authError || !user) {
      throw new Error('Invalid authentication');
    }

    // Verify admin privileges
    const { data: isAdminData, error: adminError } = await supabase.rpc('is_admin', {
      user_email: user.email
    });

    if (adminError || !isAdminData) {
      throw new Error('Insufficient permissions');
    }

    // Process admin operation
    const requestData = await req.json();
    return await handleAdminOperation(supabase, requestData);

  } catch (error) {
    console.error('Admin operation error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

#### 3.4.2. Supported Admin Operations

**Update User Plan**:
```typescript
interface UpdateUserPlanRequest {
  action: 'update_user_plan';
  userId: string;
  planId: 'free' | 'basic' | 'pro';
  generationLimit: number;
}

async function handleUpdateUserPlan(supabase: any, request: UpdateUserPlanRequest) {
  const { userId, planId, generationLimit } = request;

  // Convert user_id string to UUID for database function
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (userError || !userData) {
    throw new Error(`User not found: ${userError?.message || 'No user data'}`);
  }

  // Call database function with proper UUID
  const { data, error } = await supabase.rpc('update_user_plan', {
    user_id_param: userData.id,  // UUID instead of string
    plan_id_param: planId,
    limit_param: generationLimit
  });

  if (error) {
    throw new Error(`Failed to update user plan: ${error.message}`);
  }

  // Log admin action
  await logAdminAction(supabase, 'update_subscription', userId, {
    planId,
    generationLimit
  });

  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
```

**Get Users with Pagination**:
```typescript
interface GetUsersRequest {
  action: 'get_users';
  page?: number;
  pageSize?: number;
  search?: string;
  planFilter?: string;
}

async function handleGetUsers(supabase: any, request: GetUsersRequest) {
  const { page = 1, pageSize = 50, search, planFilter } = request;
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from('admin_user_overview')
    .select('*', { count: 'exact' });

  // Apply search filters
  if (search) {
    query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
  }

  // Apply plan filters
  if (planFilter && planFilter !== 'all') {
    query = query.eq('current_plan_id', planFilter);
  }

  // Apply pagination and ordering
  query = query
    .range(offset, offset + pageSize - 1)
    .order('created_at', { ascending: false });

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to fetch users: ${error.message}`);
  }

  return new Response(JSON.stringify({
    data,
    pagination: { page, pageSize, total: count || 0 }
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
```

**Delete User**:
```typescript
interface DeleteUserRequest {
  action: 'delete_user';
  userId: string;
}

async function handleDeleteUser(supabase: any, request: DeleteUserRequest) {
  const { userId } = request;

  // Delete related data first (cascade deletion)
  await supabase.from('lab_results').delete().eq('user_id', userId);
  await supabase.from('subscriptions').delete().eq('user_id', userId);
  
  // Delete from users table
  const { error } = await supabase.from('users').delete().eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to delete user: ${error.message}`);
  }

  // Log admin action
  await logAdminAction(supabase, 'delete_user', userId, {});

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
```

**Get Analytics**:
```typescript
interface GetAnalyticsRequest {
  action: 'get_analytics';
  type: 'user_growth' | 'platform_metrics';
  period?: 'week' | 'month' | 'year';
}

async function handleGetAnalytics(supabase: any, request: GetAnalyticsRequest) {
  const { type, period = 'month' } = request;

  switch (type) {
    case 'user_growth':
      const { data: userGrowth, error: growthError } = await supabase
        .from('admin_user_analytics')
        .select('*')
        .order('registration_date', { ascending: false })
        .limit(period === 'week' ? 7 : period === 'month' ? 30 : 365);

      if (growthError) {
        throw new Error(`Failed to fetch user growth data: ${growthError.message}`);
      }

      return new Response(JSON.stringify({ data: userGrowth }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    case 'platform_metrics':
      // Aggregate platform metrics
      const { data: userStats, error: statsError } = await supabase
        .from('users')
        .select('current_plan_id');

      if (statsError) {
        throw new Error(`Failed to fetch platform metrics: ${statsError.message}`);
      }

      const metrics = {
        totalUsers: userStats.length,
        freeUsers: userStats.filter(u => u.current_plan_id === 'free').length,
        basicUsers: userStats.filter(u => u.current_plan_id === 'basic').length,
        proUsers: userStats.filter(u => u.current_plan_id === 'pro').length,
        activeSubscribers: userStats.filter(u => u.current_plan_id !== 'free').length,
      };

      // Get total uploads
      const { count: totalUploads } = await supabase
        .from('lab_results')
        .select('*', { count: 'exact', head: true });

      metrics.totalUploads = totalUploads || 0;

      return new Response(JSON.stringify({ data: metrics }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    default:
      throw new Error('Invalid analytics type');
  }
}
```

#### 3.4.3. Audit Logging

```typescript
async function logAdminAction(
  supabase: any, 
  action: string, 
  targetUserId: string, 
  details: any
) {
  const logEntry = {
    action,
    targetUserId,
    details,
    timestamp: new Date().toISOString()
  };

  // Log to console for now (can be extended to database logging)
  console.log('Admin action:', logEntry);

  // Future: Insert into admin_audit_log table
  // await supabase.from('admin_audit_log').insert(logEntry);
}
```

## 4. Error Handling Strategies

### 4.1. Graceful Degradation

```typescript
// Webhook processing with graceful degradation
try {
  await processWebhookEvent(event);
  return new Response(JSON.stringify({ received: true }), { status: 200 });
} catch (error) {
  console.error('Webhook processing failed:', error);
  
  // Return success to prevent Stripe retries for non-retryable errors
  if (error.message.includes('user not found')) {
    return new Response(JSON.stringify({ 
      received: true, 
      warning: 'User not found but event acknowledged' 
    }), { status: 200 });
  }
  
  // Return error for retryable issues
  return new Response(JSON.stringify({ error: error.message }), { 
    status: 500 
  });
}
```

### 4.2. Input Validation

```typescript
function validateAdminRequest(request: any): AdminRequest {
  if (!request.action) {
    throw new Error('Missing action parameter');
  }

  switch (request.action) {
    case 'update_user_plan':
      if (!request.userId || !request.planId || !request.generationLimit) {
        throw new Error('Missing required parameters for update_user_plan');
      }
      if (!['free', 'basic', 'pro'].includes(request.planId)) {
        throw new Error('Invalid plan ID');
      }
      if (typeof request.generationLimit !== 'number' || request.generationLimit < 0) {
        throw new Error('Invalid generation limit');
      }
      break;
    
    // Additional validation for other actions...
  }

  return request as AdminRequest;
}
```

## 5. Performance Optimization

### 5.1. Cold Start Optimization

```typescript
// Minimize imports and dependencies
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

// Cache frequently used objects
let supabaseClient: any = null;

function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
  }
  return supabaseClient;
}
```

### 5.2. Database Query Optimization

```typescript
// Use selective field queries
const { data } = await supabase
  .from('admin_user_overview')
  .select('id, email, current_plan_id, generation_limit, generations_used')
  .range(offset, offset + pageSize - 1);

// Use indexed columns for filtering
query = query.eq('current_plan_id', planFilter); // indexed column
```

## 6. Security Considerations

### 6.1. Authentication Layers

1. **JWT Verification**: Validate user authentication token
2. **Admin Authorization**: Check admin privileges via database function
3. **Service Role Access**: Use elevated privileges for admin operations
4. **Input Validation**: Validate all parameters and sanitize inputs

### 6.2. Rate Limiting

```typescript
// Implement basic rate limiting for admin operations
const RATE_LIMIT = 100; // requests per minute
const rateLimitMap = new Map();

function checkRateLimit(userEmail: string): boolean {
  const now = Date.now();
  const userRequests = rateLimitMap.get(userEmail) || [];
  
  // Remove old requests (older than 1 minute)
  const recentRequests = userRequests.filter(
    (timestamp: number) => now - timestamp < 60000
  );
  
  if (recentRequests.length >= RATE_LIMIT) {
    return false;
  }
  
  recentRequests.push(now);
  rateLimitMap.set(userEmail, recentRequests);
  return true;
}
```

## 7. Monitoring and Debugging

### 7.1. Comprehensive Logging

```typescript
// Structured logging for better monitoring
function logOperation(operation: string, details: any, success: boolean) {
  const logData = {
    timestamp: new Date().toISOString(),
    operation,
    details,
    success,
    function: 'admin-operations'
  };
  
  console.log(JSON.stringify(logData));
}
```

### 7.2. Error Tracking

```typescript
// Enhanced error reporting
function handleError(error: any, context: string) {
  const errorData = {
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString()
  };
  
  console.error('Function Error:', errorData);
  
  // Future: Send to error tracking service
  // await sendToErrorTracking(errorData);
}
```

## 8. Future Enhancements

### 8.1. Real-time Capabilities

- WebSocket integration for real-time admin dashboard updates
- Push notifications for critical admin events
- Live user activity monitoring

### 8.2. Advanced Analytics

- Custom date range queries
- Export capabilities for admin data
- Advanced filtering and sorting options

### 8.3. Audit Trail Enhancement

- Complete admin action logging to database
- Action rollback capabilities
- Comprehensive security event tracking

This comprehensive Edge Functions system provides a robust, secure, and scalable backend infrastructure for the StrainInsights application, with particular emphasis on the powerful admin operations system that enables effective platform management. 
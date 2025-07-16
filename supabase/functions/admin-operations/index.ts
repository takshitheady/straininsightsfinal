import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

interface UpdateUserPlanRequest {
  action: 'update_user_plan';
  userId: string;
  planId: 'free' | 'basic' | 'pro';
  generationLimit: number;
}

interface DeleteUserRequest {
  action: 'delete_user';
  userId: string;
}

interface GetUsersRequest {
  action: 'get_users';
  page?: number;
  pageSize?: number;
  search?: string;
  planFilter?: string;
}

interface GetAnalyticsRequest {
  action: 'get_analytics';
  type: 'user_growth' | 'revenue' | 'platform_metrics';
  period?: 'week' | 'month' | 'year';
}

type AdminRequest = UpdateUserPlanRequest | DeleteUserRequest | GetUsersRequest | GetAnalyticsRequest;

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key for admin operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get the authorization header
    const authorization = req.headers.get('Authorization');
    if (!authorization) {
      throw new Error('Missing authorization header');
    }

    // Verify the user is authenticated and is an admin
    const jwt = authorization.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    
    if (authError || !user) {
      throw new Error('Invalid authentication');
    }

    // Check if user is admin
    const { data: isAdminData, error: adminError } = await supabase.rpc('is_admin', {
      user_email: user.email
    });

    if (adminError || !isAdminData) {
      throw new Error('Insufficient permissions');
    }

    const requestData: AdminRequest = await req.json();

    switch (requestData.action) {
      case 'update_user_plan':
        return await handleUpdateUserPlan(supabase, requestData);
        
      case 'delete_user':
        return await handleDeleteUser(supabase, requestData);
        
      case 'get_users':
        return await handleGetUsers(supabase, requestData);
        
      case 'get_analytics':
        return await handleGetAnalytics(supabase, requestData);
        
      default:
        throw new Error('Invalid action');
    }

  } catch (error) {
    console.error('Admin operation error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function handleUpdateUserPlan(supabase: any, request: UpdateUserPlanRequest) {
  const { userId, planId, generationLimit } = request;

  // First, get the actual UUID from the users table using the user_id string
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (userError || !userData) {
    throw new Error(`User not found: ${userError?.message || 'No user data'}`);
  }

  // Use the existing update_user_plan function with the UUID
  const { data, error } = await supabase.rpc('update_user_plan', {
    user_id_param: userData.id,
    plan_id_param: planId,
    limit_param: generationLimit
  });

  if (error) {
    throw new Error(`Failed to update user plan: ${error.message}`);
  }

  // Log the admin action
  await logAdminAction(supabase, 'update_subscription', userId, {
    planId,
    generationLimit
  });

  return new Response(
    JSON.stringify({ success: true, data }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function handleDeleteUser(supabase: any, request: DeleteUserRequest) {
  const { userId } = request;

  // First, delete related data
  await supabase.from('lab_results').delete().eq('user_id', userId);
  await supabase.from('subscriptions').delete().eq('user_id', userId);
  
  // Delete from users table
  const { error } = await supabase.from('users').delete().eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to delete user: ${error.message}`);
  }

  // Log the admin action
  await logAdminAction(supabase, 'delete_user', userId, {});

  return new Response(
    JSON.stringify({ success: true }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function handleGetUsers(supabase: any, request: GetUsersRequest) {
  const { page = 1, pageSize = 50, search, planFilter } = request;
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from('admin_user_overview')
    .select('*', { count: 'exact' });

  // Apply filters
  if (search) {
    query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
  }

  if (planFilter && planFilter !== 'all') {
    query = query.eq('current_plan_id', planFilter);
  }

  // Apply pagination
  query = query.range(offset, offset + pageSize - 1).order('created_at', { ascending: false });

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to fetch users: ${error.message}`);
  }

  return new Response(
    JSON.stringify({
      data,
      pagination: {
        page,
        pageSize,
        total: count || 0
      }
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
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

      return new Response(
        JSON.stringify({ data: userGrowth }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );

    case 'platform_metrics':
      // Get total users by plan
      const { data: userStats, error: statsError } = await supabase
        .from('users')
        .select('current_plan_id')
        .not('current_plan_id', 'is', null);

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

      return new Response(
        JSON.stringify({ data: metrics }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );

    default:
      throw new Error('Invalid analytics type');
  }
}

async function logAdminAction(supabase: any, action: string, targetUserId: string, details: any) {
  // This would log admin actions for audit purposes
  // For now, we'll just console.log it
  console.log('Admin action:', { action, targetUserId, details, timestamp: new Date().toISOString() });
} 
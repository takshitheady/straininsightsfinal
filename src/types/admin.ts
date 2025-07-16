// Admin user management types
export interface AdminUser {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  current_plan_id: string;
  generation_limit: number;
  generations_used: number;
  created_at: string;
  subscription_status: string | null;
  current_period_end: number | null;
  total_uploads: number;
}

// Analytics types
export interface UserAnalytics {
  registration_date: string;
  users_registered: number;
  free_users: number;
  basic_users: number;
  pro_users: number;
}

export interface PlatformMetrics {
  totalUsers: number;
  activeSubscribers: number;
  totalUploads: number;
  monthlyRevenue: number;
  freeUsers: number;
  basicUsers: number;
  proUsers: number;
}

// Subscription management types
export interface SubscriptionDetails {
  id: string;
  user_id: string;
  stripe_id: string | null;
  price_id: string | null;
  status: string;
  current_period_start: number | null;
  current_period_end: number | null;
  cancel_at_period_end: boolean | null;
  amount: number | null;
  currency: string | null;
  interval: string | null;
}

// Admin operation types
export interface UpdateUserPlanParams {
  userId: string;
  planId: 'free' | 'basic' | 'pro';
  generationLimit: number;
}

export interface CreateAdminUserParams {
  email: string;
  password: string;
  fullName: string;
  planId: 'free' | 'basic' | 'pro';
}

// Table pagination and filtering
export interface TablePagination {
  page: number;
  pageSize: number;
  total: number;
}

export interface UserFilters {
  search?: string;
  planId?: string;
  subscriptionStatus?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

// Admin dashboard stats
export interface DashboardStats {
  usersToday: number;
  usersThisWeek: number;
  usersThisMonth: number;
  uploadsToday: number;
  uploadsThisWeek: number;
  uploadsThisMonth: number;
  revenueToday: number;
  revenueThisWeek: number;
  revenueThisMonth: number;
}

// Chart data types
export interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
}

export interface UserGrowthData extends ChartDataPoint {
  freeUsers: number;
  basicUsers: number;
  proUsers: number;
}

export interface RevenueData extends ChartDataPoint {
  amount: number;
  currency: string;
}

// API Response types
export interface AdminApiResponse<T> {
  data: T;
  error?: string;
  pagination?: TablePagination;
}

// Admin action types
export type AdminAction = 
  | 'view_users'
  | 'edit_user'
  | 'delete_user'
  | 'update_subscription'
  | 'grant_premium'
  | 'view_analytics'
  | 'export_data';

// Admin permissions
export interface AdminPermissions {
  canViewUsers: boolean;
  canEditUsers: boolean;
  canDeleteUsers: boolean;
  canManageSubscriptions: boolean;
  canViewAnalytics: boolean;
  canExportData: boolean;
}

// Form types for admin operations
export interface EditUserForm {
  email: string;
  fullName: string;
  currentPlanId: 'free' | 'basic' | 'pro';
  generationLimit: number;
  generationsUsed: number;
}

export interface BulkUserOperation {
  userIds: string[];
  operation: 'update_plan' | 'delete' | 'reset_usage';
  params?: {
    planId?: string;
    generationLimit?: number;
  };
}

// Admin notification types
export interface AdminNotification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
}

// Activity log types
export interface AdminActivityLog {
  id: string;
  adminUserId: string;
  adminEmail: string;
  action: AdminAction;
  targetUserId?: string;
  targetUserEmail?: string;
  details: Record<string, any>;
  timestamp: string;
  ipAddress?: string;
} 
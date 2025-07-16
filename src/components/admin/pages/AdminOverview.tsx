import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../../supabase/auth';
import { supabase } from '../../../../supabase/supabase';
import {
  Users,
  Upload,
  DollarSign,
  TrendingUp,
  UserCheck,
  UserX,
  BarChart,
  Clock,
  Shield,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { PlatformMetrics, UserAnalytics } from '../../../types/admin';

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: 'up' | 'down' | 'neutral';
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, change, icon: Icon, trend = 'neutral' }) => {
  const getTrendColor = () => {
    switch (trend) {
      case 'up': return 'text-green-600';
      case 'down': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change && (
          <p className={`text-xs ${getTrendColor()}`}>
            {change}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

interface RecentUser {
  email: string;
  full_name: string | null;
  current_plan_id: string;
  created_at: string;
}

const AdminOverview: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [userGrowth, setUserGrowth] = useState<UserAnalytics[]>([]);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Get platform metrics using the admin operations function
      const { data: metricsData, error: metricsError } = await supabase.functions.invoke(
        'admin-operations',
        {
          body: {
            action: 'get_analytics',
            type: 'platform_metrics'
          },
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          }
        }
      );

      if (metricsError) {
        throw new Error(`Failed to fetch metrics: ${metricsError.message}`);
      }

      setMetrics(metricsData.data);

      // Get user growth data
      const { data: growthData, error: growthError } = await supabase.functions.invoke(
        'admin-operations',
        {
          body: {
            action: 'get_analytics',
            type: 'user_growth',
            period: 'week'
          },
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          }
        }
      );

      if (growthError) {
        throw new Error(`Failed to fetch growth data: ${growthError.message}`);
      }

      setUserGrowth(growthData.data || []);

      // Get recent users (last 10)
      const { data: recentUsersData, error: usersError } = await supabase
        .from('users')
        .select('email, full_name, current_plan_id, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      if (usersError) {
        throw new Error(`Failed to fetch recent users: ${usersError.message}`);
      }

      setRecentUsers(recentUsersData || []);

    } catch (err) {
      console.error('Dashboard data fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getPlanBadgeColor = (planId: string) => {
    switch (planId) {
      case 'pro': return 'bg-purple-100 text-purple-800';
      case 'basic': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-[60px] mb-2" />
                <Skeleton className="h-3 w-[80px]" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-[150px]" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[200px]" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-[120px]" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[200px]" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="text-red-600">Error Loading Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={fetchDashboardData}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Welcome back</h2>
          <p className="text-muted-foreground">
            Here's what's happening with your platform today.
          </p>
        </div>
        <Button onClick={fetchDashboardData} variant="outline">
          Refresh Data
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Users"
          value={metrics?.totalUsers || 0}
          icon={Users}
          trend="up"
        />
        <StatsCard
          title="Active Subscribers"
          value={metrics?.activeSubscribers || 0}
          icon={UserCheck}
          trend="up"
        />
        <StatsCard
          title="Total Uploads"
          value={metrics?.totalUploads || 0}
          icon={Upload}
          trend="up"
        />
        <StatsCard
          title="Free Users"
          value={metrics?.freeUsers || 0}
          icon={UserX}
          trend="neutral"
        />
      </div>

      {/* Detailed Metrics */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart className="h-5 w-5" />
              <span>User Distribution</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Free Plan</span>
              <div className="flex items-center space-x-2">
                <Badge variant="outline">{metrics?.freeUsers || 0}</Badge>
                <span className="text-sm text-muted-foreground">
                  {metrics?.totalUsers ? Math.round((metrics.freeUsers / metrics.totalUsers) * 100) : 0}%
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Basic Plan</span>
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="bg-blue-50">{metrics?.basicUsers || 0}</Badge>
                <span className="text-sm text-muted-foreground">
                  {metrics?.totalUsers ? Math.round((metrics.basicUsers / metrics.totalUsers) * 100) : 0}%
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Pro Plan</span>
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="bg-purple-50">{metrics?.proUsers || 0}</Badge>
                <span className="text-sm text-muted-foreground">
                  {metrics?.totalUsers ? Math.round((metrics.proUsers / metrics.totalUsers) * 100) : 0}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Recent Users</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentUsers.length > 0 ? (
                recentUsers.slice(0, 5).map((recentUser, index) => (
                  <div key={index} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium">
                        {recentUser.full_name || recentUser.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {recentUser.email}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge 
                        variant="outline" 
                        className={getPlanBadgeColor(recentUser.current_plan_id)}
                      >
                        {recentUser.current_plan_id || 'free'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(recentUser.created_at)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No recent users found.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Quick Actions</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <Button variant="outline" className="h-auto flex-col py-4" asChild>
              <a href="/admin/users">
                <Users className="h-6 w-6 mb-2" />
                <span>Manage Users</span>
              </a>
            </Button>
            <Button variant="outline" className="h-auto flex-col py-4" asChild>
              <a href="/admin/analytics">
                <BarChart className="h-6 w-6 mb-2" />
                <span>View Analytics</span>
              </a>
            </Button>
            <Button variant="outline" className="h-auto flex-col py-4" onClick={fetchDashboardData}>
              <TrendingUp className="h-6 w-6 mb-2" />
              <span>Refresh Data</span>
            </Button>
            <Button variant="outline" className="h-auto flex-col py-4" asChild>
              <a href="/admin/settings">
                <Shield className="h-6 w-6 mb-2" />
                <span>Settings</span>
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminOverview; 
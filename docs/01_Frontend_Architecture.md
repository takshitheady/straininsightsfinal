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
    -   **`admin/`: Complete admin dashboard system** *(NEW)*
        -   `components/`: Reusable admin components
            -   `AdminAuthGuard.tsx`: Route protection for admin-only access
        -   `layout/`: Admin dashboard layout components
            -   `AdminLayout.tsx`: Main admin dashboard layout with sidebar navigation
        -   `pages/`: Admin-specific page components
            -   `AdminOverview.tsx`: Analytics dashboard with key metrics
            -   `UserManagement.tsx`: User CRUD operations and plan management
            -   `AdminSettings.tsx`: Admin user management and platform settings
-   `lib/`: Utility functions and helper modules (e.g., `stripeUtils.ts`).
-   `stories/`: Storybook stories for component development and testing (not extensively used in this project).
-   `supabase/`: Supabase client setup and authentication context (`auth.tsx`, `supabase.ts`).
-   `types/`: TypeScript type definitions
    -   `supabase.ts`: Auto-generated Supabase types
    -   **`admin.ts`: Admin-specific type definitions** *(NEW)*
-   `App.tsx`: The main application component, sets up routing.
-   `main.tsx`: The entry point of the application.

## 4. Routing

Client-side routing is managed by `react-router-dom`. The main routes are defined in `src/App.tsx`.

### 4.1. Public Routes
-   `/`: Home page (`src/components/pages/home.tsx`)
-   `/login`: Login page (`src/components/auth/LoginForm.tsx`)
-   `/signup`: Sign up page (`src/components/auth/SignUpForm.tsx`)
-   `/success`: Page displayed after successful Stripe checkout.

### 4.2. Private Routes (User Authentication Required)
-   `/upload`: File upload page (`src/components/pages/Upload.tsx`)
-   `/output-history`: User's COA processing history (`src/components/pages/OutputHistory.tsx`)
-   `/profile`: User profile and subscription management (`src/components/pages/Profile.tsx`)

### 4.3. Admin Routes (Admin Authentication Required) *(NEW)*
-   `/admin`: Admin dashboard overview (`src/components/admin/pages/AdminOverview.tsx`)
-   `/admin/users`: User management interface (`src/components/admin/pages/UserManagement.tsx`)
-   `/admin/settings`: Admin settings and configuration (`src/components/admin/pages/AdminSettings.tsx`)

A `PrivateRoute` higher-order component in `src/App.tsx` protects routes that require authentication. It checks the user's authentication status using the `useAuth` hook from `src/supabase/auth.tsx`. Additionally, key call-to-action buttons (like "Upload" or "Choose Plan") incorporate checks: if a user is not authenticated, they are prompted to log in, often redirecting to the login page with a return path.

**Admin routes are protected by `AdminAuthGuard`** which verifies both user authentication and admin privileges through the `is_admin` database function.

## 5. State Management

-   **Component-Level State**: Primarily managed using React's `useState` and `useEffect` hooks for local component data and side effects.
-   **Authentication State**: Handled via the `useAuth` hook from `src/supabase/auth.tsx`, providing user session management across the application.
-   **Admin State**: Managed locally within admin components with real-time data fetching from Supabase Edge Functions.

## 6. Authentication & Authorization

### 6.1. User Authentication
The application uses Supabase Auth for user management with support for:
-   **Email/Password Authentication**: Traditional email and password signup/login
-   **Google OAuth**: Social authentication via Google
-   **Session Management**: Automatic token refresh and session persistence
-   **Protected Routes**: Route-level authentication checks

### 6.2. Admin Authorization *(NEW)*
A comprehensive admin system with role-based access control:

#### Admin Access Control
```typescript
// AdminAuthGuard.tsx - Protects admin routes
const AdminAuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [checking, setChecking] = useState<boolean>(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) return;
      
      const { data, error } = await supabase.rpc('is_admin', {
        user_email: user.email
      });
      
      setIsAdmin(!!data);
      setChecking(false);
    };

    checkAdminStatus();
  }, [user]);

  // Returns admin interface or access denied
};
```

#### Admin Roles
-   **Super Admin**: Full platform access and user management
-   **Admin**: User management and analytics access
-   **Role Assignment**: Managed via database function `is_admin(user_email)`

## 7. Component Architecture

### 7.1. Authentication Components
-   **`AuthLayout.tsx`**: Shared layout for login/signup pages
-   **`LoginForm.tsx`**: User login interface with Google OAuth
-   **`SignUpForm.tsx`**: User registration interface

### 7.2. Dashboard Components
-   **User Dashboard**: Personal analytics and file management
-   **`ActivityFeed.tsx`**: Recent user activity display
-   **`TaskBoard.tsx`**: Task management interface
-   **`UserProfile.tsx`**: User profile management

### 7.3. Admin Dashboard Components *(NEW)*

#### Core Admin Components
```typescript
// AdminLayout.tsx - Main admin dashboard layout
interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="lg:pl-64">
        <TopNavigation />
        <main className="py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
```

#### Admin Page Components

**AdminOverview.tsx - Analytics Dashboard**
-   User registration metrics
-   Plan distribution analytics
-   Revenue tracking
-   Platform usage statistics
-   Recent user activity feed

**UserManagement.tsx - User CRUD Interface**
-   User search and filtering
-   Plan management (free/basic/pro)
-   Generation limit control
-   User deletion capabilities
-   Bulk operations support

**AdminSettings.tsx - Platform Configuration**
-   Admin user management
-   System settings configuration
-   Platform-wide controls

## 8. Data Flow Architecture

### 8.1. User Data Flow
```
User Action → React Component → Supabase Client → Database/Edge Function → Response → Component Update
```

### 8.2. Admin Data Flow *(NEW)*
```
Admin Action → Admin Component → AdminAuthGuard → Supabase Edge Function (admin-operations) → Database → Response → Admin Interface Update
```

#### Admin Operations Flow
1. **Authentication**: Admin logs in with standard user credentials
2. **Authorization**: `AdminAuthGuard` verifies admin status via `is_admin()` function
3. **Data Fetching**: Admin components call `admin-operations` Edge Function
4. **Database Operations**: Edge Function executes admin queries with service role
5. **Response**: Real-time updates to admin interface

### 8.3. Edge Function Integration
-   **`get-plans`**: Fetch Stripe pricing plans
-   **`create-checkout`**: Generate Stripe checkout sessions
-   **`payments-webhook`**: Handle Stripe webhook events
-   **`admin-operations`**: Handle all admin-related database operations *(NEW)*

## 9. Styling & UI Components

### 9.1. Design System
-   **Tailwind CSS**: Utility-first CSS framework
-   **Shadcn/ui**: Consistent, accessible component library
-   **Responsive Design**: Mobile-first approach
-   **Dark/Light Mode**: Theme support (where applicable)

### 9.2. Component Library Usage
```typescript
// Example of Shadcn/ui component usage in admin interface
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Admin dashboard metrics card
<Card>
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
    <CardTitle className="text-sm font-medium">Total Users</CardTitle>
    <Users className="h-4 w-4 text-muted-foreground" />
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold">{metrics?.totalUsers || 0}</div>
    <p className="text-xs text-muted-foreground">
      +20.1% from last month
    </p>
  </CardContent>
</Card>
```

## 10. Type Safety

### 10.1. TypeScript Integration
-   **Strict Mode**: Enabled for maximum type safety
-   **Auto-generated Types**: Supabase CLI generates database types
-   **Custom Types**: Admin-specific interfaces and types

### 10.2. Admin Type Definitions *(NEW)*
```typescript
// src/types/admin.ts
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

export interface PlatformMetrics {
  totalUsers: number;
  activeSubscribers: number;
  totalUploads: number;
  monthlyRevenue: number;
  freeUsers: number;
  basicUsers: number;
  proUsers: number;
}

export interface UpdateUserPlanParams {
  userId: string;
  planId: 'free' | 'basic' | 'pro';
  generationLimit: number;
}
```

## 11. Performance Considerations

### 11.1. Optimization Strategies
-   **Code Splitting**: Route-based code splitting for admin modules
-   **Lazy Loading**: Admin components loaded only when needed
-   **Memoization**: React.memo for expensive admin calculations
-   **Pagination**: Large user lists with server-side pagination

### 11.2. Admin-Specific Optimizations
```typescript
// Lazy loading admin routes
const AdminOverview = lazy(() => import('./components/admin/pages/AdminOverview'));
const UserManagement = lazy(() => import('./components/admin/pages/UserManagement'));
const AdminSettings = lazy(() => import('./components/admin/pages/AdminSettings'));

// Route configuration with Suspense
<Route 
  path="/admin" 
  element={
    <AdminAuthGuard>
      <Suspense fallback={<div>Loading admin panel...</div>}>
        <AdminLayout>
          <AdminOverview />
        </AdminLayout>
      </Suspense>
    </AdminAuthGuard>
  } 
/>
```

## 12. Security Considerations

### 12.1. Authentication Security
-   **JWT Tokens**: Secure session management
-   **Row Level Security**: Database-level access control
-   **HTTPS Only**: Secure communication channels

### 12.2. Admin Security *(NEW)*
-   **Role-Based Access**: Database-level admin verification
-   **Service Role Functions**: Secure admin operations
-   **Audit Logging**: Admin action tracking (implemented in Edge Functions)
-   **Input Validation**: Comprehensive validation for admin operations

```typescript
// Example admin security implementation
const { data: isAdminData, error: adminError } = await supabase.rpc('is_admin', {
  user_email: user.email
});

if (adminError || !isAdminData) {
  throw new Error('Insufficient permissions');
}
```

## 13. Future Enhancements

### 13.1. Planned Features
-   **Real-time Admin Notifications**: Live updates for admin dashboard
-   **Advanced Analytics**: Detailed user behavior analytics
-   **Bulk User Operations**: Enhanced batch processing capabilities
-   **Admin Audit Trail**: Comprehensive admin action logging
-   **Role Hierarchy**: Multiple admin permission levels

### 13.2. Technical Improvements
-   **Caching Strategy**: Redis integration for admin data caching
-   **WebSocket Integration**: Real-time admin dashboard updates
-   **Progressive Web App**: Offline admin capabilities
-   **Advanced Search**: Elasticsearch integration for user search 
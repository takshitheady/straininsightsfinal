import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import {
  Settings,
  Users,
  Shield,
  Mail,
  Plus,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const AdminSettings: React.FC = () => {
  const { toast } = useToast();
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [loading, setLoading] = useState(false);

  // This would typically come from your database
  const [adminEmails] = useState([
    'admin@yourcompany.com', // This should be replaced with actual admin emails
  ]);

  const handleAddAdmin = async () => {
    if (!newAdminEmail) {
      toast({
        title: 'Error',
        description: 'Please enter a valid email address.',
        variant: 'destructive',
      });
      return;
    }

    if (adminEmails.includes(newAdminEmail)) {
      toast({
        title: 'Error',
        description: 'This email is already an admin.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Here you would typically update your database
      // For now, we'll just show a success message
      toast({
        title: 'Admin Added',
        description: `${newAdminEmail} has been added as an admin. Update your database is_admin function to include this email.`,
      });
      setNewAdminEmail('');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add admin. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAdmin = async (email: string) => {
    try {
      // Here you would typically update your database
      toast({
        title: 'Admin Removed',
        description: `${email} has been removed from admin access. Update your database is_admin function to remove this email.`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove admin. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Admin Settings</h2>
        <p className="text-muted-foreground">
          Manage admin access and platform settings.
        </p>
      </div>

      {/* Admin Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Admin Management</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Add Admin */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Add New Admin</h3>
            <div className="flex space-x-2">
              <div className="flex-1">
                <Label htmlFor="admin-email">Admin Email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="admin@example.com"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                />
              </div>
              <Button onClick={handleAddAdmin} disabled={loading} className="mt-6">
                <Plus className="mr-2 h-4 w-4" />
                Add Admin
              </Button>
            </div>
          </div>

          <Separator />

          {/* Current Admins */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Current Admins</h3>
            <div className="space-y-2">
              {adminEmails.map((email, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                      <Shield className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{email}</p>
                      <p className="text-xs text-muted-foreground">Administrator</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="default">Admin</Badge>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Admin Access</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to remove admin access for {email}? 
                            This action cannot be undone and they will lose all admin privileges.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRemoveAdmin(email)}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Remove Admin
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Platform Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Platform Settings</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Default Free Plan Limit</Label>
              <Input type="number" defaultValue="1" />
              <p className="text-xs text-muted-foreground">
                Number of generations for new free users
              </p>
            </div>
            <div className="space-y-2">
              <Label>Basic Plan Limit</Label>
              <Input type="number" defaultValue="30" />
              <p className="text-xs text-muted-foreground">
                Number of generations for basic plan users
              </p>
            </div>
            <div className="space-y-2">
              <Label>Pro Plan Limit</Label>
              <Input type="number" defaultValue="100" />
              <p className="text-xs text-muted-foreground">
                Number of generations for pro plan users
              </p>
            </div>
            <div className="space-y-2">
              <Label>Support Email</Label>
              <Input type="email" defaultValue="support@yourcompany.com" />
              <p className="text-xs text-muted-foreground">
                Email for user support inquiries
              </p>
            </div>
          </div>
          <Button>Save Settings</Button>
        </CardContent>
      </Card>

      {/* Important Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-yellow-600">
            <AlertTriangle className="h-5 w-5" />
            <span>Important Notes</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">Database Function Update Required</h4>
            <p className="text-sm text-muted-foreground">
              To add or remove admin access, you need to update the <code className="bg-muted px-1 rounded">is_admin</code> function 
              in your Supabase database with the new admin email addresses.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">Security</h4>
            <p className="text-sm text-muted-foreground">
              Admin access grants full control over user data and platform settings. 
              Only grant admin access to trusted individuals.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">Current Admin Function</h4>
            <div className="bg-muted p-3 rounded-lg">
              <code className="text-sm">
                {`CREATE OR REPLACE FUNCTION is_admin(user_email text)
RETURNS boolean AS $$
BEGIN
  RETURN user_email IN ('admin@yourcompany.com'); -- Add emails here
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`}
              </code>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSettings; 
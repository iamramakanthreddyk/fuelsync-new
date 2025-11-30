
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import { CheckCircle, AlertCircle, Users, RefreshCw } from "lucide-react";

interface UnconfirmedUsersData {
  totalUsers: number;
  unconfirmedCount: number;
  unconfirmedUsers: Array<{
    id: string;
    email: string;
    createdAt: string;
  }>;
}

export function UserConfirmationManager() {
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [data, setData] = useState<UnconfirmedUsersData | null>(null);
  const { toast } = useToast();

  const fetchUnconfirmedUsers = async () => {
    setIsLoading(true);
    try {
      const result = await apiClient.get<UnconfirmedUsersData>('/users/unconfirmed');
      console.log('📋 Unconfirmed users response:', result);
      setData(result);
    } catch (error: any) {
      console.error('Error fetching unconfirmed users:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch user confirmation data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const confirmAllUsers = async () => {
    setIsConfirming(true);
    try {
      const result = await apiClient.post<{ confirmedCount: number; totalUsers: number }>('/users/confirm-all', {});

      console.log('Confirm all users response:', result);

      toast({
        title: "Users Confirmed",
        description: `Successfully confirmed ${result.confirmedCount} users out of ${result.totalUsers} total users`,
      });

      // Refresh the data
      await fetchUnconfirmedUsers();
    } catch (error: any) {
      console.error('Error confirming users:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to confirm users",
        variant: "destructive",
      });
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Users className="h-5 w-5" />
          <span>User Email Confirmation Manager</span>
        </CardTitle>
        <CardDescription>
          Manage email confirmation status for all users in the system
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex space-x-2">
          <Button 
            onClick={fetchUnconfirmedUsers} 
            disabled={isLoading}
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Check Status
          </Button>
          
          {data && data.unconfirmedCount > 0 && (
            <Button 
              onClick={confirmAllUsers} 
              disabled={isConfirming}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {isConfirming ? 'Confirming...' : `Confirm All (${data.unconfirmedCount})`}
            </Button>
          )}
        </div>

        {data && (
          <div className="space-y-3">
            <Alert className={data.unconfirmedCount === 0 ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}>
              <AlertCircle className={`h-4 w-4 ${data.unconfirmedCount === 0 ? 'text-green-600' : 'text-amber-600'}`} />
              <AlertDescription className={data.unconfirmedCount === 0 ? 'text-green-800' : 'text-amber-800'}>
                {data.unconfirmedCount === 0 
                  ? `All ${data.totalUsers} users are confirmed and can log in normally.`
                  : `${data.unconfirmedCount} out of ${data.totalUsers} users need email confirmation.`
                }
              </AlertDescription>
            </Alert>

            {data.unconfirmedCount > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Unconfirmed Users:</h4>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {data.unconfirmedUsers.map((user) => (
                    <div key={user.id} className="text-sm p-2 bg-gray-50 rounded">
                      <div className="font-medium">{user.email}</div>
                      <div className="text-gray-500 text-xs">
                        Created: {new Date(user.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

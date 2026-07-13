'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, Users, Store } from 'lucide-react';
import RestaurantFormDialog from './RestaurantFormDialog';
import type { Restaurant } from '@restaurant-qr/shared';

interface UserCount {
  total: number;
}

export default function SuperAdminDashboard() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [userCount, setUserCount] = useState<UserCount>({ total: 0 });
  const [loading, setLoading] = useState(true);
  const [dialogState, setDialogState] = useState<
    { mode: 'create' } | { mode: 'edit'; restaurant: Restaurant } | null
  >(null);
  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const [restaurantsResult, usersResult] = await Promise.all([
      supabase.from('restaurants').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
    ]);

    if (restaurantsResult.data) {
      setRestaurants(restaurantsResult.data);
    }

    if (usersResult.count) {
      setUserCount({ total: usersResult.count });
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Super Admin Dashboard</h1>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Restaurants</CardTitle>
              <Store className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{restaurants.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Restaurants</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {restaurants.filter((r) => r.is_active).length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userCount.total}</div>
            </CardContent>
          </Card>
        </div>

        {/* Restaurants List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Restaurants</CardTitle>
                <CardDescription>Manage all restaurants in the system</CardDescription>
              </div>
              <Button onClick={() => setDialogState({ mode: 'create' })}>Add Restaurant</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {restaurants.map((restaurant) => (
                <div
                  key={restaurant.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <h3 className="font-medium">{restaurant.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Created: {new Date(restaurant.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        restaurant.is_active
                          ? 'bg-green-900/50 text-green-300'
                          : 'bg-red-900/50 text-red-300'
                      }`}
                    >
                      {restaurant.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDialogState({ mode: 'edit', restaurant })}
                    >
                      Edit
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {dialogState && (
          <RestaurantFormDialog
            mode={dialogState.mode}
            restaurant={dialogState.mode === 'edit' ? dialogState.restaurant : undefined}
            onSaved={() => {
              setDialogState(null);
              fetchData();
            }}
            onClose={() => setDialogState(null)}
          />
        )}
      </div>
    </div>
  );
}

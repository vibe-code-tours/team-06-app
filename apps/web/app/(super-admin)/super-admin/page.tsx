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
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [dialogState, setDialogState] = useState<
    { mode: 'create' } | { mode: 'edit'; restaurant: Restaurant } | null
  >(null);

  const fetchData = useCallback(async () => {
    const supabase = createClient();

    const [restaurantsResponse, usersResult] = await Promise.all([
      fetch('/api/restaurants'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
    ]);

    if (restaurantsResponse.ok) {
      const { data } = await restaurantsResponse.json();
      setRestaurants(data);
    }

    if (usersResult.count) {
      setUserCount({ total: usersResult.count });
    }

    setLoading(false);
  }, []);

  const handleToggleActive = async (restaurant: Restaurant) => {
    const newIsActive = !restaurant.is_active;
    setTogglingId(restaurant.id);

    // Optimistic update
    setRestaurants((prev) =>
      prev.map((r) =>
        r.id === restaurant.id ? { ...r, is_active: newIsActive } : r
      )
    );

    try {
      const supabase = createClient();

      // Update restaurant is_active
      const { error: restaurantError } = await supabase
        .from('restaurants')
        .update({ is_active: newIsActive })
        .eq('id', restaurant.id);

      if (restaurantError) throw restaurantError;

      // Cascade: if deactivating, also deactivate all profiles for this restaurant
      if (!newIsActive) {
        const { error: profilesError } = await supabase
          .from('profiles')
          .update({ is_active: false })
          .eq('restaurant_id', restaurant.id);

        if (profilesError) throw profilesError;
      }

      setTogglingId(null);
    } catch {
      // Revert optimistic update on error
      setRestaurants((prev) =>
        prev.map((r) =>
          r.id === restaurant.id ? { ...r, is_active: restaurant.is_active } : r
        )
      );
      setTogglingId(null);
    }
  };

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
                  <div className="flex items-center gap-3">
                    {/* Toggle Switch */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={restaurant.is_active}
                      disabled={togglingId === restaurant.id}
                      onClick={() => handleToggleActive(restaurant)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 ${
                        restaurant.is_active ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          restaurant.is_active ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <span className="text-sm text-muted-foreground w-16">
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

'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, Users, Store } from 'lucide-react';
import RestaurantFormDialog from './RestaurantFormDialog';
import InviteOwnerDialog from './InviteOwnerDialog';
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
  const [inviteState, setInviteState] = useState<
    { restaurantId: string; restaurantName: string } | null
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
      const response = await fetch(`/api/restaurants/${restaurant.id}`, {
        method: 'PATCH',
      });

      if (!response.ok) throw new Error('Failed to toggle');

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <div className="bg-brand-blue">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 sm:h-12 sm:w-12 rounded-full bg-white/10 text-white shrink-0">
              <Building2 className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">Super Admin Dashboard</h1>
              <p className="text-sm text-white/60 mt-0.5">System overview and management</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Restaurants</CardTitle>
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-brand-blue/10 text-brand-blue shrink-0">
                <Store className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-brand-blue">{restaurants.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Active Restaurants</CardTitle>
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-emerald-100 text-emerald-600 shrink-0">
                <Building2 className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                {restaurants.filter((r) => r.is_active).length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Users</CardTitle>
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-brand-orange/10 text-brand-orange shrink-0">
                <Users className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-brand-orange">{userCount.total}</div>
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
                      onClick={() =>
                        setInviteState({
                          restaurantId: restaurant.id,
                          restaurantName: restaurant.name,
                        })
                      }
                    >
                      Invite Owner
                    </Button>
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

        {inviteState && (
          <InviteOwnerDialog
            restaurantId={inviteState.restaurantId}
            restaurantName={inviteState.restaurantName}
            onInvited={() => {
              setInviteState(null);
            }}
            onClose={() => setInviteState(null)}
          />
        )}
      </div>
    </div>
  );
}

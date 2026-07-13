'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Store,
  UtensilsCrossed,
  Users,
  BarChart3,
} from 'lucide-react';
import MenuManagementTab from './MenuManagementTab';
import TableManagementTab from './TableManagementTab';
import StaffManagementTab from './StaffManagementTab';

interface Restaurant {
  id: string;
  name: string;
  description: string;
  logo_url: string | null;
  is_active: boolean;
  tax_rate: number;
}

interface Stats {
  totalOrders: number;
  activeOrders: number;
  totalRevenue: number;
  totalStaff: number;
}

export default function OwnerDashboard() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({
    totalOrders: 0,
    activeOrders: 0,
    totalRevenue: 0,
    totalStaff: 0,
  });
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchData = async () => {
      // Get current user's restaurant
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('restaurant_id')
        .eq('id', user.id)
        .single();

      if (!profile?.restaurant_id) return;

      setRestaurantId(profile.restaurant_id);

      // Fetch restaurant details
      const { data: restaurantData } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', profile.restaurant_id)
        .single();

      if (restaurantData) {
        setRestaurant(restaurantData);

        // Fetch stats
        const [ordersResult, activeOrdersResult, revenueResult, staffResult] =
          await Promise.all([
            supabase
              .from('orders')
              .select('*', { count: 'exact', head: true })
              .eq('restaurant_id', profile.restaurant_id),
            supabase
              .from('orders')
              .select('*', { count: 'exact', head: true })
              .eq('restaurant_id', profile.restaurant_id)
              .not('status', 'in', '(COMPLETED,CANCELLED)'),
            supabase
              .from('payments')
              .select('total_amount')
              .eq('restaurant_id', profile.restaurant_id)
              .eq('payment_status', 'COMPLETED'),
            supabase
              .from('profiles')
              .select('*', { count: 'exact', head: true })
              .eq('restaurant_id', profile.restaurant_id)
              .neq('role', 'customer'),
          ]);

        setStats({
          totalOrders: ordersResult.count || 0,
          activeOrders: activeOrdersResult.count || 0,
          totalRevenue:
            revenueResult.data?.reduce((sum, p) => sum + p.total_amount, 0) || 0,
          totalStaff: staffResult.count || 0,
        });
      }

      setLoading(false);
    };

    fetchData();
  }, [supabase]);

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
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Store className="h-8 w-8" />
            <div>
              <h1 className="text-3xl font-bold">{restaurant?.name || 'My Restaurant'}</h1>
              <p className="text-gray-500">Restaurant Owner Dashboard</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalOrders}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeOrders}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${stats.totalRevenue.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalStaff}</div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Tabs defaultValue="menu" className="space-y-6">
          <TabsList>
            <TabsTrigger value="menu" className="flex items-center gap-2">
              <UtensilsCrossed className="h-4 w-4" />
              Menu Management
            </TabsTrigger>
            <TabsTrigger value="tables" className="flex items-center gap-2">
              <Store className="h-4 w-4" />
              Table Management
            </TabsTrigger>
            <TabsTrigger value="staff" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Staff Management
            </TabsTrigger>
          </TabsList>

          {/* Menu Management */}
          <TabsContent value="menu">
            {restaurantId && <MenuManagementTab restaurantId={restaurantId} />}
          </TabsContent>

          {/* Table Management */}
          <TabsContent value="tables">
            {restaurantId && <TableManagementTab restaurantId={restaurantId} />}
          </TabsContent>

          {/* Staff Management */}
          <TabsContent value="staff">
            {restaurantId && <StaffManagementTab restaurantId={restaurantId} />}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

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
import Image from 'next/image';
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

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp']

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
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const supabase = createClient();

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

  useEffect(() => {
    fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const parseError = async (res: Response): Promise<string> => {
    try {
      const body = await res.json();
      return body?.error?.message || body?.message || `Upload failed (${res.status})`;
    } catch {
      return `Upload failed (${res.status})`;
    }
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const uploadLogo = async (file: File) => {
    if (!restaurantId) return;

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      setErrorMessage('Please upload a PNG, JPG, or WebP image');
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage('File size must be less than 5MB');
      return;
    }

    setUploading(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('bucket', 'restaurant-logos');
    formData.append('restaurantId', restaurantId);

    const uploadResponse = await fetch('/api/uploads', { method: 'POST', body: formData });
    if (!uploadResponse.ok) {
      const errorMsg = await parseError(uploadResponse);
      setErrorMessage(errorMsg);
      setUploading(false);
      return;
    }

    const { publicUrl } = await uploadResponse.json();

    const updateResponse = await fetch(`/api/restaurants/${restaurantId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logo_url: publicUrl }),
    });

    if (!updateResponse.ok) {
      const errorMsg = await parseError(updateResponse);
      setErrorMessage(errorMsg);
      setUploading(false);
      return;
    }

    await fetchData();
    setUploading(false);
    showSuccess('Logo uploaded successfully');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md text-sm">
            {successMessage}
          </div>
        )}

        {/* Header - Mobile: Stack, Desktop: Row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 md:mb-8">
          <div className="flex items-center gap-3">
            {restaurant?.logo_url ? (
              <Image
                src={restaurant.logo_url}
                alt={`${restaurant.name} logo`}
                width={48}
                height={48}
                className="rounded object-cover"
              />
            ) : (
              <Store className="h-10 w-10 md:h-12 md:w-12" />
            )}
            <div>
              <h1 className="text-xl md:text-3xl font-bold">{restaurant?.name || 'My Restaurant'}</h1>
              <p className="text-gray-500 text-sm md:text-base">Restaurant Owner Dashboard</p>
            </div>
          </div>
          <div className="flex flex-col items-start sm:items-end">
            <label className="inline-flex">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
                disabled={uploading}
              />
              <span className={`inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {uploading ? 'Uploading...' : 'Upload Logo'}
              </span>
            </label>
            <span className="text-xs text-gray-500 mt-1">PNG, JPG, or WebP (max 5MB)</span>
          </div>
        </div>

        {/* Stats - Mobile: 2 cols, Desktop: 4 cols */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-8">
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
        <Tabs defaultValue="menu" className="space-y-4 md:space-y-6">
          <TabsList className="flex w-full md:w-auto">
            <TabsTrigger value="menu" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm flex-1 md:flex-none justify-center">
              <UtensilsCrossed className="h-3 w-3 md:h-4 md:w-4" />
              <span className="md:hidden">Menu</span>
              <span className="hidden md:inline">Menu Management</span>
            </TabsTrigger>
            <TabsTrigger value="tables" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm flex-1 md:flex-none justify-center">
              <Store className="h-3 w-3 md:h-4 md:w-4" />
              <span className="md:hidden">Tables</span>
              <span className="hidden md:inline">Table Management</span>
            </TabsTrigger>
            <TabsTrigger value="staff" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm flex-1 md:flex-none justify-center">
              <Users className="h-3 w-3 md:h-4 md:w-4" />
              <span className="md:hidden">Staff</span>
              <span className="hidden md:inline">Staff Management</span>
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

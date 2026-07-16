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
  ImagePlus,
  Loader2,
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

    const { data } = await uploadResponse.json();
    const publicUrl = data?.publicUrl;

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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              {restaurant?.logo_url ? (
                <div className="flex items-center justify-center h-11 w-11 sm:h-12 sm:w-12 rounded-full bg-white/10 shrink-0 overflow-hidden">
                  <Image
                    src={restaurant.logo_url}
                    alt={`${restaurant.name} logo`}
                    width={48}
                    height={48}
                    className="rounded-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-11 w-11 sm:h-12 sm:w-12 rounded-full bg-white/10 text-white shrink-0">
                  <Store className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
              )}
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white">{restaurant?.name || 'My Restaurant'}</h1>
                <p className="text-sm text-white/60 mt-0.5">Restaurant Owner Dashboard</p>
              </div>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-1">
              <label className="inline-flex">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
                  disabled={uploading}
                />
                <span className={`flex items-center justify-center h-10 w-10 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImagePlus className="h-4 w-4" />
                  )}
                </span>
              </label>
              <span className="text-xs text-white/50">PNG, JPG, or WebP (max 5MB)</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
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

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Orders</CardTitle>
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-brand-blue/10 text-brand-blue shrink-0">
                <UtensilsCrossed className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-brand-blue">{stats.totalOrders}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Active Orders</CardTitle>
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-brand-orange/10 text-brand-orange shrink-0">
                <BarChart3 className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-brand-orange">{stats.activeOrders}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Revenue</CardTitle>
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-emerald-100 text-emerald-600 shrink-0">
                <BarChart3 className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                ${stats.totalRevenue.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Staff</CardTitle>
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-brand-blue/10 text-brand-blue shrink-0">
                <Users className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-brand-blue">{stats.totalStaff}</div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Tabs defaultValue="menu" className="space-y-6">
          <TabsList className="flex w-full bg-white border border-gray-200 rounded-2xl p-1.5 shadow-sm">
            <TabsTrigger
              value="menu"
              className="flex items-center gap-2 text-sm font-medium flex-1 justify-center rounded-xl py-2.5 transition-all data-[state=active]:bg-brand-blue data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-brand-blue/20 data-[state=inactive]:text-gray-500 data-[state=inactive]:hover:text-gray-700 data-[state=inactive]:hover:bg-gray-50"
            >
              <UtensilsCrossed className="h-4 w-4" />
              Menu Management
            </TabsTrigger>
            <TabsTrigger
              value="tables"
              className="flex items-center gap-2 text-sm font-medium flex-1 justify-center rounded-xl py-2.5 transition-all data-[state=active]:bg-brand-blue data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-brand-blue/20 data-[state=inactive]:text-gray-500 data-[state=inactive]:hover:text-gray-700 data-[state=inactive]:hover:bg-gray-50"
            >
              <Store className="h-4 w-4" />
              Table Management
            </TabsTrigger>
            <TabsTrigger
              value="staff"
              className="flex items-center gap-2 text-sm font-medium flex-1 justify-center rounded-xl py-2.5 transition-all data-[state=active]:bg-brand-blue data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-brand-blue/20 data-[state=inactive]:text-gray-500 data-[state=inactive]:hover:text-gray-700 data-[state=inactive]:hover:bg-gray-50"
            >
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

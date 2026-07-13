'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3,
  Clock,
  CreditCard,
  CheckCircle,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';

interface Order {
  id: string;
  status: string;
  payment_status: string;
  created_at: string;
  table: {
    table_number: number;
  }[];
  order_items: {
    quantity: number;
    unit_price: number;
  }[];
}

interface DailyStats {
  totalOrders: number;
  completedOrders: number;
  activeOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
}

export default function ManagerDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<DailyStats>({
    totalOrders: 0,
    completedOrders: 0,
    activeOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
  });
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchData = async () => {
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

      // Fetch today's orders
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: ordersData } = await supabase
        .from('orders')
        .select(`
          id,
          status,
          payment_status,
          created_at,
          table:tables(table_number),
          order_items(quantity, unit_price)
        `)
        .eq('restaurant_id', profile.restaurant_id)
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: false });

      if (ordersData) {
        setOrders(ordersData as unknown as Order[]);

        // Calculate stats
        const completed = ordersData.filter(
          (o: Order) => o.status === 'COMPLETED'
        );
        const active = ordersData.filter(
          (o: Order) =>
            o.status !== 'COMPLETED' && o.status !== 'CANCELLED'
        );

        const totalRevenue = completed.reduce((sum: number, o: Order) => {
          const orderTotal = o.order_items.reduce(
            (itemSum: number, item: any) =>
              itemSum + item.unit_price * item.quantity,
            0
          );
          return sum + orderTotal;
        }, 0);

        setStats({
          totalOrders: ordersData.length,
          completedOrders: completed.length,
          activeOrders: active.length,
          totalRevenue,
          averageOrderValue:
            completed.length > 0 ? totalRevenue / completed.length : 0,
        });
      }

      setLoading(false);
    };

    fetchData();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('manager-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
        <div className="flex items-center gap-3 mb-8">
          <BarChart3 className="h-8 w-8" />
          <h1 className="text-3xl font-bold">Manager Dashboard</h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalOrders}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.completedOrders}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <AlertCircle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {stats.activeOrders}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Revenue</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${stats.totalRevenue.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Order</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${stats.averageOrderValue.toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Orders List */}
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                No orders today
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => {
                  const orderTotal = order.order_items.reduce(
                    (sum, item) => sum + item.unit_price * item.quantity,
                    0
                  );
                  return (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className="font-medium">
                          Table {order.table[0]?.table_number}
                        </div>
                        <div className="text-sm text-gray-500">
                          {new Date(order.created_at).toLocaleTimeString()}
                        </div>
                        <div className="text-sm">
                          {order.order_items.length} items
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="font-medium">
                          ${orderTotal.toFixed(2)}
                        </div>
                        <Badge
                          variant={
                            order.status === 'COMPLETED' ? 'default' : 'secondary'
                          }
                        >
                          {order.status}
                        </Badge>
                        <Badge
                          variant={
                            order.payment_status === 'PAID'
                              ? 'default'
                              : 'destructive'
                          }
                        >
                          {order.payment_status}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

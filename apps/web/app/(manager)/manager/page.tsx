'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  BarChart3,
  Clock,
  CreditCard,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Receipt,
} from 'lucide-react';
import type { OrderDetail } from '@/lib/services/orderDetailService';

interface Order {
  id: string;
  status: string;
  payment_status: string;
  created_at: string;
  table: {
    table_number: number;
  };
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
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const supabase = createClient();

  const openOrderDetail = async (orderId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    const response = await fetch(`/api/orders/${orderId}`);

    if (!response.ok) {
      const { error } = await response.json();
      setDetailError(error?.message ?? 'Failed to load order details');
      setDetailLoading(false);
      return;
    }

    const { data } = (await response.json()) as { data: OrderDetail };
    setSelectedOrder(data);
    setDetailLoading(false);
  };

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
        const orders = ordersData as unknown as Order[];
        setOrders(orders);

        // Calculate stats
        const completed = orders.filter(
          (o) => o.status === 'COMPLETED'
        );
        const active = orders.filter(
          (o) =>
            o.status !== 'COMPLETED' && o.status !== 'CANCELLED'
        );

        const totalRevenue = completed.reduce((sum, o) => {
          const orderTotal = o.order_items.reduce(
            (itemSum, item) =>
              itemSum + item.unit_price * item.quantity,
            0
          );
          return sum + orderTotal;
        }, 0);

        setStats({
          totalOrders: orders.length,
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-brand-blue/5 to-transparent">
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
              <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">Manager Dashboard</h1>
              <p className="text-sm text-white/60 mt-0.5">Today&apos;s performance at a glance</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 sm:gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Orders</CardTitle>
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-brand-blue/10 text-brand-blue shrink-0">
                <Clock className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-brand-blue">{stats.totalOrders}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Completed</CardTitle>
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-emerald-100 text-emerald-600 shrink-0">
                <CheckCircle className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                {stats.completedOrders}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Active</CardTitle>
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-brand-orange/10 text-brand-orange shrink-0">
                <AlertCircle className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-brand-orange">
                {stats.activeOrders}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Revenue</CardTitle>
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-brand-blue/10 text-brand-blue shrink-0">
                <CreditCard className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-brand-blue">
                ${stats.totalRevenue.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Avg Order</CardTitle>
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-brand-blue/10 text-brand-blue shrink-0">
                <TrendingUp className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-brand-blue">
                ${stats.averageOrderValue.toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Orders List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-brand-blue">
              <Receipt className="h-5 w-5" />
              Today&apos;s Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <div className="py-10 text-center text-gray-500 flex flex-col items-center gap-2">
                <Receipt className="h-8 w-8 text-gray-300" />
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
                      role="button"
                      tabIndex={0}
                      onClick={() => openOrderDetail(order.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openOrderDetail(order.id);
                        }
                      }}
                      className="flex items-center justify-between gap-2 flex-wrap p-4 border rounded-lg cursor-pointer hover:bg-brand-blue/5 hover:border-brand-blue/20 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center justify-center h-9 w-9 rounded-full bg-brand-blue/10 text-brand-blue shrink-0">
                          <Receipt className="h-4 w-4" />
                        </div>
                        <div className="font-medium">
                          Table {order.table.table_number}
                        </div>
                        <div className="text-sm text-gray-500">
                          {new Date(order.created_at).toLocaleTimeString()}
                        </div>
                        <div className="text-sm text-gray-500">
                          {order.order_items.length} items
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="font-medium text-brand-blue">
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

        <Dialog
          open={selectedOrder !== null || detailLoading || detailError !== null}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedOrder(null);
              setDetailError(null);
            }
          }}
        >
          <DialogContent>
            {detailLoading && (
              <div className="py-8 flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-blue" />
              </div>
            )}

            {detailError && !detailLoading && (
              <div
                className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md"
                role="alert"
              >
                {detailError}
              </div>
            )}

            {selectedOrder && !detailLoading && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-brand-blue">
                    Table {selectedOrder.table.table_number}
                    {selectedOrder.table.name && ` — ${selectedOrder.table.name}`}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 flex-wrap text-sm text-gray-500">
                    <span>
                      {new Date(selectedOrder.created_at).toLocaleString()}
                    </span>
                    <Badge
                      variant={
                        selectedOrder.status === 'COMPLETED' ? 'default' : 'secondary'
                      }
                    >
                      {selectedOrder.status}
                    </Badge>
                    <Badge
                      variant={
                        selectedOrder.payment_status === 'PAID' ? 'default' : 'destructive'
                      }
                    >
                      {selectedOrder.payment_status}
                    </Badge>
                  </div>

                  <div className="space-y-2 pb-3 border-b">
                    {selectedOrder.order_items.map((item) => (
                      <div key={item.id} className="text-sm">
                        <div className="flex justify-between">
                          <span>
                            {item.quantity}x {item.menu_item.name}
                          </span>
                          <span>${(item.unit_price * item.quantity).toFixed(2)}</span>
                        </div>
                        {item.special_instructions && (
                          <div className="text-xs text-gray-500 italic mt-0.5">
                            {item.special_instructions}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {selectedOrder.special_instructions && (
                    <div className="text-sm text-gray-600 bg-gray-50 border rounded-md p-3">
                      {selectedOrder.special_instructions}
                    </div>
                  )}

                  <div className="flex justify-between font-bold text-brand-blue pt-1">
                    <span>Total</span>
                    <span>
                      $
                      {selectedOrder.order_items
                        .reduce((sum, item) => sum + item.unit_price * item.quantity, 0)
                        .toFixed(2)}
                    </span>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users,
  Clock,
  CreditCard,
  CheckCircle,
  Sparkles,
  QrCode,
  DoorOpen,
  Circle,
} from 'lucide-react';
import { useRealtimeWithPolling } from '@/hooks/useRealtimeWithPolling';

interface Table {
  id: string;
  table_number: number;
  name: string | null;
  capacity: number;
  status: string;
}

interface Order {
  id: string;
  status: string;
  payment_status: string;
  created_at: string;
  table: {
    table_number: number;
  };
}

const tableStatusMeta: Record<
  string,
  { card: string; accent: string; badge: string; dot: string }
> = {
  AVAILABLE: {
    card: 'bg-emerald-50 border-emerald-200',
    accent: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-800',
    dot: 'text-emerald-500',
  },
  OCCUPIED: {
    card: 'bg-blue-50 border-blue-200',
    accent: 'bg-blue-500',
    badge: 'bg-blue-100 text-blue-800',
    dot: 'text-blue-500',
  },
  WAITING_PAYMENT: {
    card: 'bg-amber-50 border-amber-200',
    accent: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-800',
    dot: 'text-amber-500',
  },
  CLEANING: {
    card: 'bg-gray-100 border-gray-200',
    accent: 'bg-gray-400',
    badge: 'bg-gray-200 text-gray-700',
    dot: 'text-gray-400',
  },
};

const orderStatusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  ACCEPTED: 'bg-blue-100 text-blue-800',
  PREPARING: 'bg-brand-orange/10 text-brand-orange',
  READY: 'bg-emerald-100 text-emerald-800',
  COMPLETED: 'bg-gray-100 text-gray-700',
  CANCELLED: 'bg-red-100 text-red-800',
};

export default function StaffDashboard() {
  const [tables, setTables] = useState<Table[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const supabase = createClient();

  const fetchData = async () => {
    const [tablesResult, ordersResult] = await Promise.all([
      supabase
        .from('tables')
        .select('*')
        .order('table_number', { ascending: true }),
      supabase
        .from('orders')
        .select(`
          id,
          status,
          payment_status,
          created_at,
          table:tables(table_number)
        `)
        .order('created_at', { ascending: false }),
    ]);

    if (tablesResult.data) {
      setTables(tablesResult.data);
    }

    if (ordersResult.data) {
      setOrders(ordersResult.data as unknown as Order[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRealtimeWithPolling({
    channelName: 'staff-tables',
    table: 'tables',
    onChange: fetchData,
  });

  useRealtimeWithPolling({
    channelName: 'staff-orders',
    table: 'orders',
    onChange: fetchData,
  });

  const updateTableStatus = async (tableId: string, newStatus: string) => {
    const { error } = await supabase
      .from('tables')
      .update({ status: newStatus })
      .eq('id', tableId);

    if (!error) {
      setTables(
        tables.map((table) =>
          table.id === tableId ? { ...table, status: newStatus } : table
        )
      );
    }
  };

  const releaseTable = async (tableId: string) => {
    const response = await fetch(`/api/tables/${tableId}/release`, { method: 'POST' });

    if (!response.ok) {
      const { error } = await response.json();
      setErrorMessage(error?.message ?? 'Failed to release table');
      return;
    }

    setErrorMessage(null);
    fetchData();
  };

  const downloadQr = async (tableId: string, tableNumber: number) => {
    const response = await fetch(`/api/tables/${tableId}/qr`);

    if (!response.ok) {
      setErrorMessage('Failed to generate QR code');
      return;
    }

    const { data } = await response.json() as { data: { dataUrl: string } };
    const link = document.createElement('a');
    link.href = data.dataUrl;
    link.download = `table-${tableNumber}-qr.png`;
    link.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-brand-blue/5 to-transparent">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue"></div>
      </div>
    );
  }

  const activeOrders = orders.filter(
    (o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED'
  );
  const waitingPayment = orders.filter(
    (o) => o.status === 'READY' && o.payment_status === 'UNPAID'
  );
  const completedOrders = orders.filter((o) => o.status === 'COMPLETED');

  const occupiedCount = tables.filter((t) => t.status === 'OCCUPIED').length;

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <div className="bg-brand-blue">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 sm:h-12 sm:w-12 rounded-full bg-white/10 text-white shrink-0">
              <Users className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">Staff Dashboard</h1>
              <p className="text-sm text-white/60 mt-0.5">
                {occupiedCount} of {tables.length} tables occupied
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-1">
        {errorMessage && (
          <div
            className="mt-4 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md"
            role="alert"
          >
            {errorMessage}
          </div>
        )}

        <Tabs defaultValue="tables" className="space-y-6 pt-6">
          <TabsList className="grid w-full grid-cols-2 gap-1 h-auto sm:flex sm:w-auto sm:gap-2 bg-transparent p-0">
            <TabsTrigger
              value="tables"
              className="flex items-center gap-2 py-2 rounded-full border border-gray-200 bg-white data-[state=active]:bg-brand-orange data-[state=active]:text-white data-[state=active]:border-brand-orange data-[state=active]:shadow-none"
            >
              <Users className="h-4 w-4 shrink-0" />
              Tables
            </TabsTrigger>
            <TabsTrigger
              value="active"
              className="flex items-center gap-2 py-2 rounded-full border border-gray-200 bg-white data-[state=active]:bg-brand-orange data-[state=active]:text-white data-[state=active]:border-brand-orange data-[state=active]:shadow-none"
            >
              <Clock className="h-4 w-4 shrink-0" />
              <span className="sm:hidden">Active ({activeOrders.length})</span>
              <span className="hidden sm:inline">Active Orders ({activeOrders.length})</span>
            </TabsTrigger>
            <TabsTrigger
              value="payment"
              className="flex items-center gap-2 py-2 rounded-full border border-gray-200 bg-white data-[state=active]:bg-brand-orange data-[state=active]:text-white data-[state=active]:border-brand-orange data-[state=active]:shadow-none"
            >
              <CreditCard className="h-4 w-4 shrink-0" />
              <span className="sm:hidden">Payment ({waitingPayment.length})</span>
              <span className="hidden sm:inline">Waiting Payment ({waitingPayment.length})</span>
            </TabsTrigger>
            <TabsTrigger
              value="completed"
              className="flex items-center gap-2 py-2 rounded-full border border-gray-200 bg-white data-[state=active]:bg-brand-orange data-[state=active]:text-white data-[state=active]:border-brand-orange data-[state=active]:shadow-none"
            >
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span className="sm:hidden">Done ({completedOrders.length})</span>
              <span className="hidden sm:inline">Completed ({completedOrders.length})</span>
            </TabsTrigger>
          </TabsList>

          {/* Tables Tab — floor map: status IS the color */}
          <TabsContent value="tables">
            <div className="flex items-center gap-4 mb-4 text-xs text-gray-500 flex-wrap">
              {Object.entries(tableStatusMeta).map(([status, meta]) => (
                <div key={status} className="flex items-center gap-1.5">
                  <Circle className={`h-2.5 w-2.5 fill-current ${meta.dot}`} />
                  {status.replace('_', ' ')}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
              {tables.map((table) => {
                const meta = tableStatusMeta[table.status];
                return (
                  <Card
                    key={table.id}
                    className={`overflow-hidden transition-shadow hover:shadow-md ${meta.card}`}
                  >
                    <div className={`h-1.5 ${meta.accent}`} />
                    <CardContent className="p-4">
                      <div className="text-center">
                        <div className="text-3xl font-bold mb-1 text-gray-900">
                          {table.table_number}
                        </div>
                        {table.name && (
                          <div className="text-sm text-gray-500 mb-2 truncate">
                            {table.name}
                          </div>
                        )}
                        <Badge className={meta.badge}>
                          {table.status.replace('_', ' ')}
                        </Badge>
                        <div className="text-xs text-gray-400 mt-2">
                          {table.capacity} seats
                        </div>
                        {table.status === 'AVAILABLE' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-3 w-full h-11 sm:h-9 bg-white/70"
                            onClick={() => updateTableStatus(table.id, 'CLEANING')}
                          >
                            <Sparkles className="h-4 w-4 mr-1.5" />
                            Clean
                          </Button>
                        )}
                        {table.status === 'CLEANING' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-3 w-full h-11 sm:h-9 bg-white/70"
                            onClick={() => updateTableStatus(table.id, 'AVAILABLE')}
                          >
                            <CheckCircle className="h-4 w-4 mr-1.5" />
                            Ready
                          </Button>
                        )}
                        {(table.status === 'OCCUPIED' || table.status === 'WAITING_PAYMENT') && (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="mt-3 w-full h-11 sm:h-9"
                            onClick={() => releaseTable(table.id)}
                          >
                            <DoorOpen className="h-4 w-4 mr-1.5" />
                            Release
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 w-full h-11 sm:h-9 bg-white/70"
                          onClick={() => downloadQr(table.id, table.table_number)}
                        >
                          <QrCode className="h-4 w-4 mr-1.5" />
                          Download QR
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Active Orders Tab */}
          <TabsContent value="active">
            <div className="space-y-3">
              {activeOrders.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center text-gray-500 flex flex-col items-center gap-2">
                    <Clock className="h-8 w-8 text-gray-300" />
                    No active orders
                  </CardContent>
                </Card>
              ) : (
                activeOrders.map((order) => (
                  <Card key={order.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center h-9 w-9 rounded-full bg-brand-orange/10 text-brand-orange shrink-0">
                            <Clock className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-medium">
                              Table {order.table.table_number}
                            </div>
                            <div className="text-sm text-gray-500">
                              {new Date(order.created_at).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                        <Badge className={orderStatusColors[order.status]}>
                          {order.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Waiting Payment Tab */}
          <TabsContent value="payment">
            <div className="space-y-3">
              {waitingPayment.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center text-gray-500 flex flex-col items-center gap-2">
                    <CreditCard className="h-8 w-8 text-gray-300" />
                    No orders waiting for payment
                  </CardContent>
                </Card>
              ) : (
                waitingPayment.map((order) => (
                  <Card key={order.id} className="overflow-hidden border-amber-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center h-9 w-9 rounded-full bg-amber-100 text-amber-700 shrink-0">
                            <CreditCard className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-medium">
                              Table {order.table.table_number}
                            </div>
                            <div className="text-sm text-gray-500">
                              {new Date(order.created_at).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                        <Badge className="bg-amber-100 text-amber-800">
                          WAITING PAYMENT
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Completed Tab */}
          <TabsContent value="completed">
            <div className="space-y-3">
              {completedOrders.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center text-gray-500 flex flex-col items-center gap-2">
                    <CheckCircle className="h-8 w-8 text-gray-300" />
                    No completed orders today
                  </CardContent>
                </Card>
              ) : (
                completedOrders.map((order) => (
                  <Card key={order.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center h-9 w-9 rounded-full bg-gray-100 text-gray-500 shrink-0">
                            <CheckCircle className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-medium">
                              Table {order.table.table_number}
                            </div>
                            <div className="text-sm text-gray-500">
                              {new Date(order.created_at).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline">{order.status}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

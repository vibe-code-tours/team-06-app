'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Clock, CreditCard, CheckCircle } from 'lucide-react';
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

const tableStatusColors: Record<string, string> = {
  AVAILABLE: 'bg-green-100 text-green-800',
  OCCUPIED: 'bg-blue-100 text-blue-800',
  WAITING_PAYMENT: 'bg-yellow-100 text-yellow-800',
  CLEANING: 'bg-gray-100 text-gray-800',
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
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

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Users className="h-8 w-8" />
          <h1 className="text-3xl font-bold">Staff Dashboard</h1>
        </div>

        {errorMessage && (
          <div className="mb-6 p-3 text-sm text-red-600 bg-red-50 rounded-md" role="alert">
            {errorMessage}
          </div>
        )}

        <Tabs defaultValue="tables" className="space-y-6">
          <TabsList>
            <TabsTrigger value="tables" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Tables
            </TabsTrigger>
            <TabsTrigger value="active" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Active Orders ({activeOrders.length})
            </TabsTrigger>
            <TabsTrigger value="payment" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Waiting Payment ({waitingPayment.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Completed ({completedOrders.length})
            </TabsTrigger>
          </TabsList>

          {/* Tables Tab */}
          <TabsContent value="tables">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {tables.map((table) => (
                <Card key={table.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold mb-1">
                        {table.table_number}
                      </div>
                      {table.name && (
                        <div className="text-sm text-gray-500 mb-2">
                          {table.name}
                        </div>
                      )}
                      <Badge className={tableStatusColors[table.status]}>
                        {table.status.replace('_', ' ')}
                      </Badge>
                      <div className="text-xs text-gray-400 mt-2">
                        {table.capacity} seats
                      </div>
                      {table.status === 'AVAILABLE' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 w-full"
                          onClick={() => updateTableStatus(table.id, 'CLEANING')}
                        >
                          Clean
                        </Button>
                      )}
                      {table.status === 'CLEANING' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 w-full"
                          onClick={() => updateTableStatus(table.id, 'AVAILABLE')}
                        >
                          Ready
                        </Button>
                      )}
                      {(table.status === 'OCCUPIED' || table.status === 'WAITING_PAYMENT') && (
                        <Button
                          size="sm"
                          variant="destructive"
                          className="mt-2 w-full"
                          onClick={() => releaseTable(table.id)}
                        >
                          Release Table
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 w-full"
                        onClick={() => downloadQr(table.id, table.table_number)}
                      >
                        Download QR
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Active Orders Tab */}
          <TabsContent value="active">
            <div className="space-y-4">
              {activeOrders.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-gray-500">
                    No active orders
                  </CardContent>
                </Card>
              ) : (
                activeOrders.map((order) => (
                  <Card key={order.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">
                            Table {order.table.table_number}
                          </div>
                          <div className="text-sm text-gray-500">
                            {new Date(order.created_at).toLocaleTimeString()}
                          </div>
                        </div>
                        <Badge>{order.status}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Waiting Payment Tab */}
          <TabsContent value="payment">
            <div className="space-y-4">
              {waitingPayment.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-gray-500">
                    No orders waiting for payment
                  </CardContent>
                </Card>
              ) : (
                waitingPayment.map((order) => (
                  <Card key={order.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">
                            Table {order.table.table_number}
                          </div>
                          <div className="text-sm text-gray-500">
                            {new Date(order.created_at).toLocaleTimeString()}
                          </div>
                        </div>
                        <Link href={`/cashier?order=${order.id}`}>
                          <Button size="sm">Process Payment</Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Completed Tab */}
          <TabsContent value="completed">
            <div className="space-y-4">
              {completedOrders.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-gray-500">
                    No completed orders today
                  </CardContent>
                </Card>
              ) : (
                completedOrders.map((order) => (
                  <Card key={order.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">
                            Table {order.table.table_number}
                          </div>
                          <div className="text-sm text-gray-500">
                            {new Date(order.created_at).toLocaleTimeString()}
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

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle, ChefHat } from 'lucide-react';

interface OrderItem {
  id: string;
  quantity: number;
  special_instructions: string | null;
  menu_item: {
    name: string;
  };
}

interface Order {
  id: string;
  status: string;
  created_at: string;
  special_instructions: string | null;
  table: {
    table_number: number;
    name: string | null;
  };
  order_items: OrderItem[];
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  ACCEPTED: 'bg-blue-100 text-blue-800',
  PREPARING: 'bg-orange-100 text-orange-800',
  READY: 'bg-green-100 text-green-800',
};

const nextStatus: Record<string, string> = {
  PENDING: 'ACCEPTED',
  ACCEPTED: 'PREPARING',
  PREPARING: 'READY',
};

export default function KitchenDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchOrders = async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          status,
          created_at,
          special_instructions,
          table:tables(table_number, name),
          order_items(
            id,
            quantity,
            special_instructions,
            menu_item:menu_items(name)
          )
        `)
        .in('status', ['PENDING', 'ACCEPTED', 'PREPARING'])
        .order('created_at', { ascending: true });

      if (data) {
        setOrders(data as unknown as Order[]);
      }
      setLoading(false);
    };

    fetchOrders();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const updateOrderStatus = async (orderId: string, currentStatus: string) => {
    const newStatus = nextStatus[currentStatus];
    if (!newStatus) return;

    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (!error) {
      setOrders(orders.filter((order) => order.id !== orderId || newStatus === 'READY'));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <ChefHat className="h-8 w-8" />
          <h1 className="text-3xl font-bold">Kitchen Display</h1>
        </div>

        {orders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              No pending orders
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {orders.map((order) => (
              <Card key={order.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      Table {order.table.table_number}
                      {order.table.name && (
                        <span className="text-sm font-normal text-gray-500 ml-2">
                          ({order.table.name})
                        </span>
                      )}
                    </CardTitle>
                    <Badge className={statusColors[order.status]}>
                      {order.status}
                    </Badge>
                  </div>
                  <div className="flex items-center text-sm text-gray-500">
                    <Clock className="h-4 w-4 mr-1" />
                    {new Date(order.created_at).toLocaleTimeString()}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 mb-4">
                    {order.order_items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span>
                          {item.quantity}x {item.menu_item.name}
                        </span>
                        {item.special_instructions && (
                          <span className="text-orange-600 text-xs">
                            ({item.special_instructions})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {order.special_instructions && (
                    <div className="p-2 bg-yellow-50 rounded text-sm text-yellow-800 mb-4">
                      {order.special_instructions}
                    </div>
                  )}

                  {nextStatus[order.status] && (
                    <Button
                      className="w-full"
                      onClick={() => updateOrderStatus(order.id, order.status)}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Mark as {nextStatus[order.status]}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

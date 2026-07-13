'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRealtimeWithPolling } from '@/hooks/useRealtimeWithPolling';

interface TrackedOrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  special_instructions: string | null;
  menu_item: { name: string };
}

interface TrackedOrder {
  id: string;
  status: string;
  payment_status: string;
  created_at: string;
  order_items: TrackedOrderItem[];
}

interface OrderTrackerProps {
  restaurantId: string;
  tableId: string;
  onStartNewOrder: () => void;
}

const STATUS_STEPS = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED'] as const;

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  ACCEPTED: 'bg-blue-100 text-blue-800',
  PREPARING: 'bg-orange-100 text-orange-800',
  READY: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-gray-100 text-gray-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export default function OrderTracker({ restaurantId, tableId, onStartNewOrder }: OrderTrackerProps) {
  const [orders, setOrders] = useState<TrackedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchActiveOrders = async () => {
    const { data: session } = await supabase
      .from('order_sessions')
      .select('id')
      .eq('table_id', tableId)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (!session) {
      setOrders([]);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('orders')
      .select(`
        id,
        status,
        payment_status,
        created_at,
        order_items(
          id,
          quantity,
          unit_price,
          special_instructions,
          menu_item:menu_items(name)
        )
      `)
      .eq('table_session_id', session.id)
      .order('created_at', { ascending: true });

    if (data) {
      setOrders(data as unknown as TrackedOrder[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchActiveOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId]);

  useRealtimeWithPolling({
    channelName: `customer-orders-${tableId}`,
    table: 'orders',
    onChange: fetchActiveOrders,
  });

  const billTotal = orders.reduce(
    (sum, order) =>
      sum + order.order_items.reduce((itemSum, item) => itemSum + item.unit_price * item.quantity, 0),
    0
  );
  const allPaid = orders.length > 0 && orders.every((o) => o.payment_status === 'PAID');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto space-y-4 py-6">
        <div className="text-center">
          <div className="text-5xl mb-2">✓</div>
          <h1 className="text-2xl font-bold">Order Status</h1>
        </div>

        {orders.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              No active orders for this table.
            </CardContent>
          </Card>
        ) : (
          orders.map((order) => (
            <Card key={order.id}>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  Order placed {new Date(order.created_at).toLocaleTimeString()}
                </CardTitle>
                <Badge className={statusColors[order.status]} aria-label={`Order status: ${order.status}`}>
                  {order.status}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm mb-3">
                  {order.order_items.map((item) => (
                    <div key={item.id} className="flex justify-between">
                      <span>
                        {item.quantity}x {item.menu_item.name}
                      </span>
                      <span>${(item.unit_price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                {order.status !== 'CANCELLED' && (
                  <div className="flex gap-1" role="list" aria-label="Order progress">
                    {STATUS_STEPS.map((step) => (
                      <div
                        key={step}
                        role="listitem"
                        className={`h-1.5 flex-1 rounded-full ${
                          STATUS_STEPS.indexOf(order.status as typeof STATUS_STEPS[number]) >=
                          STATUS_STEPS.indexOf(step)
                            ? 'bg-blue-600'
                            : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}

        {orders.length > 0 && (
          <Card>
            <CardContent className="py-4 flex items-center justify-between">
              <span className="font-medium">
                {allPaid ? 'Bill paid' : `Bill total: $${billTotal.toFixed(2)}`}
              </span>
              <Badge variant={allPaid ? 'default' : 'outline'}>
                {allPaid ? 'PAID' : 'UNPAID'}
              </Badge>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}

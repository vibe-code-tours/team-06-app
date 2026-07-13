'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRealtimeWithPolling } from '@/hooks/useRealtimeWithPolling';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle, ChefHat, Flame, AlertCircle, X } from 'lucide-react';

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

const statusConfig: Record<string, { bg: string; text: string; glow: string; icon: React.ReactNode }> = {
  PENDING: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-700',
    glow: 'shadow-[0_0_15px_rgba(234,179,8,0.12)]',
    icon: <Clock className="h-4 w-4" />,
  },
  ACCEPTED: {
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    glow: 'shadow-[0_0_15px_rgba(59,130,246,0.12)]',
    icon: <CheckCircle className="h-4 w-4" />,
  },
  PREPARING: {
    bg: 'bg-orange-100',
    text: 'text-orange-700',
    glow: 'shadow-[0_0_20px_rgba(254,116,15,0.15)]',
    icon: <Flame className="h-4 w-4" />,
  },
  READY: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    glow: 'shadow-[0_0_15px_rgba(34,197,94,0.12)]',
    icon: <CheckCircle className="h-4 w-4" />,
  },
};

const nextStatus: Record<string, string> = {
  PENDING: 'ACCEPTED',
  ACCEPTED: 'PREPARING',
  PREPARING: 'READY',
};

export default function KitchenDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null);
  const supabase = createClient();
  // Tracks order IDs that have already played their entrance animation, so a
  // status-change refetch doesn't replay slide-up on the whole grid — only
  // genuinely new orders animate in.
  const animatedOrderIds = useRef<Set<string>>(new Set());

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

    if (error) {
      setErrorMessage(error.message);
    } else if (data) {
      const liveIds = new Set(data.map((order) => order.id));
      for (const id of animatedOrderIds.current) {
        if (!liveIds.has(id)) {
          animatedOrderIds.current.delete(id);
        }
      }
      setOrders(data as unknown as Order[]);
      setErrorMessage(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRealtimeWithPolling({
    channelName: 'kitchen-orders',
    table: 'orders',
    onChange: fetchOrders,
  });

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    const response = await fetch(`/api/orders/${orderId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });

    if (!response.ok) {
      const { error } = await response.json();
      setErrorMessage(error?.message ?? 'Failed to update order status');
      return;
    }

    setErrorMessage(null);
    fetchOrders();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-orange border-t-transparent"></div>
          <p className="text-gray-500 text-sm">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-brand-orange/10 rounded-xl animate-pulse-glow">
                <ChefHat className="h-8 w-8 text-brand-orange" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-brand-blue tracking-tight">Kitchen Display</h1>
                <p className="text-gray-500 text-sm mt-1">
                  {orders.length} active order{orders.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Error message */}
          {errorMessage && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 animate-slide-up" role="alert">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
              <p className="text-red-600 text-sm">{errorMessage}</p>
            </div>
          )}

          {/* Orders grid */}
          {orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="p-6 bg-white border border-black/[0.06] rounded-2xl mb-4 shadow-sm">
                <ChefHat className="h-16 w-16 text-gray-300" />
              </div>
              <p className="text-gray-500 text-lg">No pending orders</p>
              <p className="text-gray-400 text-sm mt-1">New orders will appear here</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {orders.map((order, index) => {
                const config = statusConfig[order.status] || statusConfig.PENDING;
                const isNew = !animatedOrderIds.current.has(order.id);
                if (isNew) {
                  animatedOrderIds.current.add(order.id);
                }
                return (
                  <div
                    key={order.id}
                    className={`group relative bg-white border border-black/[0.06] rounded-2xl overflow-hidden hover:border-black/[0.12] transition-all duration-300 hover:scale-[1.02] shadow-sm ${config.glow} ${isNew ? 'animate-slide-up' : ''}`}
                    style={isNew ? { animationDelay: `${index * 50}ms` } : undefined}
                  >
                    {/* Status indicator bar */}
                    <div className={`h-1 ${config.bg}`} style={{ background: `linear-gradient(90deg, transparent, currentColor, transparent)` }} />

                    <div className="p-5">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-xl font-bold text-brand-blue">
                            Table {order.table.table_number}
                          </h3>
                          {order.table.name && (
                            <p className="text-gray-400 text-xs mt-0.5">{order.table.name}</p>
                          )}
                        </div>
                        <Badge className={`${config.bg} ${config.text} border-0 px-3 py-1.5 font-medium`}>
                          <span className="flex items-center gap-1.5">
                            {config.icon}
                            {order.status}
                          </span>
                        </Badge>
                      </div>

                      {/* Time */}
                      <div className="flex items-center gap-2 text-gray-400 text-xs mb-4">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(order.created_at).toLocaleTimeString()}
                      </div>

                      {/* Order items */}
                      <div className="space-y-2 mb-4 pb-4 border-b border-black/[0.06]">
                        {order.order_items.map((item) => (
                          <div key={item.id} className="flex justify-between items-start text-sm">
                            <span className="text-gray-700">
                              <span className="text-brand-orange font-medium">{item.quantity}x</span>{' '}
                              {item.menu_item.name}
                            </span>
                            {item.special_instructions && (
                              <span className="text-brand-orange/80 text-xs ml-2 italic">
                                {item.special_instructions}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Special instructions */}
                      {order.special_instructions && (
                        <div className="mb-4 p-3 bg-brand-orange/[0.08] border border-brand-orange/20 rounded-lg">
                          <p className="text-brand-orange text-sm">{order.special_instructions}</p>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="space-y-2">
                        {nextStatus[order.status] && (
                          <Button
                            className="w-full bg-brand-orange hover:bg-brand-orange/90 text-white font-semibold py-5 rounded-xl transition-all duration-200 hover:shadow-[0_0_20px_rgba(254,116,15,0.3)]"
                            onClick={() => updateOrderStatus(order.id, nextStatus[order.status])}
                            aria-label={`Mark order as ${nextStatus[order.status]}`}
                          >
                            <CheckCircle className="h-5 w-5 mr-2" />
                            Mark as {nextStatus[order.status]}
                          </Button>
                        )}

                        {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
                          <Button
                            variant="ghost"
                            className="w-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all duration-200"
                            onClick={() => setRejectingOrderId(order.id)}
                            aria-label="Reject order"
                          >
                            Reject Order
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      </div>

      {/* Reject Order Confirmation Dialog */}
      {rejectingOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setRejectingOrderId(null)}
          />

          {/* Dialog */}
          <div className="relative bg-white border border-black/[0.08] rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-slide-up">
            <button
              onClick={() => setRejectingOrderId(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="text-center">
              <div className="inline-flex items-center justify-center p-3 bg-red-50 rounded-xl mb-4">
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-brand-blue mb-2">Reject Order?</h3>
              <p className="text-gray-500 text-sm mb-6">
                This order will be cancelled and removed from the queue. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  className="flex-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                  onClick={() => setRejectingOrderId(null)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                  onClick={() => {
                    updateOrderStatus(rejectingOrderId, 'CANCELLED');
                    setRejectingOrderId(null);
                  }}
                >
                  Reject Order
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

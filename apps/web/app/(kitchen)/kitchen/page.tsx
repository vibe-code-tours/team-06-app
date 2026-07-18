"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRealtimeWithPolling } from "@/hooks/useRealtimeWithPolling";
import { createClient } from "@/lib/supabase/client";
import {
  AlertCircle,
  CheckCircle,
  ChefHat,
  Clock,
  Flame,
  Loader2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

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

const statusConfig: Record<
  string,
  { bg: string; text: string; icon: React.ReactNode }
> = {
  PENDING: {
    bg: "bg-yellow-100",
    text: "text-yellow-700",
    icon: <Clock className="h-4 w-4" />,
  },
  ACCEPTED: {
    bg: "bg-blue-100",
    text: "text-blue-700",
    icon: <CheckCircle className="h-4 w-4" />,
  },
  PREPARING: {
    bg: "bg-orange-100",
    text: "text-orange-700",
    icon: <Flame className="h-4 w-4" />,
  },
  READY: {
    bg: "bg-green-100",
    text: "text-green-700",
    icon: <CheckCircle className="h-4 w-4" />,
  },
};

const nextStatus: Record<string, string> = {
  PENDING: "ACCEPTED",
  ACCEPTED: "PREPARING",
  PREPARING: "READY",
};

const nextStatusLabel: Record<string, string> = {
  PENDING: "Accept?",
  ACCEPTED: "Cooking?",
  PREPARING: "Ready?",
};

export default function KitchenDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const supabase = createClient();

  const fetchOrders = async () => {
    // Get current user's restaurant_id
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("restaurant_id")
      .eq("id", user.id)
      .single();

    if (!profile?.restaurant_id) return;

    const { data, error } = await supabase
      .from("orders")
      .select(
        `
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
      `,
      )
      .eq("restaurant_id", profile.restaurant_id)
      .in("status", ["PENDING", "ACCEPTED", "PREPARING"])
      .order("created_at", { ascending: true });

    if (error) {
      setErrorMessage(error.message);
    } else if (data) {
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
    channelName: "kitchen-orders",
    table: "orders",
    onChange: fetchOrders,
  });

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    setUpdatingOrderId(orderId);
    const response = await fetch(`/api/orders/${orderId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    if (!response.ok) {
      const { error } = await response.json();
      setErrorMessage(error?.message ?? "Failed to update order status");
      setUpdatingOrderId(null);
      return;
    }

    setErrorMessage(null);
    await fetchOrders();
    setUpdatingOrderId(null);
  };

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
              <ChefHat className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">
                Kitchen Dashboard
              </h1>
              <p className="text-sm text-white/60 mt-0.5">
                {orders.length} active order{orders.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Error message */}
        {errorMessage && (
          <div
            className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3"
            role="alert"
          >
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <p className="text-red-600 text-sm">{errorMessage}</p>
          </div>
        )}

        {/* Orders grid */}
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="p-6 bg-white border border-gray-200 rounded-2xl mb-4">
              <ChefHat className="h-16 w-16 text-gray-300" />
            </div>
            <p className="text-gray-500 text-lg">No pending orders</p>
            <p className="text-gray-400 text-sm mt-1">
              New orders will appear here
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {orders.map((order) => {
              const config = statusConfig[order.status] || statusConfig.PENDING;
              return (
                <div
                  key={order.id}
                  className="bg-white border border-gray-200 rounded-2xl overflow-hidden"
                >
                  {/* Status indicator bar */}
                  <div className={`h-1.5 ${config.bg}`} />

                  <div className="p-5">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-brand-blue">
                          Table {order.table.table_number}
                        </h3>
                        {order.table.name && (
                          <p className="text-gray-400 text-xs mt-0.5">
                            {order.table.name}
                          </p>
                        )}
                      </div>
                      <Badge
                        className={`${config.bg} ${config.text} border-0 px-3 py-1.5 font-medium`}
                      >
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
                    <div className="space-y-2 mb-4 pb-4 border-b border-gray-100">
                      {order.order_items.map((item) => (
                        <div
                          key={item.id}
                          className="flex justify-between items-start text-sm"
                        >
                          <span className="text-gray-700">
                            <span className="text-brand-orange font-medium">
                              {item.quantity}x
                            </span>{" "}
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
                        <p className="text-brand-orange text-sm">
                          {order.special_instructions}
                        </p>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      {nextStatus[order.status] && (
                        <Button
                          className="flex-1 min-w-0 bg-brand-orange hover:bg-orange-600 text-white font-semibold py-5 rounded-xl transition-colors"
                          onClick={() =>
                            updateOrderStatus(
                              order.id,
                              nextStatus[order.status],
                            )
                          }
                          disabled={updatingOrderId === order.id}
                          aria-label={`Mark order as ${nextStatus[order.status]}`}
                        >
                          {updatingOrderId === order.id ? (
                            <Loader2 className="h-4 w-4 mr-1.5 shrink-0 animate-spin" />
                          ) : (
                            <CheckCircle className="h-4 w-4 mr-1.5 shrink-0" />
                          )}
                          <span className="truncate">
                            {nextStatusLabel[order.status]}
                          </span>
                        </Button>
                      )}

                      {order.status !== "COMPLETED" &&
                        order.status !== "CANCELLED" && (
                          <Button
                            variant="outline"
                            className="flex-1 min-w-0 py-5 rounded-xl border-red-200 text-red-600 hover:bg-red-100 hover:text-red-800 transition-colors"
                            onClick={() => setRejectingOrderId(order.id)}
                            disabled={updatingOrderId === order.id}
                            aria-label="Reject order"
                          >
                            <X className="h-4 w-4 mr-1.5 shrink-0" />
                            <span className="truncate">Reject</span>
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
            className="absolute inset-0 bg-black/50"
            onClick={() => setRejectingOrderId(null)}
          />

          {/* Dialog */}
          <div className="relative bg-white border border-gray-200 rounded-2xl p-6 max-w-sm w-full shadow-lg">
            <button
              onClick={() => setRejectingOrderId(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="text-center">
              <div className="inline-flex items-center justify-center p-3 bg-red-50 rounded-xl mb-4">
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-brand-blue mb-2">
                Reject Order?
              </h3>
              <p className="text-gray-500 text-sm mb-6">
                This order will be cancelled and removed from the queue. This
                action cannot be undone.
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
                    updateOrderStatus(rejectingOrderId, "CANCELLED");
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

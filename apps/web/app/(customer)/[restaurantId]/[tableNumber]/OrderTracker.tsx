"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRealtimeWithPolling } from "@/hooks/useRealtimeWithPolling";
import { createClient } from "@/lib/supabase/client";
import {
  BellRing,
  CheckCircle2,
  ChefHat,
  CircleX,
  Clock,
  Flame,
  PackageCheck,
  Receipt,
} from "lucide-react";
import { useEffect, useState } from "react";

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

const STATUS_STEPS = [
  "PENDING",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "COMPLETED",
] as const;

const STATUS_META: Record<
  string,
  { label: string; icon: typeof Clock; badge: string; iconWrap: string }
> = {
  PENDING: {
    label: "Pending",
    icon: Clock,
    badge: "bg-yellow-100 text-yellow-800",
    iconWrap: "bg-yellow-100 text-yellow-700",
  },
  ACCEPTED: {
    label: "Accepted",
    icon: ChefHat,
    badge: "bg-blue-100 text-blue-800",
    iconWrap: "bg-blue-100 text-blue-700",
  },
  PREPARING: {
    label: "Preparing",
    icon: Flame,
    badge: "bg-orange-100 text-orange-800",
    iconWrap: "bg-brand-orange/10 text-brand-orange",
  },
  READY: {
    label: "Ready",
    icon: BellRing,
    badge: "bg-emerald-100 text-emerald-800",
    iconWrap: "bg-emerald-100 text-emerald-700",
  },
  COMPLETED: {
    label: "Completed",
    icon: PackageCheck,
    badge: "bg-gray-100 text-gray-800",
    iconWrap: "bg-gray-100 text-gray-600",
  },
  CANCELLED: {
    label: "Cancelled",
    icon: CircleX,
    badge: "bg-red-100 text-red-800",
    iconWrap: "bg-red-100 text-red-700",
  },
};

export default function OrderTracker({
  restaurantId,
  tableId,
  onStartNewOrder,
}: OrderTrackerProps) {
  const [orders, setOrders] = useState<TrackedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchActiveOrders = async () => {
    const { data: session } = await supabase
      .from("order_sessions")
      .select("id")
      .eq("table_id", tableId)
      .eq("status", "ACTIVE")
      .maybeSingle();

    if (!session) {
      setOrders([]);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("orders")
      .select(
        `
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
      `,
      )
      .eq("table_session_id", session.id)
      .order("created_at", { ascending: true });

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
    table: "orders",
    onChange: fetchActiveOrders,
  });

  const billTotal = orders.reduce(
    (sum, order) =>
      sum +
      order.order_items.reduce(
        (itemSum, item) => itemSum + item.unit_price * item.quantity,
        0,
      ),
    0,
  );
  const allPaid =
    orders.length > 0 && orders.every((o) => o.payment_status === "PAID");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-brand-blue/5 to-transparent">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-blue/5 via-white to-white p-4">
      <div className="max-w-md mx-auto space-y-4 py-6">
        <div className="text-center animate-slide-up">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-brand-blue text-white mb-3 shadow-md">
            <Receipt className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-brand-blue">Order Status</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Track your food as it is made
          </p>
        </div>

        {orders.length === 0 ? (
          <Card className="animate-slide-up">
            <CardContent className="py-10 text-center text-gray-500 flex flex-col items-center gap-2">
              <Receipt className="h-8 w-8 text-gray-300" />
              No active orders for this table.
            </CardContent>
          </Card>
        ) : (
          orders.map((order, idx) => {
            const meta = STATUS_META[order.status];
            const StatusIcon = meta.icon;
            const currentStepIndex = STATUS_STEPS.indexOf(
              order.status as (typeof STATUS_STEPS)[number],
            );
            return (
              <Card
                key={order.id}
                className="overflow-hidden animate-slide-up"
                style={{
                  animationDelay: `${idx * 60}ms`,
                  animationFillMode: "backwards",
                }}
              >
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`relative flex items-center justify-center h-9 w-9 rounded-full ${meta.iconWrap}`}
                    >
                      {order.status === "PREPARING" && (
                        <span className="absolute inset-0 rounded-full animate-pulse-glow" />
                      )}
                      <StatusIcon className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-base">
                      Order placed{" "}
                      {new Date(order.created_at).toLocaleTimeString()}
                    </CardTitle>
                  </div>
                  <Badge
                    className={meta.badge}
                    aria-label={`Order status: ${order.status}`}
                  >
                    {meta.label}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 text-sm mb-4">
                    {order.order_items.map((item) => (
                      <div key={item.id} className="flex justify-between">
                        <span>
                          {item.quantity}x {item.menu_item.name}
                        </span>
                        <span>
                          ${(item.unit_price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                  {order.status !== "CANCELLED" ? (
                    <div
                      className="flex justify-between"
                      role="list"
                      aria-label="Order progress"
                    >
                      {STATUS_STEPS.map((step, stepIdx) => {
                        const stepMeta = STATUS_META[step];
                        const StepIcon = stepMeta.icon;
                        const isDone = currentStepIndex > stepIdx;
                        const isCurrent = currentStepIndex === stepIdx;
                        return (
                          <div
                            key={step}
                            role="listitem"
                            className="flex flex-col items-center gap-1 flex-1"
                          >
                            <div className="flex items-center w-full">
                              <div
                                className={`h-0.5 flex-1 ${
                                  stepIdx === 0
                                    ? "opacity-0"
                                    : isDone || isCurrent
                                      ? "bg-brand-blue"
                                      : "bg-gray-200"
                                }`}
                              />
                              <div
                                className={`flex items-center justify-center h-7 w-7 shrink-0 rounded-full border-2 transition-colors ${
                                  isDone
                                    ? "bg-brand-blue border-brand-blue text-white"
                                    : isCurrent
                                      ? "border-brand-orange text-brand-orange bg-white"
                                      : "border-gray-200 text-gray-300 bg-white"
                                }`}
                              >
                                {isDone ? (
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                ) : (
                                  <StepIcon className="h-3.5 w-3.5" />
                                )}
                              </div>
                              <div
                                className={`h-0.5 flex-1 ${
                                  stepIdx === STATUS_STEPS.length - 1
                                    ? "opacity-0"
                                    : isDone
                                      ? "bg-brand-blue"
                                      : "bg-gray-200"
                                }`}
                              />
                            </div>
                            <span
                              className={`text-[10px] font-medium ${
                                isCurrent
                                  ? "text-brand-orange"
                                  : isDone
                                    ? "text-brand-blue"
                                    : "text-gray-400"
                              }`}
                            >
                              {stepMeta.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 rounded-md px-3 py-2">
                      <CircleX className="h-4 w-4 shrink-0" />
                      This order was cancelled.
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}

        {orders.length > 0 && (
          <Card className="animate-slide-up border-brand-blue/20">
            <CardContent className="py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-gray-400" />
                <span className="font-medium">
                  {allPaid
                    ? "Bill paid"
                    : `Bill total: $${billTotal.toFixed(2)}`}
                </span>
              </div>
              <Badge
                variant={allPaid ? "default" : "outline"}
                className={allPaid ? "bg-emerald-600 gap-1" : "gap-1"}
              >
                {allPaid ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <Clock className="h-3 w-3" />
                )}
                {allPaid ? "PAID" : "UNPAID"}
              </Badge>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

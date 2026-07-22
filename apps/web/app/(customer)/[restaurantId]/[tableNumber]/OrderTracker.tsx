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
  Star,
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";

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
  tableNumber: string;
  onStartNewOrder: () => void;
  showConfirmation?: boolean;
  orderId?: string;
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
  tableNumber,
  onStartNewOrder,
  showConfirmation = false,
  orderId,
}: OrderTrackerProps) {
  const [orders, setOrders] = useState<TrackedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [taxRate, setTaxRate] = useState<number>(0);
  const supabase = createClient();

  // Payment → feedback redirect state
  const [showPaymentAnimation, setShowPaymentAnimation] = useState(false);
  const prevAllPaidRef = useRef<boolean | null>(null);
  const redirectFiredRef = useRef(false);
  const latestOrderIdRef = useRef<string | null>(null);

  // Fetch restaurant tax rate
  useEffect(() => {
    const fetchTaxRate = async () => {
      const { data } = await supabase
        .from("restaurants")
        .select("tax_rate")
        .eq("id", restaurantId)
        .single();
      if (data) {
        setTaxRate(data.tax_rate || 0);
      }
    };
    fetchTaxRate();
  }, [restaurantId, supabase]);

  // Keep latest order ID ref updated for payment transition detection
  useEffect(() => {
    if (orders.length > 0) {
      latestOrderIdRef.current = orders[orders.length - 1].id;
    }
  }, [orders]);

  const billSubtotal = orders.reduce(
    (sum, order) =>
      sum +
      order.order_items.reduce(
        (itemSum, item) => itemSum + item.unit_price * item.quantity,
        0,
      ),
    0,
  );
  const billTax = billSubtotal * taxRate;
  const billTotal = billSubtotal + billTax;
  const allPaid =
    orders.length > 0 && orders.every((o) => o.payment_status === "PAID");
  const allCancelled =
    orders.length > 0 && orders.every((o) => o.status === "CANCELLED");

  // Detect payment_status transition from UNPAID → PAID,
  // show success animation, then redirect to feedback page
  useEffect(() => {
    // Skip the very first render — initialize prevAllPaidRef
    if (prevAllPaidRef.current === null) {
      prevAllPaidRef.current = allPaid;
      return;
    }

    const wasUnpaid = !prevAllPaidRef.current;
    prevAllPaidRef.current = allPaid;

    if (allPaid && wasUnpaid && !redirectFiredRef.current) {
      const orderId = latestOrderIdRef.current;
      if (!orderId) return;

      // Show success animation
      setShowPaymentAnimation(true);

      // After 2.5 seconds, check rating status and redirect
      const timer = setTimeout(async () => {
        if (redirectFiredRef.current) return;
        redirectFiredRef.current = true;

        // Check if already rated to prevent duplicate redirects
        try {
          const res = await fetch(`/api/orders/${orderId}/rate`);
          if (res.ok) {
            const data = await res.json();
            if (data.data) {
              // Already rated — just dismiss the animation and stay
              setShowPaymentAnimation(false);
              return;
            }
          }
        } catch {
          // If the rating check fails, still redirect
        }

        window.location.href = `/order/success/${orderId}`;
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [allPaid]);

  // Auto-redirect to menu after 4 seconds when all orders are cancelled
  useEffect(() => {
    if (allCancelled) {
      const timer = setTimeout(() => {
        window.location.href = `/${restaurantId}/${tableNumber}`;
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [allCancelled, restaurantId, tableNumber]);

  const fetchActiveOrders = async () => {
    // First try to find an active session
    const { data: session } = await supabase
      .from("order_sessions")
      .select("id")
      .eq("table_id", tableId)
      .eq("status", "ACTIVE")
      .maybeSingle();

    if (session) {
      // Active session found - fetch orders from it
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
      return;
    }

    // No active session - find the most recent session for this table (any status)
    // With the RLS fix, CLOSED sessions are also visible, so this catches paid orders
    const { data: recentSession } = await supabase
      .from("order_sessions")
      .select("id")
      .eq("table_id", tableId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentSession) {
      // Found recent session - fetch its orders (may include PAID orders)
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
        .eq("table_session_id", recentSession.id)
        .order("created_at", { ascending: true });

      if (data) {
        setOrders(data as unknown as TrackedOrder[]);
      }
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-brand-blue/5 to-transparent">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-blue/5 via-white to-white p-4">
      {/* Payment success animation overlay */}
      {showPaymentAnimation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="text-center animate-in slide-in-from-bottom-4 duration-500">
            <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-emerald-100 mb-5 shadow-lg ring-4 ring-emerald-50">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-brand-blue mb-2">
              Payment Successful!
            </h2>
            <p className="text-gray-500 mb-1">
              Thank you for dining with us.
            </p>
            <p className="text-sm text-gray-400 animate-pulse">
              Redirecting to feedback...
            </p>
          </div>
        </div>
      )}
      <div className="max-w-md mx-auto space-y-4 py-6">
        {/* Confirmation Header - shows when coming from Track Order button */}
        {showConfirmation && (
          <div className="text-center animate-slide-up">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-emerald-100 mb-3 shadow-md">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-brand-blue">Order Placed!</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Your order has been placed successfully
            </p>
            {orderId && (
              <a
                href={`/order/confirmation/${orderId}`}
                className="inline-block mt-4 text-sm font-medium text-brand-orange hover:underline"
              >
                View Order Confirmed →
              </a>
            )}
          </div>
        )}

        {/* <div className="text-center animate-slide-up">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-brand-blue text-white mb-3 shadow-md">
            <Receipt className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-brand-blue">Order Status</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Track your food as it is made
          </p>
        </div> */}

        {allCancelled ? (
          // All orders cancelled — show dedicated cancelled view
          <Card className="animate-slide-up border-red-200 bg-red-50">
            <CardContent className="py-10 text-center">
              <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-red-100 mb-4">
                <CircleX className="h-7 w-7 text-red-500" />
              </div>
              <h2 className="text-lg font-bold text-red-800 mb-1">
                Order Cancelled
              </h2>
              <p className="text-sm text-red-600 mb-6">
                We&apos;re sorry. Your order has been cancelled.
              </p>
              <button
                onClick={() => window.location.href = `/${restaurantId}/${tableNumber}`}
                className="w-full bg-brand-blue hover:bg-brand-blue/90 text-white font-medium py-3 px-4 rounded-md transition-colors"
              >
                Back to Menu
              </button>
            </CardContent>
          </Card>
        ) : orders.length === 0 || allPaid ? (
          allPaid ? (
            // Show payment success
            <Card className="animate-slide-up border-emerald-200 bg-emerald-50">
              <CardContent className="py-6 text-center">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-emerald-100 mb-3">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                </div>
                <h2 className="text-lg font-bold text-emerald-800">Payment Successful!</h2>
                <p className="text-sm text-emerald-600 mt-1">
                  Thank you for your payment
                </p>
              </CardContent>
            </Card>
          ) : (
            // No orders at all
            <Card className="animate-slide-up">
              <CardContent className="py-10 text-center text-gray-500 flex flex-col items-center gap-2">
                <Receipt className="h-8 w-8 text-gray-300" />
                No active orders for this table.
              </CardContent>
            </Card>
          )
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
            <CardContent className="py-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span>${billSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax ({(taxRate * 100).toFixed(1)}%)</span>
                  <span>${billTax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-brand-blue pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-gray-400" />
                    <span>{allPaid ? "Bill paid" : "Bill total"}</span>
                  </div>
                  <span>${billTotal.toFixed(2)}</span>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
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
              </div>
              {/* {allPaid && orders.length > 0 && (
                <Link
                  href={`/order/success/${orders[0].id}`}
                  className="block mt-3"
                >
                  <button className="w-full flex items-center justify-center gap-2 bg-brand-orange hover:bg-brand-orange/90 text-white font-medium py-2 px-4 rounded-md transition-colors">
                    <Star className="h-4 w-4" />
                    View Receipt & Rate Order
                  </button>
                </Link>
              )} */}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useRealtimeWithPolling } from "@/hooks/useRealtimeWithPolling";
import { createClient } from "@/lib/supabase/client";
import { CreditCard, DollarSign, Smartphone, Receipt, History } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

const orderStatusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  ACCEPTED: "bg-blue-100 text-blue-800",
  PREPARING: "bg-orange-100 text-orange-800",
  READY: "bg-green-50 text-green-700",
  COMPLETED: "bg-gray-100 text-gray-800",
  CANCELLED: "bg-red-100 text-red-800",
};

const paymentStatusColors: Record<string, string> = {
  UNPAID: "bg-yellow-100 text-yellow-800",
  COMPLETED: "bg-green-50 text-green-700",
  REFUNDED: "bg-red-100 text-red-800",
};

// refund_payment() appends notes as "REFUNDED by <user id>: <reason>"; pull
// out just the reason for display so cashiers don't see the internal user id.
function extractRefundReason(notes: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(/REFUNDED by [^:]+:\s*([\s\S]+)$/);
  return match ? match[1].trim() : null;
}

interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  menu_item: {
    name: string;
  };
}

interface Order {
  id: string;
  status: string;
  payment_status: string;
  created_at: string;
  special_instructions: string | null;
  table: {
    table_number: number;
    name: string | null;
  };
  order_items: OrderItem[];
}

interface PaymentSummary {
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
}

interface RecentPayment {
  id: string;
  total_amount: number;
  payment_status: string;
  notes: string | null;
  order: { table: { table_number: number } };
}

interface RefundTarget {
  id: string;
  tableNumber: number;
  amount: number;
}

function CashierDashboardContent() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [taxRate, setTaxRate] = useState<number | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);
  const [refundTarget, setRefundTarget] = useState<RefundTarget | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refunding, setRefunding] = useState(false);
  const supabase = createClient();
  const searchParams = useSearchParams();

  const fetchOrders = useCallback(async () => {
    // Get current user's restaurant_id
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("restaurant_id")
      .eq("id", user.id)
      .single();

    if (!profile?.restaurant_id) return;

    const { data } = await supabase
      .from("orders")
      .select(
        `
        id,
        status,
        payment_status,
        created_at,
        special_instructions,
        table:tables(table_number, name),
        order_items(
          id,
          quantity,
          unit_price,
          menu_item:menu_items(name)
        )
      `,
      )
      .eq("restaurant_id", profile.restaurant_id)
      .in("status", ["READY", "COMPLETED"])
      .eq("payment_status", "UNPAID")
      .order("created_at", { ascending: true });

    if (data) {
      setOrders(data as unknown as Order[]);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTaxRate = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setTaxRate(0);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("restaurant_id")
      .eq("id", user.id)
      .single();
    if (!profile?.restaurant_id) {
      setTaxRate(0);
      return;
    }

    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("tax_rate")
      .eq("id", profile.restaurant_id)
      .single();
    if (restaurant) {
      setTaxRate(Number(restaurant.tax_rate));
    } else {
      setTaxRate(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchRecentPayments = useCallback(async () => {
    // Get current user's restaurant_id
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("restaurant_id")
      .eq("id", user.id)
      .single();

    if (!profile?.restaurant_id) return;

    const { data } = await supabase
      .from("payments")
      .select(
        "id, total_amount, payment_status, notes, order:orders(table:tables(table_number))",
      )
      .eq("restaurant_id", profile.restaurant_id)
      .in("payment_status", ["COMPLETED", "REFUNDED"])
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) {
      setRecentPayments(data as unknown as RecentPayment[]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const init = async () => {
      await Promise.all([
        fetchOrders(),
        fetchTaxRate(),
        fetchRecentPayments(),
      ]);
      setLoading(false);
    };
    init();
  }, [fetchOrders, fetchTaxRate, fetchRecentPayments]);

  useEffect(() => {
    const orderIdParam = searchParams.get("order");
    if (orderIdParam) {
      const match = orders.find((o) => o.id === orderIdParam);
      if (match) {
        setSelectedOrder(match);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, searchParams]);

  useRealtimeWithPolling({
    channelName: "cashier-orders",
    table: "orders",
    onChange: fetchOrders,
  });

  useRealtimeWithPolling({
    channelName: "cashier-payments",
    table: "payments",
    onChange: fetchRecentPayments,
  });

  const calculateSummary = (order: Order): PaymentSummary => {
    const subtotal = order.order_items.reduce(
      (sum, item) => sum + item.unit_price * item.quantity,
      0,
    );
    const tax = subtotal * (taxRate ?? 0);
    const discount = Math.min(discountAmount, subtotal + tax);
    const total = subtotal + tax - discount;

    return {
      subtotal,
      tax,
      discount,
      total,
    };
  };

  const processPayment = async (
    orderId: string,
    method: "CASH" | "CARD" | "DIGITAL_WALLET",
  ) => {
    setProcessing(true);
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    const summary = calculateSummary(order);

    const response = await fetch("/api/payments/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order_id: orderId,
        amount: summary.total,
        tax_amount: summary.tax,
        discount_amount: summary.discount,
        payment_method: method,
      }),
    });

    if (!response.ok) {
      const { error } = await response.json();
      setErrorMessage(error?.message ?? "Failed to process payment");
      setProcessing(false);
      return;
    }

    setOrders(orders.filter((o) => o.id !== orderId));
    setSelectedOrder(null);
    setDiscountAmount(0);
    setErrorMessage(null);
    setProcessing(false);
    fetchRecentPayments();
  };

  const submitRefund = async () => {
    if (!refundTarget) return;
    if (refundReason.trim().length === 0) {
      setRefundError("A refund reason is required.");
      return;
    }

    setRefunding(true);
    const response = await fetch(`/api/payments/${refundTarget.id}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: refundReason }),
    });

    if (!response.ok) {
      const { error } = await response.json();
      setRefundError(error?.message ?? "Failed to process refund");
      setRefunding(false);
      return;
    }

    setRefunding(false);
    setRefundTarget(null);
    setRefundReason("");
    setRefundError(null);
    fetchRecentPayments();
  };

  if (loading || taxRate === null) {
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
              <CreditCard className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">Cashier Dashbord</h1>
              <p className="text-sm text-white/60 mt-0.5">
                {orders.length} order{orders.length !== 1 ? "s" : ""} awaiting payment
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {errorMessage && (
          <div
            className="mb-6 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md"
            role="alert"
          >
            {errorMessage}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-brand-blue">
              <Receipt className="h-5 w-5" />
              Pending Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <div className="py-10 text-center text-gray-500 flex flex-col items-center gap-2">
                <Receipt className="h-8 w-8 text-gray-300" />
                No orders awaiting payment
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => {
                  const summary = calculateSummary(order);
                  return (
                    <div
                      key={order.id}
                      className="p-4 border rounded-lg cursor-pointer transition-colors hover:bg-brand-blue/5 hover:border-brand-blue/20"
                      onClick={() => setSelectedOrder(order)}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center h-9 w-9 rounded-full bg-amber-100 text-amber-700 shrink-0">
                            <Receipt className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-medium">
                              Table {order.table.table_number}
                              {order.table.name && (
                                <span className="text-sm text-gray-500 ml-2">
                                  ({order.table.name})
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">
                              {order.order_items.length} items •{" "}
                              {new Date(order.created_at).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-brand-blue">
                            ${summary.total.toFixed(2)}
                          </div>
                          <Badge className={orderStatusColors[order.status]}>
                            {order.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog
          open={selectedOrder !== null}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedOrder(null);
              setDiscountAmount(0);
            }
          }}
        >
          <DialogContent>
            {selectedOrder && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-brand-blue">
                    Payment Summary — Table {selectedOrder.table.table_number}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="pb-4 border-b">
                    <div className="space-y-1 text-sm">
                      {selectedOrder.order_items.map((item) => (
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
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="discount" className="text-sm font-medium">
                      Discount ($)
                    </label>
                    <Input
                      id="discount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={discountAmount}
                      onChange={(e) =>
                        setDiscountAmount(Number(e.target.value) || 0)
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal</span>
                      <span>
                        ${calculateSummary(selectedOrder).subtotal.toFixed(2)}
                      </span>
                    </div>
                    {calculateSummary(selectedOrder).discount > 0 && (
                      <div className="flex justify-between text-sm text-green-700">
                        <span>Discount</span>
                        <span>
                          -$
                          {calculateSummary(selectedOrder).discount.toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span>Tax ({(taxRate ?? 0).toFixed(1)}%)</span>
                      <span>
                        ${calculateSummary(selectedOrder).tax.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between font-bold text-lg pt-2 border-t">
                      <span>Total</span>
                      <span className="text-brand-blue">
                        ${calculateSummary(selectedOrder).total.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <Button
                      className="w-full bg-brand-orange hover:bg-brand-orange/90"
                      onClick={() => processPayment(selectedOrder.id, "CASH")}
                      disabled={processing}
                    >
                      <DollarSign className="h-4 w-4 mr-2" />
                      Cash
                    </Button>
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => processPayment(selectedOrder.id, "CARD")}
                      disabled={processing}
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      Card
                    </Button>
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() =>
                        processPayment(selectedOrder.id, "DIGITAL_WALLET")
                      }
                      disabled={processing}
                    >
                      <Smartphone className="h-4 w-4 mr-2" />
                      Digital Wallet
                    </Button>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        <Dialog
          open={refundTarget !== null}
          onOpenChange={(open) => {
            if (!open) {
              setRefundTarget(null);
              setRefundReason("");
              setRefundError(null);
            }
          }}
        >
          <DialogContent>
            {refundTarget && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-brand-blue">
                    Refund Table {refundTarget.tableNumber} — $
                    {refundTarget.amount.toFixed(2)}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label
                      htmlFor="refund-reason"
                      className="text-sm font-medium"
                    >
                      Reason
                    </label>
                    <Input
                      id="refund-reason"
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      placeholder="e.g. wrong order delivered"
                    />
                  </div>

                  {refundError && (
                    <div
                      className="p-3 text-sm text-red-600 bg-red-50 rounded-md"
                      role="alert"
                    >
                      {refundError}
                    </div>
                  )}

                  <div className="flex gap-2 justify-end pt-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setRefundTarget(null);
                        setRefundReason("");
                        setRefundError(null);
                      }}
                      disabled={refunding}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={submitRefund}
                      disabled={refunding}
                    >
                      {refunding ? "Processing..." : "Confirm Refund"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-brand-blue">
              <History className="h-5 w-5" />
              Recent Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentPayments.length === 0 ? (
              <div className="py-6 text-center text-gray-500 flex flex-col items-center gap-2">
                <History className="h-6 w-6 text-gray-300" />
                No recent payments
              </div>
            ) : (
              <div className="space-y-2">
                {recentPayments.map((payment) => {
                  const refundReason =
                    payment.payment_status === "REFUNDED"
                      ? extractRefundReason(payment.notes)
                      : null;
                  return (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between gap-2 flex-wrap p-2 border-b last:border-0"
                  >
                    <span className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-2">
                        <span className="flex items-center justify-center h-7 w-7 rounded-full bg-emerald-100 text-emerald-700 shrink-0">
                          <DollarSign className="h-3.5 w-3.5" />
                        </span>
                        Table {payment.order.table.table_number} — $
                        {Number(payment.total_amount).toFixed(2)}
                        {payment.payment_status === "REFUNDED" && (
                          <Badge className={paymentStatusColors["REFUNDED"]}>
                            Refunded
                          </Badge>
                        )}
                      </span>
                      {refundReason && (
                        <span className="text-xs text-gray-500 pl-9">
                          Reason: {refundReason}
                        </span>
                      )}
                    </span>
                    {payment.payment_status === "COMPLETED" && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setRefundTarget({
                            id: payment.id,
                            tableNumber: payment.order.table.table_number,
                            amount: Number(payment.total_amount),
                          });
                          setRefundReason("");
                          setRefundError(null);
                        }}
                      >
                        Refund
                      </Button>
                    )}
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

export default function CashierDashboard() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-brand-blue/5 to-transparent">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue"></div>
        </div>
      }
    >
      <CashierDashboardContent />
    </Suspense>
  );
}

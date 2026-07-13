'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useRealtimeWithPolling } from '@/hooks/useRealtimeWithPolling';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { CreditCard, DollarSign, Smartphone } from 'lucide-react';

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
  order: { table: { table_number: number } };
}

export default function CashierDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [taxRate, setTaxRate] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);
  const supabase = createClient();
  const searchParams = useSearchParams();

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select(`
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
      `)
      .in('status', ['READY', 'COMPLETED'])
      .eq('payment_status', 'UNPAID')
      .order('created_at', { ascending: true });

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
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('restaurant_id')
      .eq('id', user.id)
      .single();
    if (!profile?.restaurant_id) return;

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('tax_rate')
      .eq('id', profile.restaurant_id)
      .single();
    if (restaurant) {
      setTaxRate(Number(restaurant.tax_rate));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchRecentPayments = useCallback(async () => {
    const { data } = await supabase
      .from('payments')
      .select('id, total_amount, payment_status, order:orders(table:tables(table_number))')
      .eq('payment_status', 'COMPLETED')
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) {
      setRecentPayments(data as unknown as RecentPayment[]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchTaxRate();
    fetchRecentPayments();
  }, [fetchOrders, fetchTaxRate, fetchRecentPayments]);

  useEffect(() => {
    const orderIdParam = searchParams.get('order');
    if (orderIdParam) {
      const match = orders.find((o) => o.id === orderIdParam);
      if (match) {
        setSelectedOrder(match);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, searchParams]);

  useRealtimeWithPolling({
    channelName: 'cashier-orders',
    table: 'orders',
    onChange: fetchOrders,
  });

  useRealtimeWithPolling({
    channelName: 'cashier-payments',
    table: 'payments',
    onChange: fetchRecentPayments,
  });

  const calculateSummary = (order: Order): PaymentSummary => {
    const subtotal = order.order_items.reduce(
      (sum, item) => sum + item.unit_price * item.quantity,
      0
    );
    const tax = subtotal * taxRate;
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
    method: 'CASH' | 'CARD' | 'DIGITAL_WALLET'
  ) => {
    setProcessing(true);
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    const summary = calculateSummary(order);

    const { error } = await supabase.rpc('process_payment', {
      p_order_id: orderId,
      p_amount: summary.subtotal,
      p_tax_amount: summary.tax,
      p_discount_amount: summary.discount,
      p_payment_method: method,
    });

    if (error) {
      setErrorMessage(error.message);
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

  const handleRefund = async (paymentId: string) => {
    const reason = window.prompt('Refund reason (required):');
    if (!reason || reason.trim().length === 0) return;

    const response = await fetch(`/api/payments/${paymentId}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });

    if (!response.ok) {
      const { error } = await response.json();
      setErrorMessage(error?.message ?? 'Failed to process refund');
      return;
    }

    setErrorMessage(null);
    fetchRecentPayments();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <CreditCard className="h-8 w-8" />
          <h1 className="text-3xl font-bold">Cashier Terminal</h1>
        </div>

        {errorMessage && (
          <div className="mb-6 p-3 text-sm text-red-600 bg-red-50 rounded-md" role="alert">
            {errorMessage}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Orders List */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Pending Payments</CardTitle>
              </CardHeader>
              <CardContent>
                {orders.length === 0 ? (
                  <div className="py-8 text-center text-gray-500">
                    No orders awaiting payment
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orders.map((order) => {
                      const summary = calculateSummary(order);
                      return (
                        <div
                          key={order.id}
                          className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                            selectedOrder?.id === order.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'hover:bg-gray-50'
                          }`}
                          onClick={() => setSelectedOrder(order)}
                        >
                          <div className="flex items-center justify-between">
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
                                {order.order_items.length} items •{' '}
                                {new Date(order.created_at).toLocaleTimeString()}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold">
                                ${summary.total.toFixed(2)}
                              </div>
                              <Badge variant="outline">{order.status}</Badge>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Payment Summary */}
          <div>
            <Card className="sticky top-8">
              <CardHeader>
                <CardTitle>Payment Summary</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedOrder ? (
                  <div className="space-y-4">
                    <div className="pb-4 border-b">
                      <div className="font-medium mb-2">
                        Table {selectedOrder.table.table_number}
                      </div>
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
                        onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal</span>
                        <span>${calculateSummary(selectedOrder).subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Tax ({(taxRate * 100).toFixed(0)}%)</span>
                        <span>${calculateSummary(selectedOrder).tax.toFixed(2)}</span>
                      </div>
                      {calculateSummary(selectedOrder).discount > 0 && (
                        <div className="flex justify-between text-sm text-green-700">
                          <span>Discount</span>
                          <span>-${calculateSummary(selectedOrder).discount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-lg pt-2 border-t">
                        <span>Total</span>
                        <span>${calculateSummary(selectedOrder).total.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="space-y-2 pt-4">
                      <Button
                        className="w-full"
                        onClick={() => processPayment(selectedOrder.id, 'CASH')}
                        disabled={processing}
                      >
                        <DollarSign className="h-4 w-4 mr-2" />
                        Cash
                      </Button>
                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={() => processPayment(selectedOrder.id, 'CARD')}
                        disabled={processing}
                      >
                        <CreditCard className="h-4 w-4 mr-2" />
                        Card
                      </Button>
                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={() =>
                          processPayment(selectedOrder.id, 'DIGITAL_WALLET')
                        }
                        disabled={processing}
                      >
                        <Smartphone className="h-4 w-4 mr-2" />
                        Digital Wallet
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-gray-500">
                    Select an order to process payment
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Recent Payments</CardTitle>
          </CardHeader>
          <CardContent>
            {recentPayments.length === 0 ? (
              <div className="py-4 text-center text-gray-500">No recent payments</div>
            ) : (
              <div className="space-y-2">
                {recentPayments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-2 border-b last:border-0">
                    <span>
                      Table {payment.order.table.table_number} — $
                      {Number(payment.total_amount).toFixed(2)}
                      {payment.payment_status === 'REFUNDED' && (
                        <Badge variant="outline" className="ml-2">
                          Refunded
                        </Badge>
                      )}
                    </span>
                    {payment.payment_status === 'COMPLETED' && (
                      <Button size="sm" variant="destructive" onClick={() => handleRefund(payment.id)}>
                        Refund
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

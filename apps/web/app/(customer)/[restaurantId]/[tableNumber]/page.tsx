'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Plus, Minus, ChefHat, UtensilsCrossed } from 'lucide-react';
import Image from 'next/image';
import OrderTracker from './OrderTracker';

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  is_available: boolean;
}

interface Category {
  id: string;
  name: string;
  sort_order: number;
  items: MenuItem[];
}

interface Restaurant {
  id: string;
  name: string;
  logo_url: string | null;
}

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  special_instructions: string;
}

export default function CustomerMenuPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const restaurantId = params.restaurantId as string;
  const tableNumber = params.tableNumber as string;

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tableOccupied, setTableOccupied] = useState(false);
  const [tableId, setTableId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const fetchMenu = async () => {
      const { data: restaurantData } = await supabase
        .from('restaurants')
        .select('id, name, logo_url')
        .eq('id', restaurantId)
        .eq('is_active', true)
        .single();

      if (restaurantData) {
        setRestaurant(restaurantData);

        const { data: categoriesData } = await supabase
          .from('categories')
          .select(`
            id,
            name,
            sort_order,
            items:menu_items(
              id,
              name,
              description,
              price,
              image_url,
              is_available
            )
          `)
          .eq('restaurant_id', restaurantId)
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (categoriesData) {
          const filteredCategories = categoriesData.map((cat) => ({
            ...cat,
            items: cat.items.filter((item: MenuItem) => item.is_available),
          }));
          setCategories(filteredCategories as unknown as Category[]);
        }

        // Look up the table to get tableId — needed to render OrderTracker
        // on subsequent visits
        const { data: tableData } = await supabase
          .from('tables')
          .select('id')
          .eq('restaurant_id', restaurantId)
          .eq('table_number', parseInt(tableNumber))
          .single();

        if (tableData) {
          setTableId(tableData.id);

          // Only restore tracking view when there's an ACTIVE session (order in progress).
          // Ignore CLOSED/PAID/rated sessions — the customer journey for that order
          // is complete and they should see the menu instead.
          const { data: activeSession } = await supabase
            .from('order_sessions')
            .select('id')
            .eq('table_id', tableData.id)
            .eq('status', 'ACTIVE')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (activeSession) {
            const { data: existingOrders } = await supabase
              .from('orders')
              .select('id, status')
              .eq('table_session_id', activeSession.id);

            if (existingOrders && existingOrders.length > 0) {
              // Only restore if there's at least one non-cancelled order.
              // A session with only cancelled orders is considered finished.
              const hasActiveOrders = existingOrders.some(o => o.status !== 'CANCELLED');
              if (hasActiveOrders) {
                setOrderPlaced(true);
              }
            }
          }
        }
      }

      setLoading(false);
    };

    fetchMenu();
  }, [restaurantId, supabase]);

  // Stale ?orderPlaced=true in URL but no active session → clean the URL
  const staleOrderParam = !loading && !orderPlaced && searchParams.get('orderPlaced') === 'true';
  useEffect(() => {
    if (staleOrderParam) {
      router.replace(`/${restaurantId}/${tableNumber}`);
    }
  }, [staleOrderParam, router, restaurantId, tableNumber]);

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((ci) => ci.menuItem.id === item.id);
      if (existing) {
        return prev.map((ci) =>
          ci.menuItem.id === item.id
            ? { ...ci, quantity: ci.quantity + 1 }
            : ci
        );
      }
      return [...prev, { menuItem: item, quantity: 1, special_instructions: '' }];
    });
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) => {
      const updated = prev.map((ci) =>
        ci.menuItem.id === itemId
          ? { ...ci, quantity: Math.max(0, ci.quantity + delta) }
          : ci
      );
      return updated.filter((ci) => ci.quantity > 0);
    });
  };

  const updateSpecialInstructions = (itemId: string, instructions: string) => {
    setCart((prev) =>
      prev.map((ci) =>
        ci.menuItem.id === itemId ? { ...ci, special_instructions: instructions } : ci
      )
    );
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((ci) => ci.menuItem.id !== itemId));
  };

  const getCartTotal = () => {
    return cart.reduce(
      (sum, item) => sum + item.menuItem.price * item.quantity,
      0
    );
  };

  const placeOrder = async () => {
    if (cart.length === 0) return;

    setSubmitting(true);

    // Find or create table
    const { data: tableData } = await supabase
      .from('tables')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('table_number', parseInt(tableNumber))
      .single();

    if (!tableData) {
      setErrorMessage('Table not found. Please scan the QR code again.');
      setSubmitting(false);
      return;
    }

    setTableId(tableData.id);

    // Call the create_order_with_session function
    const { data, error } = await supabase.rpc('create_order_with_session', {
      p_restaurant_id: restaurantId,
      p_table_id: tableData.id,
      p_items: cart.map((item) => ({
        menu_item_id: item.menuItem.id,
        quantity: item.quantity,
        special_instructions: item.special_instructions || null,
      })),
    });

    if (error) {
      if (error.message.includes('active session already exists')) {
        setTableOccupied(true);
        setErrorMessage(
          'This table already has an order in progress. Please ask staff to bring your bill before placing a new order.'
        );
      } else {
        setTableOccupied(false);
        setErrorMessage(error.message);
      }
    } else {
      router.push(`/order/confirmation/${data}`);
      setCart([]);
      setTableOccupied(false);
      setErrorMessage(null);
    }

    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-brand-blue/5 to-transparent">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue"></div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <UtensilsCrossed className="h-10 w-10 mx-auto text-gray-300 mb-3" />
          <h1 className="text-2xl font-bold mb-2">Restaurant not found</h1>
          <p className="text-gray-500">This restaurant may be inactive</p>
        </div>
      </div>
    );
  }

  if (orderPlaced && tableId) {
    return (
      <OrderTracker
        restaurantId={restaurantId}
        tableId={tableId}
        tableNumber={tableNumber}
        onStartNewOrder={() => {
          // Force a full page navigation to clear all React state and
          // let the init check determine whether to show menu or tracker
          window.location.href = `/${restaurantId}/${tableNumber}`;
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header + category quick-jump */}
      <div className="sticky top-0 z-10">
        <div className="bg-brand-blue shadow-sm">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {restaurant.logo_url ? (
                  <Image
                    src={restaurant.logo_url}
                    alt={`${restaurant.name} logo`}
                    width={40}
                    height={40}
                    className="rounded-full object-cover ring-2 ring-white/20"
                  />
                ) : (
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-white/10 text-brand-orange">
                    <ChefHat className="h-5 w-5" />
                  </div>
                )}
                <div>
                  <h1 className="text-xl font-bold text-white">{restaurant.name}</h1>
                  <span className="inline-block mt-0.5 text-xs font-medium text-brand-blue bg-white/90 rounded-full px-2 py-0.5">
                    Table {tableNumber}
                  </span>
                </div>
              </div>
              {cart.length > 0 && (
                <Badge className="bg-brand-orange gap-1">
                  <ShoppingCart className="h-3 w-3" />
                  {cart.reduce((sum, item) => sum + item.quantity, 0)}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Category quick-jump */}
        <div className="bg-gray-50/95 backdrop-blur border-b border-gray-100">
          <div className="max-w-4xl mx-auto px-4 py-2 flex gap-2 overflow-x-auto">
            {categories.map((category) => (
              <a
                key={category.id}
                href={`#category-${category.id}`}
                className="shrink-0 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 hover:border-brand-orange hover:text-brand-orange transition-colors"
              >
                {category.name}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Menu */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        {categories.map((category) => (
          <section key={category.id} id={`category-${category.id}`} className="scroll-mt-32">
            <h2 className="text-lg font-bold text-brand-blue mb-3">{category.name}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {category.items.map((item) => {
                const cartItem = cart.find(
                  (ci) => ci.menuItem.id === item.id
                );
                return (
                  <Card
                    key={item.id}
                    className="overflow-hidden transition-shadow hover:shadow-md"
                  >
                    <CardContent className="p-3">
                      <div className="flex gap-3">
                        {item.image_url ? (
                          <Image
                            src={item.image_url}
                            alt={item.name}
                            width={64}
                            height={64}
                            className="object-cover rounded-lg h-16 w-16 shrink-0"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-16 w-16 shrink-0 rounded-lg bg-brand-blue/5 text-brand-blue/30">
                            <UtensilsCrossed className="h-6 w-6" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm">{item.name}</h3>
                          <p className="text-xs text-gray-500 line-clamp-1">
                            {item.description}
                          </p>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="font-bold text-sm text-brand-blue">
                              ${item.price.toFixed(2)}
                            </span>
                            {cartItem ? (
                              <div className="flex items-center gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-full h-7 w-7 p-0"
                                  onClick={() =>
                                    updateQuantity(item.id, -1)
                                  }
                                >
                                  <Minus className="h-3.5 w-3.5" />
                                </Button>
                                <span className="w-5 text-center text-sm font-medium">
                                  {cartItem.quantity}
                                </span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-full h-7 w-7 p-0"
                                  onClick={() =>
                                    updateQuantity(item.id, 1)
                                  }
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                className="rounded-full h-7 px-3 text-xs bg-brand-orange hover:bg-brand-orange/90"
                                onClick={() => addToCart(item)}
                              >
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                Add
                              </Button>
                            )}
                          </div>
                          {cartItem && (
                            <input
                              type="text"
                              placeholder="Special instructions (e.g. no onions)"
                              value={cartItem.special_instructions}
                              onChange={(e) => updateSpecialInstructions(item.id, e.target.value)}
                              className="mt-2 w-full text-xs border rounded px-2 py-1.5 min-h-[36px]"
                              aria-label={`Special instructions for ${item.name}`}
                            />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* Cart Footer */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-brand-blue shadow-lg">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="relative flex items-center justify-center h-9 w-9 rounded-full bg-brand-blue/10 text-brand-blue">
                  <ShoppingCart className="h-4 w-4" />
                </div>
                <span className="font-medium">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)} items
                </span>
              </div>
              <span className="font-bold text-lg text-brand-blue">${getCartTotal().toFixed(2)}</span>
            </div>
            {errorMessage && (
              <div
                className={`mb-3 p-3 text-sm rounded-md ${
                  tableOccupied
                    ? 'text-amber-800 bg-amber-50 border border-amber-200'
                    : 'text-red-600 bg-red-50'
                }`}
                role="alert"
              >
                {errorMessage}
              </div>
            )}
            <Button
              className="w-full bg-brand-orange hover:bg-brand-orange/90"
              size="lg"
              onClick={placeOrder}
              disabled={submitting}
            >
              {submitting ? 'Placing Order...' : 'Place Order'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

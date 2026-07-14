'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShoppingCart, Plus, Minus, Trash2 } from 'lucide-react';
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
      }

      setLoading(false);
    };

    fetchMenu();
  }, [restaurantId, supabase]);

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
      setOrderPlaced(true);
      setCart([]);
      setTableOccupied(false);
      setErrorMessage(null);
    }

    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
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
        onStartNewOrder={() => setOrderPlaced(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {restaurant.logo_url && (
                <Image
                  src={restaurant.logo_url}
                  alt={`${restaurant.name} logo`}
                  width={32}
                  height={32}
                  className="rounded object-cover"
                />
              )}
              <div>
                <h1 className="text-xl font-bold">{restaurant.name}</h1>
                <p className="text-sm text-gray-500">Table {tableNumber}</p>
              </div>
            </div>
            {cart.length > 0 && (
              <Badge className="bg-blue-600">
                {cart.reduce((sum, item) => sum + item.quantity, 0)} items
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Menu */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <Tabs defaultValue={categories[0]?.id} className="space-y-6">
          <TabsList className="w-full justify-start overflow-x-auto">
            {categories.map((category) => (
              <TabsTrigger key={category.id} value={category.id}>
                {category.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {categories.map((category) => (
            <TabsContent key={category.id} value={category.id}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {category.items.map((item) => {
                  const cartItem = cart.find(
                    (ci) => ci.menuItem.id === item.id
                  );
                  return (
                    <Card key={item.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          {item.image_url && (
                            <Image
                              src={item.image_url}
                              alt={item.name}
                              width={80}
                              height={80}
                              className="object-cover rounded"
                            />
                          )}
                          <div className="flex-1">
                            <h3 className="font-medium">{item.name}</h3>
                            <p className="text-sm text-gray-500 line-clamp-2">
                              {item.description}
                            </p>
                            <div className="flex items-center justify-between mt-2">
                              <span className="font-bold">
                                ${item.price.toFixed(2)}
                              </span>
                              {cartItem ? (
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      updateQuantity(item.id, -1)
                                    }
                                  >
                                    <Minus className="h-4 w-4" />
                                  </Button>
                                  <span className="w-8 text-center">
                                    {cartItem.quantity}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      updateQuantity(item.id, 1)
                                    }
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => addToCart(item)}
                                >
                                  <Plus className="h-4 w-4 mr-1" />
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
                                className="mt-2 w-full text-sm border rounded px-2 py-1.5 min-h-[44px]"
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
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Cart Footer */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                <span className="font-medium">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)} items
                </span>
              </div>
              <span className="font-bold">${getCartTotal().toFixed(2)}</span>
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
              className="w-full"
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

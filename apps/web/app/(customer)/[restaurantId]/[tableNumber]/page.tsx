'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShoppingCart, Plus, Minus, Trash2 } from 'lucide-react';

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
      alert('Table not found');
      setSubmitting(false);
      return;
    }

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
      alert('Error placing order: ' + error.message);
    } else {
      setOrderPlaced(true);
      setCart([]);
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

  if (orderPlaced) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <div className="text-6xl mb-4">✓</div>
            <h1 className="text-2xl font-bold mb-2">Order Placed!</h1>
            <p className="text-gray-500 mb-6">
              Your order has been sent to the kitchen. Please wait for your food
              to be ready.
            </p>
            <Button onClick={() => setOrderPlaced(false)}>
              Place Another Order
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">{restaurant.name}</h1>
              <p className="text-sm text-gray-500">Table {tableNumber}</p>
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
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="w-20 h-20 object-cover rounded"
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

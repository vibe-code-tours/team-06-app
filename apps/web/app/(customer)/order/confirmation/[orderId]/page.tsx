'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { estimatePrepTime } from '@/lib/prepTime'
import {
    CheckCircle2,
    Clock,
    MapPin,
    ArrowRight,
    UtensilsCrossed,
    Loader2,
} from 'lucide-react'
import Link from 'next/link'
import OrderTracker from '@/app/(customer)/[restaurantId]/[tableNumber]/OrderTracker'

interface OrderItem {
    id: string
    quantity: number
    unit_price: number
    menu_item: { name: string }
}

interface OrderData {
    id: string
    status: string
    payment_status: string
    created_at: string
    restaurant_id: string
    table: { id: string; table_number: number; name: string | null }
    restaurant: { name: string; tax_rate: number }
    order_items: OrderItem[]
}

export default function OrderConfirmationPage() {
    const params = useParams()
    const orderId = params.orderId as string

    const [order, setOrder] = useState<OrderData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showTracker, setShowTracker] = useState(false)

    useEffect(() => {
        const fetchOrder = async () => {
            try {
                const res = await fetch(`/api/public/orders/${orderId}`)
                const data = await res.json()

                if (!res.ok) {
                    setError(data.error?.message || 'Order not found')
                    return
                }

                setOrder(data.data)
            } catch {
                setError('Failed to load order details')
            } finally {
                setLoading(false)
            }
        }

        fetchOrder()
    }, [orderId])

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-brand-blue/5 to-transparent">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue" />
            </div>
        )
    }

    if (error || !order) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-brand-blue/5 to-transparent">
                <div className="text-center px-4">
                    <UtensilsCrossed className="h-10 w-10 mx-auto text-gray-300 mb-3" />
                    <h1 className="text-2xl font-bold mb-2">Order not found</h1>
                    <p className="text-gray-500">{error || 'This order may have expired.'}</p>
                </div>
            </div>
        )
    }

    const itemCount = order.order_items.reduce((sum, item) => sum + item.quantity, 0)
    const prepTime = estimatePrepTime(itemCount)
    const subtotal = order.order_items.reduce(
        (sum, item) => sum + item.unit_price * item.quantity,
        0
    )
    const taxAmount = subtotal * order.restaurant.tax_rate
    const total = subtotal + taxAmount

    const tableName = order.table.name || `Table ${order.table.table_number}`

    // Show OrderTracker when Track Order is clicked
    if (showTracker) {
        return (
            <OrderTracker
                restaurantId={order.restaurant_id}
                tableId={order.table.id}
                tableNumber={order.table.table_number.toString()}
                onStartNewOrder={() => setShowTracker(false)}
                showConfirmation={true}
                orderId={orderId}
            />
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-brand-blue/5 via-white to-white p-4">
            <div className="max-w-lg mx-auto py-8 space-y-5 animate-slide-up">
                {/* Success Header */}
                <div className="text-center">
                    <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-emerald-100 mb-4 shadow-md">
                        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-brand-blue">Order Confirmed!</h1>
                    <p className="text-gray-500 mt-1">
                        Your order has been placed successfully
                    </p>
                </div>

                {/* Order Number */}
                <Card className="border-brand-blue/20">
                    <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">Order Number</p>
                                <p className="text-lg font-bold text-brand-blue mt-0.5">
                                    #{orderId.slice(0, 8).toUpperCase()}
                                </p>
                            </div>
                            <Badge className="bg-brand-blue/10 text-brand-blue border-brand-blue/20">
                                {order.status}
                            </Badge>
                        </div>
                    </CardContent>
                </Card>

                {/* Estimated Prep Time */}
                <Card className="border-brand-orange/30 bg-brand-orange/5">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-brand-orange/10 text-brand-orange shrink-0">
                                <Clock className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-700">
                                    Estimated Preparation Time
                                </p>
                                <p className="text-lg font-bold text-brand-orange">
                                    {prepTime.min}–{prepTime.max} minutes
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Table Info */}
                <Card>
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-brand-blue/10 text-brand-blue shrink-0">
                                <MapPin className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">{order.restaurant.name}</p>
                                <p className="font-medium">{tableName}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Order Summary */}
                <Card>
                    <CardContent className="py-4">
                        <h3 className="font-semibold text-brand-blue mb-3">Order Summary</h3>
                        <div className="space-y-2">
                            {order.order_items.map((item) => (
                                <div key={item.id} className="flex justify-between text-sm">
                                    <span className="text-gray-700">
                                        {item.quantity}× {item.menu_item.name}
                                    </span>
                                    <span className="font-medium">
                                        ${(item.unit_price * item.quantity).toFixed(2)}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className="border-t border-gray-100 mt-3 pt-3 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Subtotal</span>
                                <span>${subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Tax ({(order.restaurant.tax_rate * 100).toFixed(1)}%)</span>
                                <span>${taxAmount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between font-bold text-brand-blue pt-2 border-t border-gray-100">
                                <span>Total</span>
                                <span>${total.toFixed(2)}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Track Order Button */}
                <Button
                    onClick={() => setShowTracker(true)}
                    className="w-full bg-brand-orange hover:bg-brand-orange/90"
                    size="lg"
                >
                    Track Order
                    <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
            </div>
        </div>
    )
}

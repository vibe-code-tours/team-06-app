'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    CheckCircle2,
    MapPin,
    UtensilsCrossed,
    ThumbsUp,
    MessageSquare,
    Loader2,
    Star,
} from 'lucide-react'
import Link from 'next/link'

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

export default function PaymentSuccessPage() {
    const params = useParams()
    const orderId = params.orderId as string

    const [order, setOrder] = useState<OrderData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Rating state
    const [overallRating, setOverallRating] = useState<number | null>(null)
    const [foodQuality, setFoodQuality] = useState<number | null>(null)
    const [serviceRating, setServiceRating] = useState<number | null>(null)
    const [feedback, setFeedback] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [rated, setRated] = useState(false)
    const [ratingError, setRatingError] = useState<string | null>(null)

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

    const handleRateSubmit = async () => {
        if (!overallRating) {
            setRatingError('Please select an overall rating')
            return
        }

        setSubmitting(true)
        setRatingError(null)

        try {
            const res = await fetch(`/api/orders/${orderId}/rate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    order_id: orderId,
                    overall_rating: overallRating,
                    food_quality_rating: foodQuality || undefined,
                    service_rating: serviceRating || undefined,
                    feedback_text: feedback.trim() || undefined,
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                setRatingError(data.error?.message || 'Failed to submit rating')
                return
            }

            setRated(true)
        } catch {
            setRatingError('Something went wrong. Please try again.')
        } finally {
            setSubmitting(false)
        }
    }

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

    const subtotal = order.order_items.reduce(
        (sum, item) => sum + item.unit_price * item.quantity,
        0
    )
    const taxAmount = subtotal * order.restaurant.tax_rate
    const total = subtotal + taxAmount

    const tableName = order.table.name || `Table ${order.table.table_number}`

    return (
        <div className="min-h-screen bg-gradient-to-b from-brand-blue/5 via-white to-white p-4">
            <div className="max-w-lg mx-auto py-8 space-y-5 animate-slide-up">
                {/* Success Header */}
                <div className="text-center">
                    <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-emerald-100 mb-4 shadow-md">
                        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-brand-blue">Payment Successful!</h1>
                    <p className="text-gray-500 mt-1">
                        Thank you for your payment
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
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                                PAID
                            </Badge>
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
                                <span>Total Paid</span>
                                <span>${total.toFixed(2)}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Rating Section */}
                {!rated ? (
                    <Card className="border-brand-orange/30">
                        <CardContent className="py-4">
                            <div className="flex items-center gap-2 mb-4">
                                <ThumbsUp className="h-5 w-5 text-brand-orange" />
                                <h3 className="font-semibold text-brand-blue">Rate Your Experience</h3>
                            </div>

                            <div className="space-y-4">
                                {/* Overall Rating */}
                                <div>
                                    <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5 mb-2">
                                        <Star className="h-4 w-4 text-brand-orange" />
                                        Overall Experience *
                                    </label>
                                    <div className="flex gap-1">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <button
                                                key={star}
                                                type="button"
                                                onClick={() => setOverallRating(star)}
                                                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange rounded"
                                            >
                                                <Star
                                                    className={`h-7 w-7 transition-colors ${
                                                        star <= (overallRating ?? 0)
                                                            ? 'fill-brand-orange text-brand-orange'
                                                            : 'fill-gray-200 text-gray-300'
                                                    }`}
                                                />
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Food Quality */}
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                                        Food Quality
                                    </label>
                                    <div className="flex gap-1">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <button
                                                key={star}
                                                type="button"
                                                onClick={() => setFoodQuality(star)}
                                                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange rounded"
                                            >
                                                <Star
                                                    className={`h-5 w-5 transition-colors ${
                                                        star <= (foodQuality ?? 0)
                                                            ? 'fill-brand-orange text-brand-orange'
                                                            : 'fill-gray-200 text-gray-300'
                                                    }`}
                                                />
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Service Rating */}
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                                        Service
                                    </label>
                                    <div className="flex gap-1">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <button
                                                key={star}
                                                type="button"
                                                onClick={() => setServiceRating(star)}
                                                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange rounded"
                                            >
                                                <Star
                                                    className={`h-5 w-5 transition-colors ${
                                                        star <= (serviceRating ?? 0)
                                                            ? 'fill-brand-orange text-brand-orange'
                                                            : 'fill-gray-200 text-gray-300'
                                                    }`}
                                                />
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Feedback */}
                                <div>
                                    <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5 mb-1.5">
                                        <MessageSquare className="h-4 w-4" />
                                        Additional Feedback
                                    </label>
                                    <textarea
                                        value={feedback}
                                        onChange={(e) => setFeedback(e.target.value)}
                                        placeholder="Tell us more about your experience..."
                                        rows={3}
                                        maxLength={500}
                                        className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange resize-none"
                                    />
                                    <p className="text-xs text-gray-400 mt-1 text-right">
                                        {feedback.length}/500
                                    </p>
                                </div>

                                {ratingError && (
                                    <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2" role="alert">
                                        {ratingError}
                                    </p>
                                )}
                            </div>

                            <div className="flex gap-3 pt-4">
                                <Button
                                    variant="outline"
                                    onClick={() => setRated(true)}
                                    className="flex-1"
                                >
                                    Skip
                                </Button>
                                <Button
                                    onClick={handleRateSubmit}
                                    disabled={submitting || !overallRating}
                                    className="flex-1 bg-brand-orange hover:bg-brand-orange/90"
                                >
                                    {submitting ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : null}
                                    Submit Rating
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <Card className="border-emerald-200 bg-emerald-50">
                        <CardContent className="py-6 text-center">
                            <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-emerald-100 mb-3">
                                <ThumbsUp className="h-6 w-6 text-emerald-600" />
                            </div>
                            <h3 className="font-semibold text-emerald-800">Thank you for your feedback!</h3>
                            <p className="text-sm text-emerald-600 mt-1">
                                Your feedback helps us improve our service.
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* Back to Menu Button */}
                <Link href={`/${order.restaurant_id}/${order.table.table_number}`} className="block">
                    <Button
                        className="w-full bg-brand-blue hover:bg-brand-blue/90"
                        size="lg"
                    >
                        Back to Menu
                    </Button>
                </Link>
            </div>
        </div>
    )
}

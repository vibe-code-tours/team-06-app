'use client'

import { useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import StarRating from '@/components/StarRating'
import { ThumbsUp, MessageSquare, Loader2 } from 'lucide-react'

interface RatingModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    orderId: string
    onRated?: () => void
}

export default function RatingModal({
    open,
    onOpenChange,
    orderId,
    onRated,
}: RatingModalProps) {
    const [overallRating, setOverallRating] = useState<number | null>(null)
    const [foodQuality, setFoodQuality] = useState<number | null>(null)
    const [serviceRating, setServiceRating] = useState<number | null>(null)
    const [feedback, setFeedback] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async () => {
        if (!overallRating) {
            setError('Please select an overall rating')
            return
        }

        setSubmitting(true)
        setError(null)

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
                setError(data.error?.message || 'Failed to submit rating')
                return
            }

            setSubmitted(true)
            onRated?.()
        } catch {
            setError('Something went wrong. Please try again.')
        } finally {
            setSubmitting(false)
        }
    }

    const handleClose = () => {
        onOpenChange(false)
        // Reset after close animation
        setTimeout(() => {
            setOverallRating(null)
            setFoodQuality(null)
            setServiceRating(null)
            setFeedback('')
            setSubmitted(false)
            setError(null)
        }, 200)
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                {submitted ? (
                    <div className="py-6 text-center space-y-3">
                        <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-emerald-100 mx-auto">
                            <ThumbsUp className="h-7 w-7 text-emerald-600" />
                        </div>
                        <DialogTitle className="text-lg">Thank you!</DialogTitle>
                        <DialogDescription>
                            Your feedback helps us improve our service.
                        </DialogDescription>
                        <Button
                            onClick={handleClose}
                            className="mt-2 bg-brand-orange hover:bg-brand-orange/90"
                        >
                            Done
                        </Button>
                    </div>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <ThumbsUp className="h-5 w-5 text-brand-orange" />
                                Rate Your Order
                            </DialogTitle>
                            <DialogDescription>
                                How was your experience? Your feedback helps us improve.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-5 py-2">
                            <StarRating
                                value={overallRating}
                                onChange={setOverallRating}
                                size="lg"
                                label="Overall Experience *"
                            />

                            <StarRating
                                value={foodQuality}
                                onChange={setFoodQuality}
                                size="md"
                                label="Food Quality"
                            />

                            <StarRating
                                value={serviceRating}
                                onChange={setServiceRating}
                                size="md"
                                label="Service"
                            />

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

                            {error && (
                                <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2" role="alert">
                                    {error}
                                </p>
                            )}
                        </div>

                        <div className="flex gap-3 pt-2">
                            <Button
                                variant="outline"
                                onClick={handleClose}
                                className="flex-1"
                            >
                                Skip
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={submitting || !overallRating}
                                className="flex-1 bg-brand-orange hover:bg-brand-orange/90"
                            >
                                {submitting ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : null}
                                Submit
                            </Button>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}

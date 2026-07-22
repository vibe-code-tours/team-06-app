'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StarRatingProps {
    value: number | null
    onChange?: (value: number) => void
    readonly?: boolean
    size?: 'sm' | 'md' | 'lg'
    label?: string
}

const SIZE_MAP = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-7 w-7',
}

export default function StarRating({
    value,
    onChange,
    readonly = false,
    size = 'md',
    label,
}: StarRatingProps) {
    const [hoverValue, setHoverValue] = useState<number | null>(null)

    const displayValue = hoverValue ?? value ?? 0
    const starSize = SIZE_MAP[size]

    return (
        <div className="flex flex-col gap-1">
            {label && (
                <span className="text-sm font-medium text-gray-700">{label}</span>
            )}
            <div
                className="flex gap-1"
                role={readonly ? 'img' : 'radiogroup'}
                aria-label={label || 'Rating'}
            >
                {[1, 2, 3, 4, 5].map((star) => {
                    const isFilled = star <= displayValue
                    return (
                        <button
                            key={star}
                            type="button"
                            disabled={readonly}
                            className={cn(
                                'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange rounded',
                                readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'
                            )}
                            onClick={() => !readonly && onChange?.(star)}
                            onMouseEnter={() => !readonly && setHoverValue(star)}
                            onMouseLeave={() => !readonly && setHoverValue(null)}
                            aria-label={`${star} star${star !== 1 ? 's' : ''}`}
                            role={readonly ? undefined : 'radio'}
                            aria-checked={readonly ? undefined : star === value}
                        >
                            <Star
                                className={cn(
                                    starSize,
                                    'transition-colors',
                                    isFilled
                                        ? 'fill-brand-orange text-brand-orange'
                                        : 'fill-gray-200 text-gray-300'
                                )}
                            />
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

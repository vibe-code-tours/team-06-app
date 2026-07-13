'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Restaurant } from '@restaurant-qr/shared'

interface RestaurantFormDialogProps {
    mode: 'create' | 'edit'
    restaurant?: Restaurant
    onSaved: () => void
    onClose: () => void
}

export default function RestaurantFormDialog({
    mode,
    restaurant,
    onSaved,
    onClose,
}: RestaurantFormDialogProps) {
    const [name, setName] = useState(restaurant?.name ?? '')
    const [isActive, setIsActive] = useState(restaurant?.is_active ?? true)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)

    const save = async () => {
        setSaving(true)

        if (mode === 'edit' && !restaurant) {
            setErrorMessage('No restaurant selected')
            setSaving(false)
            return
        }

        const url =
            mode === 'create'
                ? '/api/restaurants'
                : `/api/restaurants/${restaurant!.id}`

        const method = mode === 'create' ? 'POST' : 'PUT'

        const body =
            mode === 'create'
                ? { name, description: '', tax_rate: 0 }
                : { name, is_active: isActive }

        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })

        if (!response.ok) {
            try {
                const { error } = await response.json()
                setErrorMessage(error?.message ?? 'Failed to save restaurant')
            } catch {
                setErrorMessage('Failed to save restaurant')
            }
            setSaving(false)
            return
        }

        setSaving(false)
        onSaved()
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>
                        {mode === 'create' ? 'Add Restaurant' : 'Edit Restaurant'}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {errorMessage && (
                        <div
                            className="p-3 text-sm text-red-600 bg-red-50 rounded-md"
                            role="alert"
                        >
                            {errorMessage}
                        </div>
                    )}
                    <div>
                        <label htmlFor="restaurant-name" className="text-sm font-medium">
                            Name
                        </label>
                        <Input
                            id="restaurant-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                    {mode === 'edit' && (
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="is_active"
                                checked={isActive}
                                onChange={(e) => setIsActive(e.target.checked)}
                                className="min-h-[20px] min-w-[20px]"
                            />
                            <label
                                htmlFor="is_active"
                                className="text-sm font-medium"
                            >
                                Active
                            </label>
                        </div>
                    )}
                    <div className="flex gap-2 justify-end pt-2">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            disabled={saving}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={save}
                            disabled={saving || !name}
                        >
                            {saving ? 'Saving...' : 'Save'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

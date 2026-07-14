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
    const [description, setDescription] = useState(restaurant?.description ?? '')
    const [phone, setPhone] = useState(restaurant?.phone ?? '')
    const [email, setEmail] = useState(restaurant?.email ?? '')
    const [address, setAddress] = useState(restaurant?.address ?? '')
    const [taxRate, setTaxRate] = useState(restaurant?.tax_rate?.toString() ?? '0')
    const [logoFile, setLogoFile] = useState<File | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)

    const uploadLogo = async (file: File, restaurantId: string): Promise<string | null> => {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('bucket', 'restaurant-logos')
        formData.append('restaurantId', restaurantId)

        const response = await fetch('/api/uploads', { method: 'POST', body: formData })
        if (!response.ok) return null

        const { publicUrl } = await response.json()
        return publicUrl
    }

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
                ? { name, description, phone, email, address, tax_rate: Number(taxRate) }
                : { name, description, phone, email, address, tax_rate: Number(taxRate) }

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

        // Upload logo if selected (edit mode only)
        if (mode === 'edit' && logoFile && restaurant) {
            const logoUrl = await uploadLogo(logoFile, restaurant.id)
            if (logoUrl) {
                await fetch(`/api/restaurants/${restaurant.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ logo_url: logoUrl }),
                })
            }
        }

        setSaving(false)
        onSaved()
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
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
                            Name *
                        </label>
                        <Input
                            id="restaurant-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                    <div>
                        <label htmlFor="restaurant-description" className="text-sm font-medium">
                            Description
                        </label>
                        <Input
                            id="restaurant-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>
                    <div>
                        <label htmlFor="restaurant-phone" className="text-sm font-medium">
                            Phone
                        </label>
                        <Input
                            id="restaurant-phone"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                        />
                    </div>
                    <div>
                        <label htmlFor="restaurant-email" className="text-sm font-medium">
                            Email
                        </label>
                        <Input
                            id="restaurant-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <label htmlFor="restaurant-address" className="text-sm font-medium">
                            Address
                        </label>
                        <Input
                            id="restaurant-address"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                        />
                    </div>
                    <div>
                        <label htmlFor="restaurant-tax-rate" className="text-sm font-medium">
                            Tax Rate (0-1)
                        </label>
                        <Input
                            id="restaurant-tax-rate"
                            type="number"
                            step="0.01"
                            min="0"
                            max="1"
                            value={taxRate}
                            onChange={(e) => setTaxRate(e.target.value)}
                        />
                    </div>
                    {mode === 'edit' && (
                        <div>
                            <label htmlFor="restaurant-logo" className="text-sm font-medium">
                                Logo
                            </label>
                            <Input
                                id="restaurant-logo"
                                type="file"
                                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                            />
                            {restaurant?.logo_url && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    Current logo uploaded
                                </p>
                            )}
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

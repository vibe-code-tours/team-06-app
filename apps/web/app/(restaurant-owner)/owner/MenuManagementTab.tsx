'use client'

import { useEffect, useState } from 'react'
import type { Category, MenuItem } from '@restaurant-qr/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2, ArrowUp, ArrowDown } from 'lucide-react'

interface Props {
    restaurantId: string
}

export default function MenuManagementTab({ restaurantId }: Props) {
    const [categories, setCategories] = useState<Category[]>([])
    const [items, setItems] = useState<MenuItem[]>([])
    const [newCategoryName, setNewCategoryName] = useState('')
    const [newItemName, setNewItemName] = useState('')
    const [newItemPrice, setNewItemPrice] = useState('')
    const [newItemCategoryId, setNewItemCategoryId] = useState('')
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    const fetchMenu = async () => {
        const [catRes, itemRes] = await Promise.all([
            fetch(`/api/categories?restaurant_id=${restaurantId}`),
            fetch(`/api/menu-items?restaurant_id=${restaurantId}`),
        ])

        if (catRes.ok) {
            const { data } = await catRes.json()
            setCategories(data ?? [])
        }

        if (itemRes.ok) {
            const { data } = await itemRes.json()
            setItems(data ?? [])
        }
    }

    useEffect(() => {
        fetchMenu()
    }, [restaurantId])

    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) return

        const res = await fetch('/api/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                restaurant_id: restaurantId,
                name: newCategoryName.trim(),
                sort_order: categories.length,
            }),
        })

        if (!res.ok) {
            setErrorMessage('Failed to add category')
            return
        }

        setNewCategoryName('')
        setErrorMessage(null)
        fetchMenu()
    }

    const handleDeleteCategory = async (categoryId: string) => {
        const res = await fetch(`/api/categories/${categoryId}`, {
            method: 'DELETE',
        })

        if (!res.ok) {
            setErrorMessage('Failed to delete category')
            return
        }

        setErrorMessage(null)
        fetchMenu()
    }

    const handleReorder = async (index: number, direction: 'up' | 'down') => {
        const targetIndex = direction === 'up' ? index - 1 : index + 1
        if (targetIndex < 0 || targetIndex >= categories.length) return

        const cat = categories[index]
        const target = categories[targetIndex]

        await Promise.all([
            fetch(`/api/categories/${cat.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sort_order: target.sort_order }),
            }),
            fetch(`/api/categories/${target.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sort_order: cat.sort_order }),
            }),
        ])

        fetchMenu()
    }

    const handleAddItem = async () => {
        if (!newItemName.trim() || !newItemPrice || !newItemCategoryId) return

        const res = await fetch('/api/menu-items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                restaurant_id: restaurantId,
                name: newItemName.trim(),
                price: parseFloat(newItemPrice),
                category_id: newItemCategoryId,
                sort_order: items.length,
            }),
        })

        if (!res.ok) {
            setErrorMessage('Failed to add menu item')
            return
        }

        setNewItemName('')
        setNewItemPrice('')
        setNewItemCategoryId('')
        setErrorMessage(null)
        fetchMenu()
    }

    const handleToggleAvailability = async (item: MenuItem) => {
        const res = await fetch(`/api/menu-items/${item.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_available: !item.is_available }),
        })

        if (!res.ok) {
            setErrorMessage('Failed to update item')
            return
        }

        setErrorMessage(null)
        fetchMenu()
    }

    return (
        <Card>
            <CardContent className="pt-6">
                {errorMessage && (
                    <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
                        {errorMessage}
                    </div>
                )}

                {/* Category Section */}
                <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-3">Categories</h3>
                    <div className="flex gap-2 mb-3">
                        <Input
                            placeholder="New category name"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                        />
                        <Button onClick={handleAddCategory}>Add Category</Button>
                    </div>
                    <div className="space-y-2">
                        {categories.map((cat, index) => (
                            <div
                                key={cat.id}
                                className="flex items-center justify-between p-2 border rounded"
                            >
                                <span>{cat.name}</span>
                                <div className="flex gap-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleReorder(index, 'up')}
                                        disabled={index === 0}
                                    >
                                        <ArrowUp className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleReorder(index, 'down')}
                                        disabled={index === categories.length - 1}
                                    >
                                        <ArrowDown className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteCategory(cat.id)}
                                    >
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Menu Items Section */}
                <div>
                    <h3 className="text-lg font-semibold mb-3">Menu Items</h3>
                    <div className="flex gap-2 mb-3 flex-wrap">
                        <Input
                            placeholder="Item name"
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                            className="flex-1 min-w-[150px]"
                        />
                        <Input
                            type="number"
                            placeholder="Price"
                            value={newItemPrice}
                            onChange={(e) => setNewItemPrice(e.target.value)}
                            className="w-24"
                        />
                        <select
                            value={newItemCategoryId}
                            onChange={(e) => setNewItemCategoryId(e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                            <option value="">Select category</option>
                            {categories.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                    {cat.name}
                                </option>
                            ))}
                        </select>
                        <Button onClick={handleAddItem}>Add Item</Button>
                    </div>
                    <div className="space-y-2">
                        {items.map((item) => (
                            <div
                                key={item.id}
                                className="flex items-center justify-between p-2 border rounded"
                            >
                                <div>
                                    <span className="font-medium">{item.name}</span>
                                    <span className="ml-2 text-gray-500">
                                        ${item.price.toFixed(2)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span
                                        className={`text-xs px-2 py-1 rounded ${
                                            item.is_available
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-red-100 text-red-700'
                                        }`}
                                    >
                                        {item.is_available ? 'Available' : 'Unavailable'}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleToggleAvailability(item)}
                                    >
                                        Toggle
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

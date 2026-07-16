'use client'

import { useEffect, useState } from 'react'
import type { Category, MenuItem } from '@restaurant-qr/shared'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2, Loader2, X } from 'lucide-react'
import Image from 'next/image'

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
    const [categoryError, setCategoryError] = useState<string | null>(null)
    const [categorySuccess, setCategorySuccess] = useState<string | null>(null)
    const [itemError, setItemError] = useState<string | null>(null)
    const [itemSuccess, setItemSuccess] = useState<string | null>(null)
    const [uploadingItemId, setUploadingItemId] = useState<string | null>(null)
    const [addingCategory, setAddingCategory] = useState(false)
    const [addingItem, setAddingItem] = useState(false)
    const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null)
    const [deletingItemId, setDeletingItemId] = useState<string | null>(null)
    const [deleteModalOpen, setDeleteModalOpen] = useState(false)
    const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null)

    const fetchMenu = async () => {
        const [catRes, itemRes] = await Promise.all([
            fetch(`/api/categories?restaurant_id=${restaurantId}`),
            fetch(`/api/menu-items?restaurant_id=${restaurantId}`),
        ])

        if (catRes.ok) {
            const { data } = await catRes.json()
            // Ensure categories have proper sort_order based on their position
            const categoriesWithOrder = (data ?? []).map((cat: Category, index: number) => ({
                ...cat,
                sort_order: cat.sort_order ?? index
            }))
            setCategories(categoriesWithOrder)
        }

        if (itemRes.ok) {
            const { data } = await itemRes.json()
            setItems(data ?? [])
        }
    }

    useEffect(() => {
        fetchMenu()
    }, [restaurantId])

    const parseError = async (res: Response): Promise<string> => {
        try {
            const body = await res.json()
            return body?.error?.message || body?.message || `Request failed (${res.status})`
        } catch {
            return `Request failed (${res.status})`
        }
    }

    const showCategoryError = (message: string) => {
        setCategoryError(message)
        setTimeout(() => setCategoryError(null), 5000)
    }

    const showCategorySuccess = (message: string) => {
        setCategorySuccess(message)
        setTimeout(() => setCategorySuccess(null), 5000)
    }

    const showItemError = (message: string) => {
        setItemError(message)
        setTimeout(() => setItemError(null), 5000)
    }

    const showItemSuccess = (message: string) => {
        setItemSuccess(message)
        setTimeout(() => setItemSuccess(null), 5000)
    }

    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) {
            showCategoryError('Category name is required')
            return
        }

        if (categories.some(c => c.name.toLowerCase() === newCategoryName.trim().toLowerCase())) {
            showCategoryError('A category with this name already exists')
            return
        }

        if (newCategoryName.trim().length > 50) {
            showCategoryError('Category name must be 50 characters or less')
            return
        }

        setAddingCategory(true)
        setCategoryError(null)

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
            const errorMsg = await parseError(res)
            showCategoryError(errorMsg)
            setAddingCategory(false)
            return
        }

        setNewCategoryName('')
        setCategoryError(null)
        await fetchMenu()
        setAddingCategory(false)
        showCategorySuccess('Category added successfully')
    }

    const openDeleteModal = (category: Category) => {
        setCategoryToDelete(category)
        setDeleteModalOpen(true)
    }

    const handleDeleteCategory = async () => {
        if (!categoryToDelete) return

        setDeletingCategoryId(categoryToDelete.id)
        setCategoryError(null)
        setDeleteModalOpen(false)

        const res = await fetch(`/api/categories/${categoryToDelete.id}`, {
            method: 'DELETE',
        })

        if (!res.ok) {
            const errorMsg = await parseError(res)
            showCategoryError(errorMsg)
            setDeletingCategoryId(null)
            setCategoryToDelete(null)
            return
        }

        setCategoryError(null)
        await fetchMenu()
        setDeletingCategoryId(null)
        setCategoryToDelete(null)
        showCategorySuccess('Category deleted successfully')
    }

    const handleAddItem = async () => {
        if (!newItemName.trim()) {
            showItemError('Item name is required')
            return
        }
        if (newItemName.trim().length > 100) {
            showItemError('Item name must be 100 characters or less')
            return
        }
        if (!newItemPrice || parseFloat(newItemPrice) <= 0) {
            showItemError('Price must be a positive number')
            return
        }
        if (parseFloat(newItemPrice) > 9999.99) {
            showItemError('Price must be $9999.99 or less')
            return
        }
        if (!newItemCategoryId) {
            showItemError('Please select a category')
            return
        }

        setAddingItem(true)
        setItemError(null)

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
            const errorMsg = await parseError(res)
            showItemError(errorMsg)
            setAddingItem(false)
            return
        }

        setNewItemName('')
        setNewItemPrice('')
        setNewItemCategoryId('')
        setItemError(null)
        await fetchMenu()
        setAddingItem(false)
        showItemSuccess('Menu item added successfully')
    }

    const handleToggleAvailability = async (item: MenuItem) => {
        const res = await fetch(`/api/menu-items/${item.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_available: !item.is_available }),
        })

        if (!res.ok) {
            const errorMsg = await parseError(res)
            showItemError(errorMsg)
            return
        }

        setItemError(null)
        fetchMenu()
        showItemSuccess(`Item marked as ${!item.is_available ? 'available' : 'unavailable'}`)
    }

    const handleDeleteItem = async (itemId: string) => {
        setDeletingItemId(itemId)
        setItemError(null)

        const res = await fetch(`/api/menu-items/${itemId}`, {
            method: 'DELETE',
        })

        if (!res.ok) {
            const errorMsg = await parseError(res)
            showItemError(errorMsg)
            setDeletingItemId(null)
            return
        }

        setItemError(null)
        await fetchMenu()
        setDeletingItemId(null)
        showItemSuccess('Menu item deleted successfully')
    }

    const uploadItemImage = async (itemId: string, file: File) => {
        setUploadingItemId(itemId)

        const formData = new FormData()
        formData.append('file', file)
        formData.append('bucket', 'menu-images')
        formData.append('restaurantId', restaurantId)

        const uploadResponse = await fetch('/api/uploads', { method: 'POST', body: formData })
        if (!uploadResponse.ok) {
            const errorMsg = await parseError(uploadResponse)
            showItemError(errorMsg)
            setUploadingItemId(null)
            return
        }

        const { data: uploadData } = await uploadResponse.json()
        const publicUrl = uploadData?.publicUrl

        if (!publicUrl) {
            showItemError('Failed to get image URL')
            setUploadingItemId(null)
            return
        }

        const updateResponse = await fetch(`/api/menu-items/${itemId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_url: publicUrl }),
        })

        if (!updateResponse.ok) {
            const errorMsg = await parseError(updateResponse)
            showItemError(errorMsg)
            setUploadingItemId(null)
            return
        }

        setItemError(null)
        setUploadingItemId(null)
        fetchMenu()
        showItemSuccess('Image uploaded successfully')
    }

    return (
        <Card>
            <CardContent className="pt-4 md:pt-6">
                {/* Delete Confirmation Modal */}
                {deleteModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center">
                        <div className="fixed inset-0 bg-black/50" onClick={() => setDeleteModalOpen(false)} />
                        <div className="relative bg-white rounded-lg shadow-lg p-6 max-w-md w-11/12 mx-4">
                            <button
                                onClick={() => setDeleteModalOpen(false)}
                                className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
                            >
                                <X className="h-4 w-4" />
                            </button>
                            <h3 className="text-lg font-semibold mb-2">Delete Category</h3>
                            <p className="text-gray-600 mb-6">
                                Are you sure you want to delete &ldquo;{categoryToDelete?.name}&rdquo;?
                                This action cannot be undone.
                            </p>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>
                                    Cancel
                                </Button>
                                <Button variant="destructive" onClick={handleDeleteCategory}>
                                    Delete
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Category Section */}
                <div className="mb-4 md:mb-6">
                    <h3 className="text-base md:text-lg font-semibold mb-3">Categories</h3>
                    {categoryError && (
                        <div className="mb-3 p-3 bg-red-50 text-red-700 rounded-md text-sm">
                            {categoryError}
                        </div>
                    )}
                    {categorySuccess && (
                        <div className="mb-3 p-3 bg-green-50 text-green-700 rounded-md text-sm">
                            {categorySuccess}
                        </div>
                    )}
                    <div className="flex flex-col sm:flex-row gap-2 mb-3">
                        <Input
                            placeholder="New category name"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !addingCategory && handleAddCategory()}
                            disabled={addingCategory}
                            maxLength={50}
                            className="flex-1"
                        />
                        <Button onClick={handleAddCategory} disabled={addingCategory || !newCategoryName.trim()}>
                            {addingCategory ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Adding...
                                </>
                            ) : (
                                'Add Category'
                            )}
                        </Button>
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                        {categories.map((cat) => (
                            <div
                                key={cat.id}
                                className="flex items-center justify-between p-2 border rounded hover:bg-gray-50"
                            >
                                <span className="text-sm md:text-base">{cat.name}</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openDeleteModal(cat)}
                                    disabled={deletingCategoryId === cat.id}
                                >
                                    {deletingCategoryId === cat.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                    )}
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Menu Items Section */}
                <div>
                    <h3 className="text-base md:text-lg font-semibold mb-3">Menu Items</h3>
                    {itemError && (
                        <div className="mb-3 p-3 bg-red-50 text-red-700 rounded-md text-sm">
                            {itemError}
                        </div>
                    )}
                    {itemSuccess && (
                        <div className="mb-3 p-3 bg-green-50 text-green-700 rounded-md text-sm">
                            {itemSuccess}
                        </div>
                    )}
                    <div className="flex flex-col gap-2 mb-3">
                        <div className="flex flex-col sm:flex-row gap-2">
                            <Input
                                placeholder="Item name"
                                value={newItemName}
                                onChange={(e) => setNewItemName(e.target.value)}
                                className="flex-1 min-w-[150px]"
                                maxLength={100}
                                disabled={addingItem}
                            />
                            <Input
                                type="number"
                                placeholder="Price"
                                value={newItemPrice}
                                onChange={(e) => setNewItemPrice(e.target.value)}
                                className="w-full sm:w-32"
                                min="0"
                                max="9999.99"
                                step="0.01"
                                disabled={addingItem}
                            />
                        </div>
                        <select
                            value={newItemCategoryId}
                            onChange={(e) => setNewItemCategoryId(e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            disabled={addingItem}
                        >
                            <option value="">Select category</option>
                            {categories.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                    {cat.name}
                                </option>
                            ))}
                        </select>
                        <Button onClick={handleAddItem} disabled={addingItem || !newItemName.trim() || !newItemPrice || !newItemCategoryId}>
                            {addingItem ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Adding...
                                </>
                            ) : (
                                'Add Item'
                            )}
                        </Button>
                    </div>
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                        {items.map((item) => (
                            <div
                                key={item.id}
                                className="p-3 border rounded"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        {item.image_url ? (
                                            <Image
                                                src={item.image_url}
                                                alt={item.name}
                                                width={40}
                                                height={40}
                                                className="rounded object-cover"
                                            />
                                        ) : null}
                                        <div>
                                            <div className="font-medium">{item.name}</div>
                                            <div className="text-sm text-gray-500">${item.price.toFixed(2)}</div>
                                        </div>
                                    </div>
                                    <span
                                        className={`text-xs px-2 py-1 rounded whitespace-nowrap ${
                                            item.is_available
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-red-100 text-red-700'
                                        }`}
                                    >
                                        {item.is_available ? 'Available' : 'Unavailable'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleToggleAvailability(item)}
                                        className="text-xs"
                                    >
                                        Toggle
                                    </Button>
                                    <label className="inline-flex">
                                        <input
                                            type="file"
                                            accept="image/png,image/jpeg,image/webp"
                                            className="hidden"
                                            onChange={(e) => e.target.files?.[0] && uploadItemImage(item.id, e.target.files[0])}
                                            disabled={uploadingItemId === item.id}
                                        />
                                        <span className={`text-xs underline cursor-pointer text-blue-600 ${uploadingItemId === item.id ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                            {uploadingItemId === item.id ? 'Uploading...' : 'Upload image'}
                                        </span>
                                    </label>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteItem(item.id)}
                                        disabled={deletingItemId === item.id}
                                        className="text-xs ml-auto"
                                    >
                                        {deletingItemId === item.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        )}
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

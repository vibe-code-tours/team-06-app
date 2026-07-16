'use client'

import { useEffect, useState } from 'react'
import type { Category, MenuItem } from '@restaurant-qr/shared'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2, Loader2, X, Plus, UtensilsCrossed, Tag, ImagePlus, ChevronDown } from 'lucide-react'
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
        <div className="space-y-6">
            {/* Delete Confirmation Modal */}
            {deleteModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteModalOpen(false)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-md w-11/12 mx-4">
                        <button
                            onClick={() => setDeleteModalOpen(false)}
                            className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                        <div className="flex items-center justify-center h-12 w-12 rounded-full bg-red-100 text-red-600 mx-auto mb-4">
                            <Trash2 className="h-6 w-6" />
                        </div>
                        <h3 className="text-lg font-semibold text-center mb-2">Delete Category</h3>
                        <p className="text-gray-500 text-center mb-6">
                            Are you sure you want to delete &ldquo;{categoryToDelete?.name}&rdquo;?
                            This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <Button variant="outline" onClick={() => setDeleteModalOpen(false)} className="flex-1">
                                Cancel
                            </Button>
                            <Button variant="destructive" onClick={handleDeleteCategory} className="flex-1">
                                Delete
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Categories Section */}
            <Card className="border-gray-200 shadow-sm">
                <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-brand-blue/10 text-brand-blue">
                            <Tag className="h-4 w-4" />
                        </div>
                        <h3 className="text-base font-semibold text-gray-900">Categories</h3>
                        <span className="text-xs text-gray-400 ml-auto">{categories.length} total</span>
                    </div>

                    {categoryError && (
                        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100">
                            {categoryError}
                        </div>
                    )}
                    {categorySuccess && (
                        <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 rounded-xl text-sm border border-emerald-100">
                            {categorySuccess}
                        </div>
                    )}

                    <div className="flex gap-2 mb-4">
                        <Input
                            placeholder="New category name"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !addingCategory && handleAddCategory()}
                            disabled={addingCategory}
                            maxLength={50}
                            className="flex-1 border-gray-200 focus:border-brand-blue focus:ring-brand-blue/20"
                        />
                        <Button
                            onClick={handleAddCategory}
                            disabled={addingCategory || !newCategoryName.trim()}
                            className="bg-brand-blue hover:bg-brand-blue/90 text-white"
                        >
                            {addingCategory ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Plus className="h-4 w-4" />
                            )}
                        </Button>
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {categories.map((cat) => (
                            <div
                                key={cat.id}
                                className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="h-2 w-2 rounded-full bg-brand-orange" />
                                    <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                                </div>
                                <button
                                    onClick={() => openDeleteModal(cat)}
                                    disabled={deletingCategoryId === cat.id}
                                    className="text-gray-400 hover:text-red-500 transition-all p-1 rounded-lg hover:bg-red-50"
                                >
                                    {deletingCategoryId === cat.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Trash2 className="h-4 w-4" />
                                    )}
                                </button>
                            </div>
                        ))}
                        {categories.length === 0 && (
                            <p className="text-sm text-gray-400 text-center py-4">No categories yet</p>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Menu Items Section */}
            <Card className="border-gray-200 shadow-sm">
                <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-brand-orange/10 text-brand-orange">
                            <UtensilsCrossed className="h-4 w-4" />
                        </div>
                        <h3 className="text-base font-semibold text-gray-900">Menu Items</h3>
                        <span className="text-xs text-gray-400 ml-auto">{items.length} total</span>
                    </div>

                    {itemError && (
                        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100">
                            {itemError}
                        </div>
                    )}
                    {itemSuccess && (
                        <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 rounded-xl text-sm border border-emerald-100">
                            {itemSuccess}
                        </div>
                    )}

                    <div className="space-y-3 mb-4">
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Input
                                placeholder="Item name"
                                value={newItemName}
                                onChange={(e) => setNewItemName(e.target.value)}
                                className="flex-1 min-w-[150px] border-gray-200 focus:border-brand-blue focus:ring-brand-blue/20"
                                maxLength={100}
                                disabled={addingItem}
                            />
                            <Input
                                type="number"
                                placeholder="Price"
                                value={newItemPrice}
                                onChange={(e) => setNewItemPrice(e.target.value)}
                                className="w-full sm:w-32 border-gray-200 focus:border-brand-blue focus:ring-brand-blue/20"
                                min="0"
                                max="9999.99"
                                step="0.01"
                                disabled={addingItem}
                            />
                        </div>
                        <div className="flex gap-3">
                            <div className="relative flex-1 group">
                                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-brand-blue transition-colors pointer-events-none" />
                                <select
                                    value={newItemCategoryId}
                                    onChange={(e) => setNewItemCategoryId(e.target.value)}
                                    className={`flex h-11 w-full rounded-xl border bg-white pl-9 pr-10 py-2 text-sm appearance-none cursor-pointer transition-all outline-none ${
                                        newItemCategoryId
                                            ? 'border-brand-blue/30 text-gray-900 font-medium'
                                            : 'border-gray-200 text-gray-500'
                                    } hover:border-gray-300 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10`}
                                    disabled={addingItem}
                                >
                                    <option value="">Select category</option>
                                    {categories.map((cat) => (
                                        <option key={cat.id} value={cat.id}>
                                            {cat.name}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none transition-colors ${
                                    newItemCategoryId ? 'text-brand-blue' : 'text-gray-400'
                                }`} />
                            </div>
                            <Button
                                onClick={handleAddItem}
                                disabled={addingItem || !newItemName.trim() || !newItemPrice || !newItemCategoryId}
                                className="bg-brand-blue hover:bg-brand-blue/90 text-white"
                            >
                                {addingItem ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Plus className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-3 max-h-96 overflow-y-auto">
                        {items.map((item) => (
                            <div
                                key={item.id}
                                className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
                            >
                                {item.image_url ? (
                                    <Image
                                        src={item.image_url}
                                        alt={item.name}
                                        width={40}
                                        height={40}
                                        className="rounded-lg object-cover shrink-0"
                                    />
                                ) : (
                                    <div className="h-10 w-10 rounded-lg bg-gray-200 flex items-center justify-center shrink-0">
                                        <UtensilsCrossed className="h-4 w-4 text-gray-400" />
                                    </div>
                                )}
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <span className="font-medium text-gray-900 truncate">{item.name}</span>
                                    <span className="text-sm font-semibold text-brand-blue shrink-0">${item.price.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={() => handleToggleAvailability(item)}
                                        className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
                                            item.is_available
                                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                                : 'bg-red-100 text-red-700 hover:bg-red-200'
                                        }`}
                                    >
                                        {item.is_available ? 'Available' : 'Unavailable'}
                                    </button>
                                    <label className="inline-flex">
                                        <input
                                            type="file"
                                            accept="image/png,image/jpeg,image/webp"
                                            className="hidden"
                                            onChange={(e) => e.target.files?.[0] && uploadItemImage(item.id, e.target.files[0])}
                                            disabled={uploadingItemId === item.id}
                                        />
                                        <span className={`text-gray-400 hover:text-brand-orange transition-colors p-1.5 rounded-lg hover:bg-brand-orange/5 cursor-pointer ${uploadingItemId === item.id ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                            {uploadingItemId === item.id ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <ImagePlus className="h-4 w-4" />
                                            )}
                                        </span>
                                    </label>
                                    <button
                                        onClick={() => handleDeleteItem(item.id)}
                                        disabled={deletingItemId === item.id}
                                        className="text-gray-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50"
                                    >
                                        {deletingItemId === item.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        ))}
                        {items.length === 0 && (
                            <p className="text-sm text-gray-400 text-center py-4">No menu items yet</p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

'use client'

import { useEffect, useState } from 'react'
import type { Table } from '@restaurant-qr/shared'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2, Loader2, X } from 'lucide-react'

interface Props {
    restaurantId: string
}

export default function TableManagementTab({ restaurantId }: Props) {
    const [tables, setTables] = useState<Table[]>([])
    const [newTableNumber, setNewTableNumber] = useState('')
    const [newTableCapacity, setNewTableCapacity] = useState('4')
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const [addingTable, setAddingTable] = useState(false)
    const [deletingTableId, setDeletingTableId] = useState<string | null>(null)
    const [deleteModalOpen, setDeleteModalOpen] = useState(false)
    const [tableToDelete, setTableToDelete] = useState<Table | null>(null)

    const fetchTables = async () => {
        const res = await fetch(`/api/tables?restaurant_id=${restaurantId}`)
        if (res.ok) {
            const { data } = await res.json()
            setTables(data ?? [])
        }
    }

    useEffect(() => {
        fetchTables()
    }, [restaurantId])

    const parseError = async (res: Response): Promise<string> => {
        try {
            const body = await res.json()
            const message = body?.error?.message || body?.message || `Request failed (${res.status})`

            // Transform raw DB errors to friendly messages
            if (message.includes('unique constraint') || message.includes('duplicate key')) {
                return 'A table with this number already exists'
            }
            if (message.includes('foreign key')) {
                return 'Cannot delete table: it has associated data'
            }

            return message
        } catch {
            return `Request failed (${res.status})`
        }
    }

    const showSuccess = (message: string) => {
        setSuccessMessage(message)
        setTimeout(() => setSuccessMessage(null), 3000)
    }

    const handleAddTable = async () => {
        if (!newTableNumber) {
            setErrorMessage('Table number is required')
            return
        }

        const tableNum = parseInt(newTableNumber)
        if (isNaN(tableNum) || tableNum <= 0) {
            setErrorMessage('Table number must be a positive number')
            return
        }

        setAddingTable(true)
        setErrorMessage(null)

        const res = await fetch('/api/tables', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                restaurant_id: restaurantId,
                table_number: tableNum,
                capacity: parseInt(newTableCapacity) || 4,
            }),
        })

        if (!res.ok) {
            const errorMsg = await parseError(res)
            setErrorMessage(errorMsg)
            setAddingTable(false)
            return
        }

        setNewTableNumber('')
        setNewTableCapacity('4')
        setErrorMessage(null)
        await fetchTables()
        setAddingTable(false)
        showSuccess('Table added successfully')
    }

    const openDeleteModal = (table: Table) => {
        setTableToDelete(table)
        setDeleteModalOpen(true)
    }

    const handleDeleteTable = async () => {
        if (!tableToDelete) return

        setDeletingTableId(tableToDelete.id)
        setErrorMessage(null)
        setDeleteModalOpen(false)

        const res = await fetch(`/api/tables/${tableToDelete.id}`, {
            method: 'DELETE',
        })

        if (!res.ok) {
            const errorMsg = await parseError(res)
            setErrorMessage(errorMsg)
            setDeletingTableId(null)
            setTableToDelete(null)
            return
        }

        setErrorMessage(null)
        await fetchTables()
        setDeletingTableId(null)
        setTableToDelete(null)
        showSuccess('Table deleted successfully')
    }

    return (
        <Card>
            <CardContent className="pt-6">
                {errorMessage && (
                    <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
                        {errorMessage}
                    </div>
                )}

                {successMessage && (
                    <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md text-sm">
                        {successMessage}
                    </div>
                )}

                {/* Delete Confirmation Modal */}
                {deleteModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center">
                        <div className="fixed inset-0 bg-black/50" onClick={() => setDeleteModalOpen(false)} />
                        <div className="relative bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
                            <button
                                onClick={() => setDeleteModalOpen(false)}
                                className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
                            >
                                <X className="h-4 w-4" />
                            </button>
                            <h3 className="text-lg font-semibold mb-2">Delete Table</h3>
                            <p className="text-gray-600 mb-6">
                                Are you sure you want to delete Table #{tableToDelete?.table_number}?
                                This action cannot be undone.
                            </p>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>
                                    Cancel
                                </Button>
                                <Button variant="destructive" onClick={handleDeleteTable}>
                                    Delete
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Add Table Form */}
                <div className="flex flex-col sm:flex-row gap-2 mb-4 md:mb-6">
                    <div className="flex gap-2">
                        <Input
                            type="number"
                            placeholder="Table No."
                            value={newTableNumber}
                            onChange={(e) => setNewTableNumber(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !addingTable && handleAddTable()}
                            className="w-24 sm:w-32"
                            disabled={addingTable}
                        />
                        <div className="flex flex-col">
                            <Input
                                type="number"
                                placeholder="Seats"
                                value={newTableCapacity}
                                onChange={(e) => setNewTableCapacity(e.target.value)}
                                className="w-20 sm:w-24"
                                min="1"
                                disabled={addingTable}
                            />
                            <span className="text-xs text-gray-500 mt-1">Seats</span>
                        </div>
                    </div>
                    <Button onClick={handleAddTable} disabled={addingTable || !newTableNumber} className="w-full sm:w-auto">
                        {addingTable ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Adding...
                            </>
                        ) : (
                            'Add Table'
                        )}
                    </Button>
                </div>

                {/* Table Grid - Mobile: 2 cols, Desktop: 4 cols */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                    {tables.map((table) => (
                        <div
                            key={table.id}
                            className="border rounded-lg p-3 md:p-4 text-center"
                        >
                            <div className="text-xl md:text-2xl font-bold mb-1">
                                {table.table_number}
                            </div>
                            {table.name && (
                                <div className="text-sm text-gray-500 mb-1">
                                    {table.name}
                                </div>
                            )}
                            <div className="text-xs text-gray-400 mb-2">
                                Capacity: {table.capacity}
                            </div>
                            <div
                                className={`text-xs px-2 py-1 rounded mb-2 ${
                                    table.status === 'AVAILABLE'
                                        ? 'bg-green-100 text-green-700'
                                        : table.status === 'OCCUPIED'
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-yellow-100 text-yellow-700'
                                }`}
                            >
                                {table.status}
                            </div>
                            {table.status === 'AVAILABLE' && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openDeleteModal(table)}
                                    disabled={deletingTableId === table.id}
                                    className="w-full"
                                >
                                    {deletingTableId === table.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <>
                                            <Trash2 className="h-4 w-4 text-red-500 mr-1" />
                                            Delete
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}

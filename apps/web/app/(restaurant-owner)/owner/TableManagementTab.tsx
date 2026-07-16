'use client'

import { useEffect, useState } from 'react'
import type { Table } from '@restaurant-qr/shared'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2, Loader2, X, Plus, Armchair } from 'lucide-react'

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

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'AVAILABLE':
                return 'bg-emerald-100 text-emerald-700'
            case 'OCCUPIED':
                return 'bg-red-100 text-red-700'
            case 'WAITING_PAYMENT':
                return 'bg-amber-100 text-amber-700'
            case 'CLEANING':
                return 'bg-blue-100 text-blue-700'
            default:
                return 'bg-gray-100 text-gray-700'
        }
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
                        <h3 className="text-lg font-semibold text-center mb-2">Delete Table</h3>
                        <p className="text-gray-500 text-center mb-6">
                            Are you sure you want to delete Table #{tableToDelete?.table_number}?
                            This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <Button variant="outline" onClick={() => setDeleteModalOpen(false)} className="flex-1">
                                Cancel
                            </Button>
                            <Button variant="destructive" onClick={handleDeleteTable} className="flex-1">
                                Delete
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <Card className="border-gray-200 shadow-sm">
                <CardContent className="pt-6">
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-4">
                        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-brand-blue/10 text-brand-blue">
                            <Armchair className="h-4 w-4" />
                        </div>
                        <h3 className="text-base font-semibold text-gray-900">Tables</h3>
                        <span className="text-xs text-gray-400 ml-auto">{tables.length} total</span>
                    </div>

                    {errorMessage && (
                        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100">
                            {errorMessage}
                        </div>
                    )}

                    {successMessage && (
                        <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 rounded-xl text-sm border border-emerald-100">
                            {successMessage}
                        </div>
                    )}

                    {/* Add Table Form */}
                    <div className="flex flex-col sm:flex-row gap-3 mb-6">
                        <div className="flex gap-3">
                            <Input
                                type="number"
                                placeholder="Table No."
                                value={newTableNumber}
                                onChange={(e) => setNewTableNumber(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !addingTable && handleAddTable()}
                                className="w-24 sm:w-32 border-gray-200 focus:border-brand-blue focus:ring-brand-blue/20"
                                disabled={addingTable}
                            />
                            <Input
                                type="number"
                                placeholder="Seats"
                                value={newTableCapacity}
                                onChange={(e) => setNewTableCapacity(e.target.value)}
                                className="w-20 sm:w-24 border-gray-200 focus:border-brand-blue focus:ring-brand-blue/20"
                                min="1"
                                disabled={addingTable}
                            />
                        </div>
                        <Button
                            onClick={handleAddTable}
                            disabled={addingTable || !newTableNumber}
                            className="bg-brand-blue hover:bg-brand-blue/90 text-white"
                        >
                            {addingTable ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Plus className="h-4 w-4" />
                            )}
                        </Button>
                    </div>

                    {/* Table Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {tables.map((table) => {
                            const statusColor = table.status === 'AVAILABLE'
                                ? 'border-t-emerald-500'
                                : table.status === 'OCCUPIED'
                                ? 'border-t-red-500'
                                : table.status === 'WAITING_PAYMENT'
                                ? 'border-t-amber-500'
                                : 'border-t-blue-500'

                            return (
                                <div
                                    key={table.id}
                                    className={`relative p-4 bg-white rounded-xl border border-gray-200 border-t-4 ${statusColor} hover:shadow-md transition-all group`}
                                >
                                    {table.status === 'AVAILABLE' && (
                                        <button
                                            onClick={() => openDeleteModal(table)}
                                            disabled={deletingTableId === table.id}
                                            className="absolute top-3 right-3 text-gray-400 hover:text-red-500 transition-all p-1 rounded-lg hover:bg-red-50"
                                        >
                                            {deletingTableId === table.id ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <Trash2 className="h-3.5 w-3.5" />
                                            )}
                                        </button>
                                    )}
                                    <div className="text-center pt-1">
                                        <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-gray-100 mx-auto mb-2">
                                            <span className="text-xl font-bold text-gray-900">{table.table_number}</span>
                                        </div>
                                        {table.name && (
                                            <div className="text-xs font-medium text-gray-600 mb-1">
                                                {table.name}
                                            </div>
                                        )}
                                        <div className="flex items-center justify-center gap-1 text-xs text-gray-400 mb-3">
                                            <Armchair className="h-3 w-3" />
                                            {table.capacity} seats
                                        </div>
                                        <span
                                            className={`inline-block text-xs px-3 py-1 rounded-full font-medium ${getStatusStyle(table.status)}`}
                                        >
                                            {table.status.replace('_', ' ')}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                        {tables.length === 0 && (
                            <div className="col-span-full text-center py-8">
                                <Armchair className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                                <p className="text-sm text-gray-400">No tables yet</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

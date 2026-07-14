'use client'

import { useEffect, useState } from 'react'
import type { Table } from '@restaurant-qr/shared'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2 } from 'lucide-react'

interface Props {
    restaurantId: string
}

export default function TableManagementTab({ restaurantId }: Props) {
    const [tables, setTables] = useState<Table[]>([])
    const [newTableNumber, setNewTableNumber] = useState('')
    const [newTableCapacity, setNewTableCapacity] = useState('4')
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

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

    const handleAddTable = async () => {
        if (!newTableNumber) return

        const res = await fetch('/api/tables', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                restaurant_id: restaurantId,
                table_number: parseInt(newTableNumber),
                capacity: parseInt(newTableCapacity) || 4,
            }),
        })

        if (!res.ok) {
            const { error } = await res.json()
            setErrorMessage(error?.message || 'Failed to add table')
            return
        }

        setNewTableNumber('')
        setNewTableCapacity('4')
        setErrorMessage(null)
        fetchTables()
    }

    const handleDeleteTable = async (tableId: string) => {
        const res = await fetch(`/api/tables/${tableId}`, {
            method: 'DELETE',
        })

        if (!res.ok) {
            const { error } = await res.json()
            setErrorMessage(error?.message || 'Failed to delete table')
            return
        }

        setErrorMessage(null)
        fetchTables()
    }

    return (
        <Card>
            <CardContent className="pt-6">
                {errorMessage && (
                    <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
                        {errorMessage}
                    </div>
                )}

                {/* Add Table Form */}
                <div className="flex gap-2 mb-6">
                    <Input
                        type="number"
                        placeholder="Table number"
                        value={newTableNumber}
                        onChange={(e) => setNewTableNumber(e.target.value)}
                        className="w-32"
                    />
                    <Input
                        type="number"
                        placeholder="Capacity"
                        value={newTableCapacity}
                        onChange={(e) => setNewTableCapacity(e.target.value)}
                        className="w-24"
                    />
                    <Button onClick={handleAddTable}>Add Table</Button>
                </div>

                {/* Table Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {tables.map((table) => (
                        <div
                            key={table.id}
                            className="border rounded-lg p-4 text-center"
                        >
                            <div className="text-2xl font-bold mb-1">
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
                                    onClick={() => handleDeleteTable(table.id)}
                                    className="w-full"
                                >
                                    <Trash2 className="h-4 w-4 text-red-500 mr-1" />
                                    Delete
                                </Button>
                            )}
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}

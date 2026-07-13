'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface StaffRow {
    id: string
    full_name: string
    email: string
    role: string
}

interface Props {
    restaurantId: string
}

const ROLES = ['manager', 'kitchen_staff', 'waiter', 'cashier']

export default function StaffManagementTab({ restaurantId }: Props) {
    const [staff, setStaff] = useState<StaffRow[]>([])
    const [inviteEmail, setInviteEmail] = useState('')
    const [inviteRole, setInviteRole] = useState('waiter')
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)

    const fetchStaff = async () => {
        const res = await fetch(`/api/staff?restaurant_id=${restaurantId}`)
        if (res.ok) {
            const { data } = await res.json()
            setStaff(data ?? [])
        }
    }

    useEffect(() => {
        fetchStaff()
    }, [restaurantId])

    const handleInvite = async () => {
        if (!inviteEmail.trim()) return

        setErrorMessage(null)
        setSuccessMessage(null)

        const res = await fetch('/api/staff/invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: inviteEmail.trim(),
                role: inviteRole,
            }),
        })

        if (!res.ok) {
            const { error } = await res.json()
            setErrorMessage(error?.message || 'Failed to invite staff')
            return
        }

        setSuccessMessage(`Invite sent to ${inviteEmail}`)
        setInviteEmail('')
        setInviteRole('waiter')
        fetchStaff()
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

                {/* Invite Form */}
                <div className="flex gap-2 mb-6">
                    <Input
                        type="email"
                        placeholder="Staff email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                        className="flex-1"
                    />
                    <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value)}
                        className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                        {ROLES.map((role) => (
                            <option key={role} value={role}>
                                {role.replace('_', ' ')}
                            </option>
                        ))}
                    </select>
                    <Button onClick={handleInvite}>Invite Staff</Button>
                </div>

                {/* Staff List */}
                <div className="space-y-2">
                    {staff.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">
                            No staff members yet
                        </p>
                    ) : (
                        staff.map((member) => (
                            <div
                                key={member.id}
                                className="flex items-center justify-between p-3 border rounded"
                            >
                                <div>
                                    <div className="font-medium">
                                        {member.full_name || 'Unnamed'}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                        {member.email}
                                    </div>
                                </div>
                                <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                                    {member.role.replace('_', ' ')}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

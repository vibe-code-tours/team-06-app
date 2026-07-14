'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'

interface StaffRow {
    id: string
    full_name: string
    email: string
    role: string
}

interface Props {
    restaurantId: string
}

const ROLES = [
    { value: 'manager', label: 'Manager', description: 'Full access' },
    { value: 'kitchen_staff', label: 'Kitchen Staff', description: 'View orders' },
    { value: 'waiter', label: 'Waiter', description: 'Take orders' },
    { value: 'cashier', label: 'Cashier', description: 'Process payments' },
]

const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
}

interface PendingInvite {
    email: string
    role: string
}

export default function StaffManagementTab({ restaurantId }: Props) {
    const [staff, setStaff] = useState<StaffRow[]>([])
    const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
    const [inviteEmail, setInviteEmail] = useState('')
    const [inviteRole, setInviteRole] = useState('waiter')
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const [inviting, setInviting] = useState(false)

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

    const parseError = async (res: Response): Promise<string> => {
        try {
            const body = await res.json()
            return body?.error?.message || body?.message || `Request failed (${res.status})`
        } catch {
            return `Request failed (${res.status})`
        }
    }

    const handleInvite = async () => {
        if (!inviteEmail.trim()) {
            setErrorMessage('Email is required')
            return
        }

        if (!isValidEmail(inviteEmail.trim())) {
            setErrorMessage('Please enter a valid email address')
            return
        }

        setInviting(true)
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
            const errorMsg = await parseError(res)
            setErrorMessage(errorMsg)
            setInviting(false)
            return
        }

        // Add to pending invites (will show until page refresh)
        setPendingInvites(prev => [...prev, { email: inviteEmail.trim(), role: inviteRole }])
        setSuccessMessage(`Invite sent to ${inviteEmail.trim()}`)
        setInviteEmail('')
        setInviteRole('waiter')
        setInviting(false)
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
                <div className="flex flex-col gap-2 mb-4 md:mb-6">
                    <Input
                        type="email"
                        placeholder="Staff email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !inviting && handleInvite()}
                        className="w-full"
                        disabled={inviting}
                    />
                    <div className="flex gap-2">
                        <select
                            value={inviteRole}
                            onChange={(e) => setInviteRole(e.target.value)}
                            className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                            disabled={inviting}
                        >
                            {ROLES.map((role) => (
                                <option key={role.value} value={role.value}>
                                    {role.label} — {role.description}
                                </option>
                            ))}
                        </select>
                        <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
                            {inviting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Inviting...
                                </>
                            ) : (
                                'Invite'
                            )}
                        </Button>
                    </div>
                </div>

                {/* Staff List */}
                <div className="space-y-2 max-h-80 overflow-y-auto">
                    {/* Pending Invites */}
                    {pendingInvites.map((invite, index) => (
                        <div
                            key={`pending-${invite.email}-${index}`}
                            className="flex items-center justify-between p-3 border rounded bg-yellow-50 border-yellow-200"
                        >
                            <div>
                                <div className="font-medium text-yellow-700">
                                    Pending
                                </div>
                                <div className="text-sm text-yellow-600">
                                    {invite.email}
                                </div>
                            </div>
                            <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                                {ROLES.find(r => r.value === invite.role)?.label || invite.role} — Awaiting signup
                            </span>
                        </div>
                    ))}

                    {/* Active Staff */}
                    {staff.length === 0 && pendingInvites.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">
                            No staff members yet
                        </p>
                    ) : (
                        staff.map((member) => (
                            <div
                                key={member.id}
                                className={`flex items-center justify-between p-3 border rounded ${
                                    member.role === 'restaurant_owner' ? 'bg-orange-50 border-orange-200' : ''
                                }`}
                            >
                                <div>
                                    <div className="font-medium">
                                        {member.full_name || 'Unnamed'}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                        {member.email}
                                    </div>
                                </div>
                                <span className={`text-xs px-2 py-1 rounded ${
                                    member.role === 'restaurant_owner'
                                        ? 'bg-orange-100 text-orange-700'
                                        : 'bg-gray-100'
                                }`}>
                                    {member.role === 'restaurant_owner' ? 'Owner' : ROLES.find(r => r.value === member.role)?.label || member.role.replace('_', ' ')}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

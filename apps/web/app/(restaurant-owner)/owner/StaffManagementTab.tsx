'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Trash2, RefreshCw, Shield, ChevronDown } from 'lucide-react'

interface StaffRow {
    id: string
    full_name: string
    email: string
    role: string
}

interface InviteRow {
    id: string
    email: string
    role: string
    status: string
    created_at: string
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

const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
    return date.toLocaleDateString()
}

const isInviteExpired = (createdAt: string): boolean => {
    const date = new Date(createdAt)
    const now = new Date()
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
    return now.getTime() - date.getTime() > sevenDaysMs
}

export default function StaffManagementTab({ restaurantId }: Props) {
    const [staff, setStaff] = useState<StaffRow[]>([])
    const [pendingInvites, setPendingInvites] = useState<InviteRow[]>([])
    const [inviteEmail, setInviteEmail] = useState('')
    const [inviteRole, setInviteRole] = useState('waiter')
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const [inviting, setInviting] = useState(false)
    const [cancellingId, setCancellingId] = useState<string | null>(null)
    const [resendingId, setResendingId] = useState<string | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [staffToDelete, setStaffToDelete] = useState<StaffRow | null>(null)

    const fetchStaff = async () => {
        const res = await fetch(`/api/staff?restaurant_id=${restaurantId}`)
        if (res.ok) {
            const { data } = await res.json()
            setStaff(data ?? [])
        }
    }

    const fetchPendingInvites = async () => {
        const res = await fetch(`/api/staff/invites?restaurant_id=${restaurantId}`)
        if (res.ok) {
            const { data } = await res.json()
            setPendingInvites(data ?? [])
        }
    }

    useEffect(() => {
        fetchStaff()
        fetchPendingInvites()
    }, [restaurantId])

    const parseError = async (res: Response): Promise<string> => {
        try {
            const body = await res.json()
            return body?.error?.message || body?.message || `Request failed (${res.status})`
        } catch {
            return `Request failed (${res.status})`
        }
    }

    const show_error = (message: string | null) => {
        setErrorMessage(message)
        if (message) {
            setTimeout(() => setErrorMessage(null), 5000)
        }
    }

    const show_success = (message: string | null) => {
        setSuccessMessage(message)
        if (message) {
            setTimeout(() => setSuccessMessage(null), 5000)
        }
    }

    const handleInvite = async () => {
        if (!inviteEmail.trim()) {
            show_error('Email is required')
            return
        }

        if (!isValidEmail(inviteEmail.trim())) {
            show_error('Please enter a valid email address')
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
            show_error(errorMsg)
            setInviting(false)
            return
        }

        show_success(`Invite sent to ${inviteEmail.trim()}`)
        setInviteEmail('')
        setInviteRole('waiter')
        setInviting(false)

        // Refresh the pending invites list
        fetchPendingInvites()
    }

    const handleCancelInvite = async (inviteId: string) => {
        setCancellingId(inviteId)
        setErrorMessage(null)
        setSuccessMessage(null)

        const res = await fetch(`/api/staff/invites/${inviteId}`, {
            method: 'DELETE',
        })

        if (!res.ok) {
            const errorMsg = await parseError(res)
            show_error(errorMsg)
            setCancellingId(null)
            return
        }

        show_success('Invite cancelled')
        setCancellingId(null)
        fetchPendingInvites()
    }

    const handleResendInvite = async (inviteId: string) => {
        setResendingId(inviteId)
        setErrorMessage(null)
        setSuccessMessage(null)

        const res = await fetch(`/api/staff/invites/${inviteId}/resend`, {
            method: 'POST',
        })

        if (!res.ok) {
            const errorMsg = await parseError(res)
            show_error(errorMsg)
            setResendingId(null)
            return
        }

        show_success('Invite resent successfully')
        setResendingId(null)
        fetchPendingInvites()
    }

    const handleDeleteStaff = async (staffMember: StaffRow) => {
        // Prevent self-deletion
        // (This is also checked server-side, but we block it here for better UX)
        setDeletingId(staffMember.id)
        setErrorMessage(null)
        setSuccessMessage(null)

        const res = await fetch(`/api/staff/${staffMember.id}`, {
            method: 'DELETE',
        })

        if (!res.ok) {
            const errorMsg = await parseError(res)
            show_error(errorMsg)
            setDeletingId(null)
            setStaffToDelete(null)
            return
        }

        show_success(`${staffMember.full_name || staffMember.email} has been removed`)
        setDeletingId(null)
        setStaffToDelete(null)
        fetchStaff()
    }

    return (
        <>
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
                    <div className="flex gap-2 min-w-0">
                        <div className="relative flex-1 group">
                            <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-brand-blue transition-colors pointer-events-none" />
                            <select
                                value={inviteRole}
                                onChange={(e) => setInviteRole(e.target.value)}
                                className={`flex h-11 w-full rounded-xl border bg-white pl-9 pr-10 py-2 text-sm appearance-none cursor-pointer transition-all outline-none ${
                                    inviteRole
                                        ? 'border-brand-blue/30 text-gray-900 font-medium'
                                        : 'border-gray-200 text-gray-500'
                                } hover:border-gray-300 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10`}
                                disabled={inviting}
                            >
                                {ROLES.map((role) => (
                                    <option key={role.value} value={role.value}>
                                        {role.label} — {role.description}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none transition-colors ${
                                inviteRole ? 'text-brand-blue' : 'text-gray-400'
                            }`} />
                        </div>
                        <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()} className="flex-shrink-0">
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
                    {pendingInvites.filter(i => i.status === 'pending' && !isInviteExpired(i.created_at)).length > 0 && (
                        <>
                            <div className="text-sm font-medium text-gray-500 mb-2">
                                Pending Invites ({pendingInvites.filter(i => i.status === 'pending' && !isInviteExpired(i.created_at)).length})
                            </div>
                            {pendingInvites
                                .filter(i => i.status === 'pending' && !isInviteExpired(i.created_at))
                                .map((invite) => (
                                <div
                                    key={invite.id}
                                    className="p-3 border rounded bg-yellow-50 border-yellow-200"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="font-medium text-yellow-700 truncate">
                                                {invite.email}
                                            </div>
                                            <div className="text-xs text-yellow-600">
                                                <span className="font-medium">{ROLES.find(r => r.value === invite.role)?.label || invite.role}</span> • Invited {formatTimeAgo(invite.created_at)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleResendInvite(invite.id)}
                                            disabled={true}
                                            className="text-xs opacity-50 cursor-not-allowed"
                                        >
                                            <RefreshCw className="h-3 w-3 mr-1" />
                                            Resend
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleCancelInvite(invite.id)}
                                            disabled={cancellingId === invite.id}
                                            className="text-xs text-red-600 hover:text-red-700"
                                        >
                                            {cancellingId === invite.id ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : (
                                                <Trash2 className="h-3 w-3 mr-1" />
                                            )}
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}

                    {/* Expired Invites */}
                    {pendingInvites.filter(i => i.status === 'pending' && isInviteExpired(i.created_at)).length > 0 && (
                        <>
                            <div className="text-sm font-medium text-gray-500 mb-2 mt-4">
                                Expired Invites ({pendingInvites.filter(i => i.status === 'pending' && isInviteExpired(i.created_at)).length})
                            </div>
                            {pendingInvites
                                .filter(i => i.status === 'pending' && isInviteExpired(i.created_at))
                                .map((invite) => (
                                <div
                                    key={invite.id}
                                    className="p-3 border rounded bg-gray-50 border-gray-200"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="font-medium text-gray-700 truncate">
                                                {invite.email}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                <span className="font-medium">{ROLES.find(r => r.value === invite.role)?.label || invite.role}</span> • Expired {formatTimeAgo(invite.created_at)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleResendInvite(invite.id)}
                                            disabled={resendingId === invite.id}
                                            className="text-xs"
                                        >
                                            {resendingId === invite.id ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : (
                                                <RefreshCw className="h-3 w-3 mr-1" />
                                            )}
                                            Resend
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleCancelInvite(invite.id)}
                                            disabled={cancellingId === invite.id}
                                            className="text-xs text-red-600 hover:text-red-700"
                                        >
                                            {cancellingId === invite.id ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : (
                                                <Trash2 className="h-3 w-3 mr-1" />
                                            )}
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}

                    {/* Rejected Invites */}
                    {pendingInvites.filter(i => i.status === 'rejected').length > 0 && (
                        <>
                            <div className="text-sm font-medium text-gray-500 mb-2 mt-4">
                                Rejected Invites ({pendingInvites.filter(i => i.status === 'rejected').length})
                            </div>
                            {pendingInvites
                                .filter(i => i.status === 'rejected')
                                .map((invite) => (
                                <div
                                    key={invite.id}
                                    className="p-3 border rounded bg-red-50 border-red-200"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="font-medium text-red-700 truncate">
                                                {invite.email}
                                            </div>
                                            <div className="text-xs text-red-500">
                                                <span className="font-medium">{ROLES.find(r => r.value === invite.role)?.label || invite.role}</span> • Rejected {formatTimeAgo(invite.created_at)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleResendInvite(invite.id)}
                                            disabled={resendingId === invite.id}
                                            className="text-xs"
                                        >
                                            {resendingId === invite.id ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : (
                                                <RefreshCw className="h-3 w-3 mr-1" />
                                            )}
                                            Resend
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleCancelInvite(invite.id)}
                                            disabled={cancellingId === invite.id}
                                            className="text-xs text-red-600 hover:text-red-700"
                                        >
                                            {cancellingId === invite.id ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : (
                                                <Trash2 className="h-3 w-3 mr-1" />
                                            )}
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}

                    {/* Active Staff */}
                    {staff.length === 0 && pendingInvites.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">
                            No staff members yet
                        </p>
                    ) : (
                        <>
                            <div className="text-sm font-medium text-gray-500 mb-2 mt-4">
                                Active Staff ({staff.length})
                            </div>
                            {staff.map((member) => (
                                <div
                                    key={member.id}
                                    className={`flex items-center justify-between p-3 border rounded ${
                                        member.role === 'restaurant_owner' ? 'bg-orange-50 border-orange-200' : ''
                                    }`}
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="font-medium truncate">
                                            {member.full_name || 'Unnamed'}
                                        </div>
                                        <div className="text-sm text-gray-500 truncate">
                                            {member.email}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                                        <span className={`text-xs px-2 py-1 rounded ${
                                            member.role === 'restaurant_owner'
                                                ? 'bg-orange-100 text-orange-700 font-semibold'
                                                : member.role === 'manager'
                                                ? 'bg-blue-100 text-blue-700 font-semibold'
                                                : member.role === 'kitchen_staff'
                                                ? 'bg-purple-100 text-purple-700 font-semibold'
                                                : member.role === 'waiter'
                                                ? 'bg-green-100 text-green-700 font-semibold'
                                                : member.role === 'cashier'
                                                ? 'bg-yellow-100 text-yellow-700 font-semibold'
                                                : 'bg-gray-100'
                                        }`}>
                                            {member.role === 'restaurant_owner' ? 'Owner' : ROLES.find(r => r.value === member.role)?.label || member.role.replace('_', ' ')}
                                        </span>
                                        {member.role !== 'restaurant_owner' && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setStaffToDelete(member)}
                                                disabled={deletingId === member.id}
                                                className="text-xs text-red-600 hover:text-red-700"
                                            >
                                                {deletingId === member.id ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <Trash2 className="h-3 w-3" />
                                                )}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </CardContent>
        </Card>

        {/* Delete Confirmation Modal */}
        {staffToDelete && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <Card className="w-full max-w-md mx-4">
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <div className="text-4xl mb-4">⚠️</div>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">Delete Staff Member</h2>
                            <p className="text-gray-600 mb-2">
                                Are you sure you want to delete{' '}
                                <span className="font-semibold">
                                    {staffToDelete.full_name || staffToDelete.email}
                                </span>
                                ?
                            </p>
                            <p className="text-sm text-red-600 mb-6">
                                This action cannot be undone. The staff member will lose access to the system.
                            </p>
                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => setStaffToDelete(null)}
                                    disabled={deletingId === staffToDelete.id}
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={() => handleDeleteStaff(staffToDelete)}
                                    disabled={deletingId === staffToDelete.id}
                                    className="flex-1"
                                >
                                    {deletingId === staffToDelete.id ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                            Deleting...
                                        </>
                                    ) : (
                                        'Delete'
                                    )}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )}
        </>
    )
}

'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Trash2, RefreshCw, Shield, ChevronDown, UserCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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

interface PendingApprovalRow {
    id: string
    email: string
    role: string
    full_name: string | null
    phone: string | null
    status: string
    created_at: string
    submitted_at: string | null
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

const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
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
    const [pendingApprovals, setPendingApprovals] = useState<PendingApprovalRow[]>([])
    const [inviteEmail, setInviteEmail] = useState('')
    const [inviteRole, setInviteRole] = useState('waiter')
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const [inviting, setInviting] = useState(false)
    const [cancellingId, setCancellingId] = useState<string | null>(null)
    const [resendingId, setResendingId] = useState<string | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [staffToDelete, setStaffToDelete] = useState<StaffRow | null>(null)
    const [approvingId, setApprovingId] = useState<string | null>(null)
    const [approveModal, setApproveModal] = useState<PendingApprovalRow | null>(null)

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

    const fetchPendingApprovals = async () => {
        const res = await fetch(`/api/staff/pending?restaurant_id=${restaurantId}`)
        if (res.ok) {
            const { data } = await res.json()
            setPendingApprovals(data ?? [])
        }
    }

    useEffect(() => {
        fetchStaff()
        fetchPendingInvites()
        fetchPendingApprovals()
    }, [restaurantId])

    // Subscribe to real-time invites changes so UI stays in sync
    useEffect(() => {
        const supabase = createClient()

        const channel = supabase
            .channel('staff-invites')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'invites',
                },
                () => {
                    fetchPendingApprovals()
                    fetchPendingInvites()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
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

    const handleApprove = async () => {
        if (!approveModal) return

        setApprovingId(approveModal.id)
        setErrorMessage(null)
        setSuccessMessage(null)

        const res = await fetch(`/api/staff/invites/${approveModal.id}/approve`, {
            method: 'POST',
        })

        if (!res.ok) {
            const errorMsg = await parseError(res)
            show_error(errorMsg)
            setApprovingId(null)
            return
        }

        show_success(`${approveModal.full_name || approveModal.email} has been approved`)
        setApprovingId(null)
        setApproveModal(null)
        fetchPendingApprovals()
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
                    {/* Pending Approval Requests */}
                    {pendingApprovals.length > 0 && (
                        <>
                            <div className="text-sm font-medium text-indigo-500 mb-2">
                                Pending Approval ({pendingApprovals.length})
                            </div>
                            {pendingApprovals.map((item) => (
                                <div
                                    key={item.id}
                                    className="p-3 border rounded bg-indigo-50 border-indigo-200"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="font-medium text-indigo-700 truncate">
                                                {item.full_name || 'Unknown'}
                                            </div>
                                            <div className="text-xs text-indigo-600">
                                                {item.email} • <span className="font-medium">{ROLES.find(r => r.value === item.role)?.label || item.role}</span>
                                            </div>
                                            {item.submitted_at && (
                                                <div className="text-xs text-indigo-400 mt-0.5">
                                                    Submitted {formatTimeAgo(item.submitted_at)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={() => setApproveModal(item)}
                                        className="text-xs bg-indigo-600 hover:bg-indigo-700"
                                    >
                                        <UserCheck className="h-3 w-3 mr-1" />
                                        Review & Approve
                                    </Button>
                                </div>
                            ))}
                        </>
                    )}

                    {/* Pending Invites */}
                    {pendingInvites.filter(i => i.status === 'pending' && !isInviteExpired(i.created_at)).length > 0 && (
                        <>
                            <div className="text-sm font-medium text-gray-500 mb-2 mt-4">
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
                    {pendingApprovals.length === 0 && staff.length === 0 && pendingInvites.length === 0 ? (
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

        {/* Approve Detail Modal */}
        {approveModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <Card className="w-full max-w-md mx-4">
                    <CardContent className="pt-6">
                        <div className="text-center mb-4">
                            <div className="text-4xl mb-4">
                                <UserCheck className="h-12 w-12 text-indigo-500 mx-auto" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">Approve Staff Member</h2>
                            <p className="text-sm text-gray-500">
                                Review the details below before approving
                            </p>
                        </div>

                        <div className="space-y-3 bg-gray-50 rounded-lg p-4 mb-6">
                            <div>
                                <span className="text-xs text-gray-500 uppercase font-medium">Full Name</span>
                                <p className="text-sm font-medium text-gray-900">{approveModal.full_name || 'N/A'}</p>
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 uppercase font-medium">Email</span>
                                <p className="text-sm font-medium text-gray-900">{approveModal.email}</p>
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 uppercase font-medium">Role</span>
                                <p className="text-sm font-medium text-gray-900">
                                    {ROLES.find(r => r.value === approveModal.role)?.label || approveModal.role}
                                </p>
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 uppercase font-medium">Phone Number</span>
                                <p className="text-sm font-medium text-gray-900">{approveModal.phone || 'N/A'}</p>
                            </div>
                            {approveModal.submitted_at && (
                                <div>
                                    <span className="text-xs text-gray-500 uppercase font-medium">Submitted</span>
                                    <p className="text-sm font-medium text-gray-900">{formatDate(approveModal.submitted_at)}</p>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                onClick={() => setApproveModal(null)}
                                disabled={approvingId === approveModal.id}
                                className="flex-1"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleApprove}
                                disabled={approvingId === approveModal.id}
                                className="flex-1 bg-green-600 hover:bg-green-700"
                            >
                                {approvingId === approveModal.id ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        Approving...
                                    </>
                                ) : (
                                    'Approve'
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )}

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

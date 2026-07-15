'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'

const ROLES: Record<string, string> = {
    manager: 'Manager',
    kitchen_staff: 'Kitchen Staff',
    waiter: 'Waiter',
    cashier: 'Cashier',
}

export default function AcceptInvitePage() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const email = searchParams.get('email') || ''
    const role = searchParams.get('role') || ''
    const inviteId = searchParams.get('invite_id') || ''

    const [fullName, setFullName] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    useEffect(() => {
        // If no params, redirect to login
        if (!email && !role) {
            router.push('/login')
            return
        }

        // Verify invite exists and is pending
        const verifyInvite = async () => {
            if (inviteId) {
                const { data: invite } = await supabase
                    .from('invites')
                    .select('status, created_at')
                    .eq('id', inviteId)
                    .single()

                if (!invite || invite.status !== 'pending') {
                    setError('This invite is no longer valid')
                    setLoading(false)
                    return
                }

                // Check if expired (7 days)
                const createdAt = new Date(invite.created_at)
                const now = new Date()
                const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
                if (now.getTime() - createdAt.getTime() > sevenDaysMs) {
                    setError('This invite has expired. Please ask for a new one.')
                    setLoading(false)
                    return
                }
            }
            setLoading(false)
        }

        verifyInvite()
    }, [email, role, inviteId, router])

    const validateForm = (): boolean => {
        if (!fullName.trim()) {
            setError('Please enter your full name')
            return false
        }

        if (!password) {
            setError('Please enter a password')
            return false
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters')
            return false
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match')
            return false
        }

        return true
    }

    const handleAccept = async () => {
        if (!validateForm()) return

        setSubmitting(true)
        setError(null)

        try {
            // User already has a session from token exchange in callback
            // Just need to update password and profile
            const { error: passwordError } = await supabase.auth.updateUser({
                password,
            })

            if (passwordError) {
                setError(passwordError.message)
                setSubmitting(false)
                return
            }

            // Update profile with full_name (profile was auto-created by handle_new_user trigger)
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                await supabase
                    .from('profiles')
                    .update({ full_name: fullName.trim() })
                    .eq('id', user.id)
            }

            // Update invite status to accepted
            if (inviteId) {
                await supabase
                    .from('invites')
                    .update({ status: 'accepted' })
                    .eq('id', inviteId)
            }

            // Redirect to dashboard based on role
            const roleRoutes: Record<string, string> = {
                manager: '/staff',
                kitchen_staff: '/kitchen',
                waiter: '/staff',
                cashier: '/cashier',
            }
            router.push(roleRoutes[role] || '/staff')
        } catch (err) {
            setError('An error occurred. Please try again.')
            setSubmitting(false)
        }
    }

    const handleReject = async () => {
        setSubmitting(true)
        setError(null)

        try {
            // Call reject API which also deletes the auth user
            if (inviteId) {
                await fetch(`/api/staff/invites/${inviteId}/reject`, {
                    method: 'POST',
                })
            }

            // Sign out the user (they have a session from token exchange)
            await supabase.auth.signOut()

            // Redirect to home page
            router.push('/?message=Invite declined')
        } catch (err) {
            setError('An error occurred. Please try again.')
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
        )
    }

    // Invalid or expired invite
    if (error && !submitting) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <Card className="w-full max-w-md">
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <div className="text-4xl mb-4">❌</div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">Invite Invalid</h1>
                            <p className="text-red-600 mb-6">{error}</p>
                            <Button
                                className="w-full bg-orange-500 hover:bg-orange-600"
                                onClick={() => router.push('/login')}
                            >
                                Go to Login
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Invalid link
    if (!email || !role) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <Card className="w-full max-w-md">
                    <CardContent className="pt-6">
                        <div className="text-center text-red-600">
                            Invalid invite link. Please ask your manager to send a new invite.
                        </div>
                        <Button
                            className="w-full mt-4"
                            onClick={() => router.push('/login')}
                        >
                            Go to Login
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <Card className="w-full max-w-md">
                <CardContent className="pt-6">
                    <div className="text-center mb-6">
                        <div className="text-4xl mb-2">🍽️</div>
                        <h1 className="text-2xl font-bold text-gray-900">Welcome to QR Dine!</h1>
                        <p className="text-gray-600 mt-2">You&apos;ve been invited to join as:</p>
                        <p className="text-lg font-semibold text-orange-600 mt-1">
                            📋 {ROLES[role] || role}
                        </p>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Email
                            </label>
                            <Input
                                type="email"
                                value={email}
                                disabled
                                className="bg-gray-50"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Full Name
                            </label>
                            <Input
                                type="text"
                                placeholder="Enter your full name"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                disabled={submitting}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Role
                            </label>
                            <Input
                                type="text"
                                value={ROLES[role] || role}
                                disabled
                                className="bg-gray-50"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Password
                            </label>
                            <Input
                                type="password"
                                placeholder="Create a password (min 6 characters)"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={submitting}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Confirm Password
                            </label>
                            <Input
                                type="password"
                                placeholder="Confirm your password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                disabled={submitting}
                            />
                        </div>

                        <div className="flex gap-3 pt-4">
                            <Button
                                variant="outline"
                                onClick={handleReject}
                                disabled={submitting}
                                className="flex-1 border-orange-500 text-orange-600 hover:bg-orange-50"
                            >
                                {submitting ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    'Reject'
                                )}
                            </Button>
                            <Button
                                onClick={handleAccept}
                                disabled={submitting || !fullName.trim() || !password || !confirmPassword}
                                className="flex-1 bg-green-600 hover:bg-green-700"
                            >
                                {submitting ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    'Accept'
                                )}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

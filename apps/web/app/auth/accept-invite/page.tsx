'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Clock, CheckCircle, XCircle } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import Image from 'next/image'

const ROLES: Record<string, string> = {
    manager: 'Manager',
    kitchen_staff: 'Kitchen Staff',
    waiter: 'Waiter',
    cashier: 'Cashier',
}

type PageState = 'loading' | 'form' | 'submitting' | 'pending_approval' | 'approved' | 'rejected' | 'error'

export default function AcceptInvitePage() {
    const router = useRouter()

    const [fullName, setFullName] = useState('')
    const [phone, setPhone] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [pageState, setPageState] = useState<PageState>('loading')
    const [rejecting, setRejecting] = useState(false)
    const [rejectedRole, setRejectedRole] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [inviteStatus, setInviteStatus] = useState('')

    // Session-derived data
    const [email, setEmail] = useState('')
    const [role, setRole] = useState('')
    const [restaurantId, setRestaurantId] = useState('')
    const [inviteId, setInviteId] = useState('')

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Poll for invite status when in pending_approval state
    const startPolling = useCallback(() => {
        if (pollRef.current) return
        pollRef.current = setInterval(async () => {
            if (!inviteId) return
            const { data: invite } = await supabase
                .from('invites')
                .select('status')
                .eq('id', inviteId)
                .single()

            if (invite?.status === 'accepted') {
                setPageState('approved')
                setInviteStatus('accepted')
                if (pollRef.current) {
                    clearInterval(pollRef.current)
                    pollRef.current = null
                }
            } else if (invite?.status === 'rejected' || invite?.status === 'expired') {
                setPageState('error')
                setError('Your invite was declined or expired.')
                if (pollRef.current) {
                    clearInterval(pollRef.current)
                    pollRef.current = null
                }
            }
        }, 5000)
    }, [inviteId, supabase])

    useEffect(() => {
        const initSession = async () => {
            const hash = window.location.hash

            // 1. Check for error in URL hash
            if (hash) {
                const hashParams = new URLSearchParams(hash.substring(1))
                const hashError = hashParams.get('error')
                if (hashError) {
                    const errorDesc = hashParams.get('error_description') || 'This invite link is invalid or has expired'
                    setError(decodeURIComponent(errorDesc.replace(/\+/g, ' ')))
                    setPageState('error')
                    return
                }
            }

            // 2. Parse tokens from URL hash FIRST (new invite takes priority over old session)
            if (hash) {
                const hashParams = new URLSearchParams(hash.substring(1))
                const accessToken = hashParams.get('access_token')
                const refreshToken = hashParams.get('refresh_token')

                if (accessToken && refreshToken) {
                    const { error: sessionError } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken,
                    })

                    if (!sessionError) {
                        try {
                            const payload = JSON.parse(atob(accessToken.split('.')[1]))
                            const metadata = payload.user_metadata || {}

                            if (metadata.role && (metadata.restaurant_id || metadata.restauraunt_id)) {
                                window.history.replaceState({}, '', window.location.pathname)
                                await processSession({
                                    user: {
                                        user_metadata: metadata,
                                        email: payload.email,
                                    }
                                })
                                return
                            }
                        } catch {
                            // JWT decode failed
                        }

                        const { data: { user } } = await supabase.auth.getUser()
                        if (user) {
                            window.history.replaceState({}, '', window.location.pathname)
                            await processSession({
                                user: {
                                    user_metadata: user.user_metadata || {},
                                    email: user.email,
                                }
                            })
                            return
                        }
                    }
                }
            }

            // 3. No new tokens in URL — check if existing session (page reload after approve)
            const { data: { session: existingSession } } = await supabase.auth.getSession()
            if (existingSession) {
                await processSession(existingSession)
                return
            }

            // 4. No tokens, no session — show error
            setError('No valid invite link detected. Please use the link from your email.')
            setPageState('error')
        }

        const processSession = async (session: { user: { user_metadata: Record<string, string>; email?: string } }) => {
            const user = session.user
            const metadata = user.user_metadata || {}
            const userEmail = user.email || ''
            const userRole = metadata.role || ''
            const userRestaurantId = metadata.restaurant_id || metadata.restauraunt_id || ''

            if (!userRole || !userRestaurantId) {
                setError('Invalid invite — missing role or restaurant information')
                setPageState('error')
                return
            }

            setEmail(userEmail)
            setRole(userRole)
            setRestaurantId(userRestaurantId)

            // Find ANY invite for this email/restaurant (not just pending)
            const { data: invite } = await supabase
                .from('invites')
                .select('id, status, created_at')
                .eq('email', userEmail)
                .eq('restaurant_id', userRestaurantId)
                .in('status', ['pending', 'pending_approval', 'accepted'])
                .order('created_at', { ascending: false })
                .limit(1)
                .single()

            if (!invite) {
                setError('This invite is no longer valid')
                setPageState('error')
                return
            }

            // If already pending_approval, show waiting screen
            if (invite.status === 'pending_approval') {
                setInviteId(invite.id)
                setPageState('pending_approval')
                startPolling()
                return
            }

            // If already accepted, show approved screen
            if (invite.status === 'accepted') {
                setInviteStatus('accepted')
                setPageState('approved')
                return
            }

            // Check if expired (7 days)
            const createdAt = new Date(invite.created_at)
            const now = new Date()
            const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
            if (now.getTime() - createdAt.getTime() > sevenDaysMs) {
                setError('This invite has expired. Please ask for a new one.')
                setPageState('error')
                return
            }

            setInviteId(invite.id)
            setPageState('form')
        }

        initSession()

        return () => {
            if (pollRef.current) {
                clearInterval(pollRef.current)
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const validateForm = (): boolean => {
        if (!fullName.trim()) {
            setError('Please enter your full name')
            return false
        }
        if (!password) {
            setError('Please enter a password')
            return false
        }
        const trimmedPassword = password.trim()
        if (trimmedPassword.length < 8) {
            setError('Password must be at least 8 characters')
            return false
        }
        if (password.length > 128) {
            setError('Password must be 128 characters or less')
            return false
        }
        if (!/[A-Z]/.test(password)) {
            setError('Password must contain at least one uppercase letter')
            return false
        }
        if (!/[a-z]/.test(password)) {
            setError('Password must contain at least one lowercase letter')
            return false
        }
        if (!/[0-9]/.test(password)) {
            setError('Password must contain at least one number')
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

        setPageState('submitting')
        setError(null)

        try {
            const response = await fetch(`/api/staff/invites/${inviteId}/accept`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    full_name: fullName.trim(),
                    phone: phone.trim(),
                    password,
                }),
            })

            if (!response.ok) {
                const body = await response.json().catch(() => ({}))
                throw new Error(body?.error?.message || body?.message || 'Failed to accept invite')
            }

            // Show pending approval screen and start polling
            setPageState('pending_approval')
            startPolling()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred. Please try again.')
            setPageState('form')
        }
    }

    const handleReject = async () => {
        setRejecting(true)
        setError(null)

        try {
            if (inviteId) {
                const response = await fetch(`/api/staff/invites/${inviteId}/reject`, {
                    method: 'POST',
                })
                if (!response.ok) {
                    throw new Error('Failed to reject invite')
                }
            }
            await supabase.auth.signOut()
            setRejectedRole(role)
            setPageState('rejected')
        } catch (err) {
            setError('An error occurred. Please try again.')
            setRejecting(false)
        }
    }

    // ========== RENDER STATES ==========

    if (pageState === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
        )
    }

    // Rejected
    if (pageState === 'rejected') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <Card className="w-full max-w-md">
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <div className="text-4xl mb-4">
                                <XCircle className="h-12 w-12 text-red-500 mx-auto" />
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">Invitation Declined</h1>
                            <p className="text-gray-600 mb-6">
                                You declined the invitation to join as{' '}
                                <span className="font-semibold text-orange-600">
                                    {ROLES[rejectedRole] || rejectedRole}
                                </span>
                            </p>
                            <Button
                                className="w-full bg-orange-500 hover:bg-orange-600"
                                onClick={() => router.push('/login')}
                            >
                                Close
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Approved by owner
    if (pageState === 'approved') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <Card className="w-full max-w-md">
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <div className="text-4xl mb-4">
                                <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">You&apos;re Approved!</h1>
                            <p className="text-gray-600 mb-2">
                                Your restaurant owner has approved your account.
                            </p>
                            <p className="text-gray-600 mb-6">
                                You can now log in with your email and the password you set.
                            </p>
                            <Button
                                className="w-full bg-green-600 hover:bg-green-700"
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

    // Waiting for owner approval
    if (pageState === 'pending_approval') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <Card className="w-full max-w-md">
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <div className="text-4xl mb-4">
                                <Clock className="h-12 w-12 text-orange-500 mx-auto animate-pulse" />
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">Waiting for Approval</h1>
                            <p className="text-gray-600 mb-2">
                                Your details have been submitted to{' '}
                                <span className="font-semibold">{email}</span>.
                            </p>
                            <p className="text-gray-600 mb-6">
                                The restaurant owner will review and approve your account shortly.
                                You&apos;ll be able to log in once approved.
                            </p>
                            <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Waiting for approval...
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Invalid or expired invite
    if (pageState === 'error' && !inviteId) {
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

    // ========== FORM ==========
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <Card className="w-full max-w-md">
                <CardContent className="pt-6">
                    <div className="text-center mb-6">
                        <Image
                            src="/logo.png"
                            alt="QR Dine"
                            width={120}
                            height={40}
                            className="mx-auto mb-2 h-10 w-auto"
                            priority
                        />
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
                                disabled={pageState === 'submitting' || rejecting}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Phone Number
                            </label>
                            <Input
                                type="tel"
                                placeholder="Enter your phone number"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                disabled={pageState === 'submitting' || rejecting}
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
                                placeholder="Create a password (min 8 characters)"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={pageState === 'submitting' || rejecting}
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
                                disabled={pageState === 'submitting' || rejecting}
                            />
                        </div>

                        <div className="flex gap-3 pt-4">
                            <Button
                                variant="outline"
                                onClick={handleReject}
                                disabled={pageState === 'submitting' || rejecting}
                                className="flex-1 border-orange-500 text-orange-600 hover:bg-orange-50"
                            >
                                {rejecting ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    'Reject'
                                )}
                            </Button>
                            <Button
                                onClick={handleAccept}
                                disabled={pageState === 'submitting' || rejecting || !fullName.trim() || !password || !confirmPassword}
                                className="flex-1 bg-green-600 hover:bg-green-700"
                            >
                                {pageState === 'submitting' ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        Submitting...
                                    </>
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

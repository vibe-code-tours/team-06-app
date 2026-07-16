'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import Image from 'next/image'

const ROLES: Record<string, string> = {
    manager: 'Manager',
    kitchen_staff: 'Kitchen Staff',
    waiter: 'Waiter',
    cashier: 'Cashier',
}

export default function AcceptInvitePage() {
    const router = useRouter()

    const [fullName, setFullName] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Session-derived data
    const [email, setEmail] = useState('')
    const [role, setRole] = useState('')
    const [restaurantId, setRestaurantId] = useState('')
    const [inviteId, setInviteId] = useState('')

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    useEffect(() => {
        const initSession = async () => {
            // 1. Check for error in URL hash (Supabase redirects with error params)
            const hash = window.location.hash
            if (hash) {
                const hashParams = new URLSearchParams(hash.substring(1))
                const hashError = hashParams.get('error')
                if (hashError) {
                    const errorDesc = hashParams.get('error_description') || 'This invite link is invalid or has expired'
                    setError(decodeURIComponent(errorDesc.replace(/\+/g, ' ')))
                    setLoading(false)
                    return
                }
            }

            // 2. Check if session already exists (page reload after accept)
            const { data: { session: existingSession } } = await supabase.auth.getSession()
            if (existingSession) {
                await processSession(existingSession)
                return
            }

            // 3. Parse tokens from URL hash and establish session manually
            //    @supabase/ssr may not auto-detect implicit flow tokens
            if (hash) {
                const hashParams = new URLSearchParams(hash.substring(1))
                const accessToken = hashParams.get('access_token')
                const refreshToken = hashParams.get('refresh_token')

                if (accessToken && refreshToken) {
                    // Establish session first (needed for updateUser on Accept)
                    const { error: sessionError } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken,
                    })

                    if (!sessionError) {
                        // Decode JWT to get user_metadata directly
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

                        // Fallback: get metadata from session
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

            // 4. No tokens, no session — show error
            setError('No valid invite link detected. Please use the link from your email.')
            setLoading(false)
        }

        const processSession = async (session: { user: { user_metadata: Record<string, string>; email?: string } }) => {
            const user = session.user
            const metadata = user.user_metadata || {}
            const userEmail = user.email || ''
            const userRole = metadata.role || ''
            // Handle typo in old invites: restauraunt_id vs restaurant_id
            const userRestaurantId = metadata.restaurant_id || metadata.restauraunt_id || ''

            if (!userRole || !userRestaurantId) {
                setError('Invalid invite — missing role or restaurant information')
                setLoading(false)
                return
            }

            setEmail(userEmail)
            setRole(userRole)
            setRestaurantId(userRestaurantId)

            // Find the pending invite for this email/restaurant
            const { data: invite } = await supabase
                .from('invites')
                .select('id, created_at')
                .eq('email', userEmail)
                .eq('restaurant_id', userRestaurantId)
                .eq('status', 'pending')
                .single()

            if (!invite) {
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

            setInviteId(invite.id)
            setLoading(false)
        }

        initSession()
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
            // User already has a session from token in URL hash
            // Just need to update password and profile
            const { error: passwordError } = await supabase.auth.updateUser({
                password,
            })

            if (passwordError) {
                setError(passwordError.message)
                setSubmitting(false)
                return
            }

            // Create profile (skipped by trigger for invited users)
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                await supabase
                    .from('profiles')
                    .insert({
                        id: user.id,
                        email: user.email || '',
                        full_name: fullName.trim(),
                        role: role as 'waiter' | 'manager' | 'kitchen_staff' | 'cashier',
                        restaurant_id: restaurantId,
                    })
            }

            // Update invite status to accepted
            if (inviteId) {
                await supabase
                    .from('invites')
                    .update({ status: 'accepted' })
                    .eq('id', inviteId)
            }

            // Sign out and redirect to login
            await supabase.auth.signOut()
            router.push('/login')
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

            // Sign out the user (they have a session from token in URL hash)
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
    if (error && !submitting && !inviteId) {
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
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        Creating...
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

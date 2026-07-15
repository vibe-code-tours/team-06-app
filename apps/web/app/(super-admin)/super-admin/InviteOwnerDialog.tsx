'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface InviteOwnerDialogProps {
    restaurantId: string
    restaurantName: string
    onInvited: () => void
    onClose: () => void
}

export default function InviteOwnerDialog({
    restaurantId,
    restaurantName,
    onInvited,
    onClose,
}: InviteOwnerDialogProps) {
    const [email, setEmail] = useState('')
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [saving, setSaving] = useState(false)

    const invite = async () => {
        setSaving(true)
        setErrorMessage(null)

        try {
            const response = await fetch('/api/staff/invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    role: 'restaurant_owner',
                    restaurant_id: restaurantId,
                }),
            })

            if (!response.ok) {
                const { error } = await response.json()
                setErrorMessage(error?.message ?? 'Failed to send invite')
                setSaving(false)
                return
            }

            setSuccess(true)
            setSaving(false)
        } catch {
            setErrorMessage('Failed to send invite')
            setSaving(false)
        }
    }

    if (success) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>Invite Sent</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            An invite has been sent to <strong>{email}</strong> for{' '}
                            <strong>{restaurantName}</strong>.
                        </p>
                        <div className="flex justify-end">
                            <Button onClick={onInvited}>Done</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Invite Owner</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Send an invite to set the owner of <strong>{restaurantName}</strong>.
                    </p>
                    {errorMessage && (
                        <div
                            className="p-3 text-sm text-red-600 bg-red-50 rounded-md"
                            role="alert"
                        >
                            {errorMessage}
                        </div>
                    )}
                    <div>
                        <label htmlFor="owner-email" className="text-sm font-medium">
                            Email *
                        </label>
                        <Input
                            id="owner-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="owner@example.com"
                        />
                    </div>
                    <div className="flex gap-2 justify-end pt-2">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            disabled={saving}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={invite}
                            disabled={saving || !email}
                        >
                            {saving ? 'Sending...' : 'Send Invite'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

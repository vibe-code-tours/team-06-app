'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { LogOut, Store } from 'lucide-react'

interface UserProfile {
    full_name: string
    role: string
}

export default function Header() {
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        const fetchProfile = async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser()

            if (!user) return

            const { data } = await supabase
                .from('profiles')
                .select('full_name, role')
                .eq('id', user.id)
                .single()

            if (data) {
                setProfile(data)
            }
        }

        fetchProfile()
    }, [supabase])

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    const formatRole = (role: string) => {
        return role
            .split('_')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
    }

    return (
        <header className="border-b border-border bg-card">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-14">
                    <div className="flex items-center gap-2">
                        <Store className="h-5 w-5 text-primary" />
                        <span className="font-semibold text-foreground">QR Dine</span>
                    </div>

                    <div className="flex items-center gap-4">
                        {profile && (
                            <>
                                <span className="text-sm text-muted-foreground hidden sm:inline">
                                    {formatRole(profile.role)}
                                </span>
                                <span className="text-sm font-medium text-foreground">
                                    {profile.full_name}
                                </span>
                            </>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleLogout}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <LogOut className="h-4 w-4 mr-1" />
                            Logout
                        </Button>
                    </div>
                </div>
            </div>
        </header>
    )
}

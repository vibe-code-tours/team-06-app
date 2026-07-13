import Header from '@/components/ui/header'

export default function StaffLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen">
            <Header />
            {children}
        </div>
    )
}

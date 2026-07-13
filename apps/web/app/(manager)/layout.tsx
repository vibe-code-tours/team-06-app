import Header from '@/components/ui/header'

export default function ManagerLayout({
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

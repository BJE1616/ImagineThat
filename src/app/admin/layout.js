'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useTheme } from '@/lib/ThemeContext'

export default function AdminLayout({ children }) {
    const router = useRouter()
    const pathname = usePathname()
    const { currentTheme } = useTheme()
    const [isAdmin, setIsAdmin] = useState(false)
    const [loading, setLoading] = useState(true)
    const [sidebarOpen, setSidebarOpen] = useState(true)

    useEffect(() => {
        checkAdmin()
    }, [])

    const checkAdmin = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                if (pathname !== '/admin/login') {
                    router.push('/admin/login')
                }
                setLoading(false)
                return
            }

            const { data: userData, error } = await supabase
                .from('users')
                .select('is_admin, email')
                .eq('id', user.id)
                .single()

            if (error) throw error

            if (!userData?.is_admin) {
                router.push('/dashboard')
                return
            }

            setIsAdmin(true)
        } catch (error) {
            console.error('Admin check error:', error)
            router.push('/admin/login')
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/admin/login')
    }

    if (pathname === '/admin/login') {
        return children
    }

    if (loading) {
        return (
            <div className={`min-h-screen flex items-center justify-center bg-${currentTheme.bg}`}>
                <div className="flex flex-col items-center gap-4">
                    <div className={`w-12 h-12 border-4 border-${currentTheme.accent} border-t-transparent rounded-full animate-spin`}></div>
                    <p className={`text-${currentTheme.textMuted} font-medium`}>Loading admin panel...</p>
                </div>
            </div>
        )
    }

    if (!isAdmin) {
        return null
    }

    const navItems = [
        { href: '/admin/matrix', label: 'Matrix Overview', icon: '🔷' },
        { href: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
        { href: '/admin/stats', label: 'Stats', icon: '📈' },
        { href: '/admin/advertisers', label: 'Advertisers', icon: '📢' },
        { href: '/admin/bonus', label: 'Bonus Views', icon: '🎁' },
        { href: '/admin/prizes', label: 'Prize Settings', icon: '🎁' },
        { href: '/admin/winners', label: 'Weekly Winners', icon: '🏆' },
        { href: '/admin/payments', label: 'Payment History', icon: '💰' },
        { href: '/admin/archive', label: 'Winners Archive', icon: '📚' },
        { href: '/admin/users', label: 'User Management', icon: '👥' },
        { href: '/admin/house-cards', label: 'House Cards', icon: '🏠' },
        { href: '/admin/cancellations', label: 'Cancellations', icon: '❌' },
        { href: '/admin/settings', label: 'Platform Settings', icon: '⚙️' },
    ]

    return (
        <div className={`min-h-screen bg-${currentTheme.bg} flex`}>
            <aside className={`${sidebarOpen ? 'w-52' : 'w-14'} bg-${currentTheme.card} border-r border-${currentTheme.border} transition-all duration-300 flex flex-col`}>
                <div className={`p-2 border-b border-${currentTheme.border}`}>
                    <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 bg-gradient-to-br from-${currentTheme.accentHover} to-orange-500 rounded-lg flex items-center justify-center text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'} font-bold text-sm`}>
                            IT
                        </div>
                        {sidebarOpen && (
                            <div>
                                <h1 className={`text-${currentTheme.text} font-bold text-sm`}>ImagineThat</h1>
                                <p className={`text-[10px] text-${currentTheme.textMuted}`}>Admin Panel</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className={`p-2 border-b border-${currentTheme.border}`}>
                    <Link
                        href="/game"
                        className="flex items-center gap-2 px-2 py-1.5 rounded text-green-400 hover:bg-green-500/20 transition-all text-sm"
                    >
                        <span>🌐</span>
                        {sidebarOpen && <span className="font-medium">Back to Site</span>}
                    </Link>
                </div>

                <nav className="flex-1 p-2 overflow-y-auto">
                    <ul className="space-y-0.5">
                        {navItems.map((item) => (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    className={`flex items-center gap-2 px-2 py-1.5 rounded transition-all text-sm ${pathname === item.href
                                        ? `bg-${currentTheme.accent}/20 text-${currentTheme.accent} border border-${currentTheme.accent}/30`
                                        : `text-${currentTheme.textMuted} hover:text-${currentTheme.text} hover:bg-${currentTheme.border}/50`
                                        }`}
                                >
                                    <span>{item.icon}</span>
                                    {sidebarOpen && <span>{item.label}</span>}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>

                <div className={`p-2 border-t border-${currentTheme.border}`}>
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className={`w-full flex items-center justify-center gap-2 px-2 py-1.5 text-${currentTheme.textMuted} hover:text-${currentTheme.text} hover:bg-${currentTheme.border}/50 rounded transition-all text-sm mb-1`}
                    >
                        <span>{sidebarOpen ? '◀' : '▶'}</span>
                        {sidebarOpen && <span>Collapse</span>}
                    </button>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 px-2 py-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-all text-sm"
                    >
                        <span>🚪</span>
                        {sidebarOpen && <span>Logout</span>}
                    </button>
                </div>
            </aside>

            <main className="flex-1 overflow-auto">
                {children}
            </main>
        </div>
    )
}
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
    const [expandedGroups, setExpandedGroups] = useState(['finances', 'overview'])

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

    const toggleGroup = (groupKey) => {
        setExpandedGroups(prev =>
            prev.includes(groupKey)
                ? prev.filter(g => g !== groupKey)
                : [...prev, groupKey]
        )
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

    const navGroups = [
        {
            key: 'overview',
            label: 'Overview',
            icon: '📊',
            items: [
                { href: '/admin/dashboard', label: 'Dashboard', icon: '📈' },
                { href: '/admin/stats', label: 'Stats', icon: '📉' },
                { href: '/admin/matrix', label: 'Matrix Overview', icon: '🔷' },
            ]
        },
        {
            key: 'finances',
            label: 'Finances',
            icon: '💰',
            items: [
                { href: '/admin/accounting', label: 'Accounting', icon: '📒' },
                { href: '/admin/payout-queue', label: 'Payout Queue', icon: '💸' },
                { href: '/admin/payment-processors', label: 'Payment Processors', icon: '💳' },
                { href: '/admin/payments', label: 'Payment History', icon: '🧾' },
            ]
        },
        {
            key: 'games',
            label: 'Games & Prizes',
            icon: '🎮',
            items: [
                { href: '/admin/game-settings', label: 'Game BB Settings', icon: '🎰' },
                { href: '/admin/prizes', label: 'Prize Settings', icon: '🎁' },
                { href: '/admin/bonus', label: 'Bonus Views', icon: '👀' },
                { href: '/admin/winners', label: 'Weekly Winners', icon: '🏆' },
                { href: '/admin/archive', label: 'Winners Archive', icon: '📚' },
            ]
        },
        {
            key: 'users',
            label: 'Users',
            icon: '👥',
            items: [
                { href: '/admin/users', label: 'User Management', icon: '👤' },
                { href: '/admin/advertisers', label: 'Advertisers', icon: '📢' },
            ]
        },
        {
            key: 'settings',
            label: 'Settings',
            icon: '⚙️',
            items: [
                { href: '/admin/settings', label: 'Platform Settings', icon: '🔧' },
                { href: '/admin/house-cards', label: 'House Cards', icon: '🏠' },
                { href: '/admin/cancellations', label: 'Cancellations', icon: '❌' },
            ]
        },
    ]

    const isItemActive = (href) => pathname === href
    const isGroupActive = (group) => group.items.some(item => pathname === item.href)

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
                    {navGroups.map((group) => (
                        <div key={group.key} className="mb-1">
                            <button
                                onClick={() => toggleGroup(group.key)}
                                className={`w-full flex items-center justify-between px-2 py-1.5 rounded transition-all text-sm ${isGroupActive(group)
                                        ? `text-${currentTheme.accent}`
                                        : `text-${currentTheme.textMuted} hover:text-${currentTheme.text}`
                                    } hover:bg-${currentTheme.border}/50`}
                            >
                                <div className="flex items-center gap-2">
                                    <span>{group.icon}</span>
                                    {sidebarOpen && <span className="font-medium">{group.label}</span>}
                                </div>
                                {sidebarOpen && (
                                    <span className={`text-xs transition-transform ${expandedGroups.includes(group.key) ? 'rotate-90' : ''}`}>
                                        ▶
                                    </span>
                                )}
                            </button>

                            {sidebarOpen && expandedGroups.includes(group.key) && (
                                <ul className="ml-4 mt-0.5 space-y-0.5">
                                    {group.items.map((item) => (
                                        <li key={item.href}>
                                            <Link
                                                href={item.href}
                                                className={`flex items-center gap-2 px-2 py-1 rounded transition-all text-xs ${isItemActive(item.href)
                                                        ? `bg-${currentTheme.accent}/20 text-${currentTheme.accent} border-l-2 border-${currentTheme.accent}`
                                                        : `text-${currentTheme.textMuted} hover:text-${currentTheme.text} hover:bg-${currentTheme.border}/50`
                                                    }`}
                                            >
                                                <span>{item.icon}</span>
                                                <span>{item.label}</span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ))}
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
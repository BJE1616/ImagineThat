'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

export default function AdminLayout({ children }) {
    const router = useRouter()
    const pathname = usePathname()
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
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-400 font-medium">Loading admin panel...</p>
                </div>
            </div>
        )
    }

    if (!isAdmin) {
        return null
    }

    const navItems = [
        { href: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
        { href: '/admin/prizes', label: 'Prize Settings', icon: '🎁' },
        { href: '/admin/winners', label: 'Weekly Winners', icon: '🏆' },
        { href: '/admin/payments', label: 'Payment History', icon: '💰' },
        { href: '/admin/archive', label: 'Winners Archive', icon: '📚' },
        { href: '/admin/users', label: 'User Management', icon: '👥' },
    ]

    return (
        <div className="min-h-screen bg-slate-900 flex">
            <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-slate-800 border-r border-slate-700 transition-all duration-300 flex flex-col`}>
                <div className="p-4 border-b border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center text-slate-900 font-bold text-lg">
                            IT
                        </div>
                        {sidebarOpen && (
                            <div>
                                <h1 className="text-white font-bold">ImagineThat</h1>
                                <p className="text-xs text-slate-400">Admin Panel</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-b border-slate-700">
                    <Link
                        href="/game"
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-green-400 hover:bg-green-500/20 transition-all"
                    >
                        <span className="text-xl">🌐</span>
                        {sidebarOpen && <span className="font-medium">Back to Site</span>}
                    </Link>
                </div>

                <nav className="flex-1 p-4">
                    <ul className="space-y-2">
                        {navItems.map((item) => (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${pathname === item.href
                                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                            : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                                        }`}
                                >
                                    <span className="text-xl">{item.icon}</span>
                                    {sidebarOpen && <span className="font-medium">{item.label}</span>}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>

                <div className="p-4 border-t border-slate-700">
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-all mb-2"
                    >
                        <span>{sidebarOpen ? '◀' : '▶'}</span>
                        {sidebarOpen && <span>Collapse</span>}
                    </button>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
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
'use client'

import { useEffect, useState, createContext, useContext } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useTheme } from '@/lib/ThemeContext'

// Create context for admin role
export const AdminRoleContext = createContext({ role: null, permissions: [] })
export const useAdminRole = () => useContext(AdminRoleContext)

// Page access by role
const PAGE_ACCESS = {
    // Super Admin only
    '/admin/team': ['super_admin'],
    '/admin/audit-log': ['super_admin'],
    '/admin/accounting': ['super_admin'],
    '/admin/geography': ['super_admin'],

    // Super Admin + Admin
    '/admin/reports': ['super_admin', 'admin'],
    '/admin/economy': ['super_admin', 'admin'],
    '/admin/payment-processors': ['super_admin', 'admin'],
    '/admin/partner-withdrawals': ['super_admin', 'admin'],
    '/admin/payout-queue': ['super_admin', 'admin'],

    // Super Admin + Admin + Manager
    '/admin/dashboard': ['super_admin', 'admin', 'manager', 'support'],
    '/admin/stats': ['super_admin', 'admin', 'manager'],
    '/admin/matrix': ['super_admin', 'admin', 'manager'],
    '/admin/prizes': ['super_admin', 'admin', 'manager'],
    '/admin/game-settings': ['super_admin', 'admin', 'manager'],
    '/admin/bonus': ['super_admin', 'admin', 'manager'],
    '/admin/winners': ['super_admin', 'admin', 'manager', 'support'],
    '/admin/archive': ['super_admin', 'admin', 'manager', 'support'],
    '/admin/merch-store': ['super_admin', 'admin', 'manager', 'support'],
    '/admin/users': ['super_admin', 'admin', 'manager', 'support'],
    '/admin/advertisers': ['super_admin', 'admin', 'manager'],
    '/admin/settings': ['super_admin', 'admin'],
    '/admin/house-cards': ['super_admin', 'admin', 'manager'],
    '/admin/cancellations': ['super_admin', 'admin', 'manager'],
    '/admin/payments': ['super_admin', 'admin'],
}

export default function AdminLayout({ children }) {
    const router = useRouter()
    const pathname = usePathname()
    const { currentTheme } = useTheme()
    const [isAdmin, setIsAdmin] = useState(false)
    const [userRole, setUserRole] = useState(null)
    const [financialPermissions, setFinancialPermissions] = useState([])
    const [loading, setLoading] = useState(true)
    const [sidebarOpen, setSidebarOpen] = useState(true)
    const [expandedGroups, setExpandedGroups] = useState(['finances', 'overview'])
    const [accessDenied, setAccessDenied] = useState(false)

    useEffect(() => {
        checkAdmin()
    }, [])

    useEffect(() => {
        // Check page access when pathname or role changes
        if (userRole && pathname !== '/admin/login') {
            checkPageAccess()
        }
    }, [pathname, userRole])

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
                .select('is_admin, email, role')
                .eq('id', user.id)
                .single()

            if (error) throw error

            if (!userData?.is_admin) {
                router.push('/dashboard')
                return
            }

            setIsAdmin(true)
            setUserRole(userData.role || 'support')

            // Load financial permissions for this role
            if (userData.role) {
                const { data: permissions } = await supabase
                    .from('admin_financial_permissions')
                    .select('metric_key')
                    .eq(userData.role, true)

                setFinancialPermissions(permissions?.map(p => p.metric_key) || [])
            }
        } catch (error) {
            console.error('Admin check error:', error)
            router.push('/admin/login')
        } finally {
            setLoading(false)
        }
    }

    const checkPageAccess = () => {
        const allowedRoles = PAGE_ACCESS[pathname]

        // If page not in list, allow all admin roles
        if (!allowedRoles) {
            setAccessDenied(false)
            return
        }

        if (!allowedRoles.includes(userRole)) {
            setAccessDenied(true)
        } else {
            setAccessDenied(false)
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

    const canAccessPage = (href) => {
        const allowedRoles = PAGE_ACCESS[href]
        if (!allowedRoles) return true
        return allowedRoles.includes(userRole)
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
                { href: '/admin/accounting', label: 'Accounting', icon: '📒', superAdminOnly: true },
                { href: '/admin/payout-queue', label: 'Payout Queue', icon: '💸' },
                { href: '/admin/partner-withdrawals', label: 'Partner Withdrawals', icon: '🤝' },
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
                { href: '/admin/merch-store', label: 'Merch Store', icon: '🛍️' },
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
                { href: '/admin/economy', label: 'Economy Settings', icon: '💹' },
                { href: '/admin/reports', label: 'Report Subscriptions', icon: '📧' },
                { href: '/admin/house-cards', label: 'House Cards', icon: '🏠' },
                { href: '/admin/cancellations', label: 'Cancellations', icon: '❌' },
            ]
        },
        {
            key: 'admin',
            label: 'Administration',
            icon: '🔐',
            superAdminOnly: true,
            items: [
                { href: '/admin/team', label: 'Team Management', icon: '👥', superAdminOnly: true },
                { href: '/admin/audit-log', label: 'Audit Log', icon: '📋', superAdminOnly: true },
                { href: '/admin/geography', label: 'User Geography', icon: '🌍', superAdminOnly: true },
            ]
        },
    ]

    const isItemActive = (href) => pathname === href
    const isGroupActive = (group) => group.items.some(item => pathname === item.href)

    const getRoleBadge = () => {
        const badges = {
            super_admin: { label: 'Super Admin', color: 'yellow' },
            admin: { label: 'Admin', color: 'purple' },
            manager: { label: 'Manager', color: 'blue' },
            support: { label: 'Support', color: 'green' }
        }
        return badges[userRole] || { label: 'Unknown', color: 'gray' }
    }

    const roleBadge = getRoleBadge()

    return (
        <AdminRoleContext.Provider value={{ role: userRole, permissions: financialPermissions }}>
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

                    {/* Role Badge */}
                    {sidebarOpen && (
                        <div className={`px-2 py-1 border-b border-${currentTheme.border}`}>
                            <span className={`px-2 py-0.5 bg-${roleBadge.color}-500/20 text-${roleBadge.color}-400 rounded text-[10px] font-medium`}>
                                {roleBadge.label}
                            </span>
                        </div>
                    )}

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
                        {navGroups.map((group) => {
                            // Hide super admin only groups from other roles
                            if (group.superAdminOnly && userRole !== 'super_admin') {
                                return null
                            }

                            // Filter items based on access
                            const accessibleItems = group.items.filter(item => {
                                if (item.superAdminOnly && userRole !== 'super_admin') return false
                                return canAccessPage(item.href)
                            })

                            // Don't show empty groups
                            if (accessibleItems.length === 0) return null

                            return (
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
                                            {accessibleItems.map((item) => (
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
                                                        {item.superAdminOnly && (
                                                            <span className="text-yellow-400 text-[8px]">🔒</span>
                                                        )}
                                                    </Link>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )
                        })}
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
                    {accessDenied ? (
                        <div className="p-4">
                            <div className="bg-red-500/20 border border-red-500 rounded-lg p-6 max-w-lg">
                                <h2 className="text-red-400 font-bold text-lg mb-2">🚫 Access Denied</h2>
                                <p className={`text-${currentTheme.textMuted} mb-4`}>
                                    You don't have permission to access this page. Your current role is <span className={`text-${roleBadge.color}-400 font-medium`}>{roleBadge.label}</span>.
                                </p>
                                <Link
                                    href="/admin/dashboard"
                                    className={`inline-block px-4 py-2 bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'} rounded font-medium text-sm`}
                                >
                                    Go to Dashboard
                                </Link>
                            </div>
                        </div>
                    ) : (
                        children
                    )}
                </main>
            </div>
        </AdminRoleContext.Provider>
    )
}
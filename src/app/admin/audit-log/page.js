'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'

export default function AuditLogPage() {
    const { currentTheme } = useTheme()
    const [loading, setLoading] = useState(true)
    const [currentUser, setCurrentUser] = useState(null)
    const [logs, setLogs] = useState([])
    const [stats, setStats] = useState({ total: 0, oldest: null, newest: null })
    const [filters, setFilters] = useState({
        action: '',
        user: '',
        dateFrom: '',
        dateTo: ''
    })
    const [page, setPage] = useState(0)
    const [hasMore, setHasMore] = useState(true)
    const LIMIT = 50

    useEffect(() => {
        checkAccess()
    }, [])

    useEffect(() => {
        if (currentUser?.role === 'super_admin') {
            loadLogs()
            loadStats()
        }
    }, [filters, page, currentUser])

    const checkAccess = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data: userData } = await supabase
                    .from('users')
                    .select('id, email, role')
                    .eq('id', user.id)
                    .single()
                setCurrentUser(userData)
            }
        } catch (error) {
            console.error('Error checking access:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadLogs = async () => {
        try {
            let query = supabase
                .from('admin_audit_log')
                .select('*')
                .order('created_at', { ascending: false })
                .range(page * LIMIT, (page + 1) * LIMIT - 1)

            if (filters.action) {
                query = query.ilike('action', `%${filters.action}%`)
            }
            if (filters.user) {
                query = query.ilike('user_email', `%${filters.user}%`)
            }
            if (filters.dateFrom) {
                query = query.gte('created_at', filters.dateFrom)
            }
            if (filters.dateTo) {
                query = query.lte('created_at', filters.dateTo + 'T23:59:59')
            }

            const { data, error } = await query

            if (error) throw error

            if (page === 0) {
                setLogs(data || [])
            } else {
                setLogs(prev => [...prev, ...(data || [])])
            }

            setHasMore((data?.length || 0) === LIMIT)
        } catch (error) {
            console.error('Error loading logs:', error)
        }
    }

    const loadStats = async () => {
        try {
            const { count } = await supabase
                .from('admin_audit_log')
                .select('*', { count: 'exact', head: true })

            const { data: oldest } = await supabase
                .from('admin_audit_log')
                .select('created_at')
                .order('created_at', { ascending: true })
                .limit(1)
                .single()

            const { data: newest } = await supabase
                .from('admin_audit_log')
                .select('created_at')
                .order('created_at', { ascending: false })
                .limit(1)
                .single()

            setStats({
                total: count || 0,
                oldest: oldest?.created_at,
                newest: newest?.created_at
            })
        } catch (error) {
            console.error('Error loading stats:', error)
        }
    }

    const exportLogs = async () => {
        try {
            let query = supabase
                .from('admin_audit_log')
                .select('*')
                .order('created_at', { ascending: false })

            if (filters.dateFrom) {
                query = query.gte('created_at', filters.dateFrom)
            }
            if (filters.dateTo) {
                query = query.lte('created_at', filters.dateTo + 'T23:59:59')
            }

            const { data, error } = await query

            if (error) throw error

            // Convert to CSV
            const headers = ['Date', 'User', 'Action', 'Table', 'Record ID', 'Details']
            const rows = data.map(log => [
                new Date(log.created_at).toLocaleString(),
                log.user_email || '',
                log.action || '',
                log.table_name || '',
                log.record_id || '',
                JSON.stringify(log.new_value || {})
            ])

            const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')

            // Download
            const blob = new Blob([csv], { type: 'text/csv' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`
            a.click()
            URL.revokeObjectURL(url)
        } catch (error) {
            console.error('Error exporting logs:', error)
            alert('Failed to export logs')
        }
    }

    const clearFilters = () => {
        setFilters({ action: '', user: '', dateFrom: '', dateTo: '' })
        setPage(0)
    }

    const formatDate = (dateStr) => {
        if (!dateStr) return '-'
        const date = new Date(dateStr)
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const formatAction = (action) => {
        const actionMap = {
            'role_change': { label: 'Role Changed', color: 'purple' },
            'team_add': { label: 'Added to Team', color: 'green' },
            'team_remove': { label: 'Removed from Team', color: 'red' },
            'permission_change': { label: 'Permission Changed', color: 'blue' },
            'setting_change': { label: 'Setting Changed', color: 'yellow' },
            'prize_update': { label: 'Prize Updated', color: 'orange' },
            'order_process': { label: 'Order Processed', color: 'cyan' },
            'logs_deleted': { label: 'Logs Deleted', color: 'red' }
        }
        const mapped = actionMap[action] || { label: action, color: 'gray' }
        return mapped
    }

    const getDaysSinceOldest = () => {
        if (!stats.oldest) return 0
        const oldest = new Date(stats.oldest)
        const now = new Date()
        return Math.floor((now - oldest) / (1000 * 60 * 60 * 24))
    }

    if (loading) {
        return (
            <div className="p-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
            </div>
        )
    }

    if (currentUser?.role !== 'super_admin') {
        return (
            <div className="p-4">
                <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 text-red-400">
                    <h2 className="font-bold text-lg mb-2">🚫 Access Denied</h2>
                    <p>Only Super Admins can view the Audit Log.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="p-4">
            <div className="mb-4">
                <h1 className={`text-lg font-bold text-${currentTheme.text}`}>📋 Audit Log</h1>
                <p className={`text-${currentTheme.textMuted} text-xs`}>Track all admin actions and changes</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-3`}>
                    <p className={`text-${currentTheme.textMuted} text-xs`}>Total Entries</p>
                    <p className={`text-${currentTheme.text} text-xl font-bold`}>{stats.total.toLocaleString()}</p>
                </div>
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-3`}>
                    <p className={`text-${currentTheme.textMuted} text-xs`}>Log Age</p>
                    <p className={`text-${currentTheme.text} text-xl font-bold`}>{getDaysSinceOldest()} days</p>
                </div>
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-3`}>
                    <p className={`text-${currentTheme.textMuted} text-xs`}>Oldest Entry</p>
                    <p className={`text-${currentTheme.text} text-sm font-medium`}>{formatDate(stats.oldest)}</p>
                </div>
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-3`}>
                    <p className={`text-${currentTheme.textMuted} text-xs`}>Newest Entry</p>
                    <p className={`text-${currentTheme.text} text-sm font-medium`}>{formatDate(stats.newest)}</p>
                </div>
            </div>

            {/* Filters */}
            <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-3 mb-4`}>
                <div className="flex flex-wrap gap-2 items-end">
                    <div>
                        <label className={`block text-${currentTheme.textMuted} text-xs mb-1`}>Action</label>
                        <input
                            type="text"
                            value={filters.action}
                            onChange={(e) => { setFilters({ ...filters, action: e.target.value }); setPage(0); }}
                            placeholder="e.g., role_change"
                            className={`px-2 py-1 bg-${currentTheme.bg} border border-${currentTheme.border} rounded text-${currentTheme.text} text-sm w-32`}
                        />
                    </div>
                    <div>
                        <label className={`block text-${currentTheme.textMuted} text-xs mb-1`}>User Email</label>
                        <input
                            type="text"
                            value={filters.user}
                            onChange={(e) => { setFilters({ ...filters, user: e.target.value }); setPage(0); }}
                            placeholder="e.g., admin@"
                            className={`px-2 py-1 bg-${currentTheme.bg} border border-${currentTheme.border} rounded text-${currentTheme.text} text-sm w-40`}
                        />
                    </div>
                    <div>
                        <label className={`block text-${currentTheme.textMuted} text-xs mb-1`}>From Date</label>
                        <input
                            type="date"
                            value={filters.dateFrom}
                            onChange={(e) => { setFilters({ ...filters, dateFrom: e.target.value }); setPage(0); }}
                            className={`px-2 py-1 bg-${currentTheme.bg} border border-${currentTheme.border} rounded text-${currentTheme.text} text-sm`}
                        />
                    </div>
                    <div>
                        <label className={`block text-${currentTheme.textMuted} text-xs mb-1`}>To Date</label>
                        <input
                            type="date"
                            value={filters.dateTo}
                            onChange={(e) => { setFilters({ ...filters, dateTo: e.target.value }); setPage(0); }}
                            className={`px-2 py-1 bg-${currentTheme.bg} border border-${currentTheme.border} rounded text-${currentTheme.text} text-sm`}
                        />
                    </div>
                    <button
                        onClick={clearFilters}
                        className={`px-3 py-1 bg-${currentTheme.border} text-${currentTheme.textMuted} rounded text-sm hover:bg-${currentTheme.card}`}
                    >
                        Clear
                    </button>
                    <button
                        onClick={exportLogs}
                        className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-400"
                    >
                        📥 Export CSV
                    </button>
                </div>
            </div>

            {/* Log Table */}
            <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg overflow-hidden`}>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className={`bg-${currentTheme.border}/50 text-${currentTheme.textMuted}`}>
                                <th className="text-left py-2 px-3">Date</th>
                                <th className="text-left py-2 px-3">User</th>
                                <th className="text-left py-2 px-3">Action</th>
                                <th className="text-left py-2 px-3">Table</th>
                                <th className="text-left py-2 px-3">Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className={`py-8 text-center text-${currentTheme.textMuted}`}>
                                        No audit logs found
                                    </td>
                                </tr>
                            ) : (
                                logs.map(log => {
                                    const actionInfo = formatAction(log.action)
                                    return (
                                        <tr key={log.id} className={`border-t border-${currentTheme.border}/50 hover:bg-${currentTheme.border}/30`}>
                                            <td className={`py-2 px-3 text-${currentTheme.textMuted} text-xs whitespace-nowrap`}>
                                                {formatDate(log.created_at)}
                                            </td>
                                            <td className={`py-2 px-3 text-${currentTheme.text}`}>
                                                {log.user_email || '-'}
                                            </td>
                                            <td className="py-2 px-3">
                                                <span className={`px-2 py-0.5 bg-${actionInfo.color}-500/20 text-${actionInfo.color}-400 rounded text-xs`}>
                                                    {actionInfo.label}
                                                </span>
                                            </td>
                                            <td className={`py-2 px-3 text-${currentTheme.textMuted}`}>
                                                {log.table_name || '-'}
                                            </td>
                                            <td className={`py-2 px-3 text-${currentTheme.textMuted} text-xs max-w-xs truncate`}>
                                                {log.new_value ? JSON.stringify(log.new_value) : '-'}
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {hasMore && logs.length > 0 && (
                    <div className="p-3 text-center border-t border-slate-700">
                        <button
                            onClick={() => setPage(prev => prev + 1)}
                            className={`px-4 py-2 bg-${currentTheme.border} text-${currentTheme.text} rounded text-sm hover:bg-${currentTheme.card}`}
                        >
                            Load More
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
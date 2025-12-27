'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'
import { useAdminRole } from '../layout'

// Tooltip component
function Tooltip({ text, children }) {
    const [show, setShow] = useState(false)
    const [position, setPosition] = useState({ top: 0, left: 0 })
    const triggerRef = useRef(null)
    const { currentTheme } = useTheme()

    const handleMouseEnter = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect()
            setPosition({
                top: rect.top - 8,
                left: rect.left + rect.width / 2
            })
        }
        setShow(true)
    }

    return (
        <span className="relative inline-block">
            <span
                ref={triggerRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={() => setShow(false)}
                onClick={() => {
                    if (triggerRef.current) {
                        const rect = triggerRef.current.getBoundingClientRect()
                        setPosition({
                            top: rect.top - 8,
                            left: rect.left + rect.width / 2
                        })
                    }
                    setShow(!show)
                }}
                className="cursor-help"
            >
                {children}
            </span>
            {show && (
                <span
                    className={`fixed z-[9999] px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-xs text-white shadow-lg w-48 sm:w-56 -translate-x-1/2 -translate-y-full`}
                    style={{ top: position.top, left: position.left }}
                >
                    {text}
                </span>
            )}
        </span>
    )
}

export default function AuditLogPage() {
    const { currentTheme } = useTheme()
    const { hasAuditLogAccess } = useAdminRole()
    const [loading, setLoading] = useState(true)
    const [currentUser, setCurrentUser] = useState(null)
    const [logs, setLogs] = useState([])
    const [adminUsers, setAdminUsers] = useState([])
    const [stats, setStats] = useState({ total: 0, oldest: null, newest: null })
    const [filters, setFilters] = useState({
        action: '',
        user: '',
        datePreset: 'all',
        dateFrom: '',
        dateTo: ''
    })
    const [page, setPage] = useState(0)
    const [hasMore, setHasMore] = useState(true)
    const [exporting, setExporting] = useState(false)
    const LIMIT = 50

    useEffect(() => {
        checkAccess()
        loadAdminUsers()
    }, [])

    useEffect(() => {
        if (currentUser) {
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

    const loadAdminUsers = async () => {
        try {
            const { data } = await supabase
                .from('users')
                .select('id, email, username, role')
                .eq('is_admin', true)
                .order('email')

            setAdminUsers(data || [])
        } catch (error) {
            console.error('Error loading admin users:', error)
        }
    }

    const getDateRangeFromPreset = (preset) => {
        const now = new Date()
        let dateFrom = ''
        let dateTo = ''

        switch (preset) {
            case 'today':
                dateFrom = now.toISOString().split('T')[0]
                dateTo = dateFrom
                break
            case 'week':
                const weekStart = new Date(now)
                weekStart.setDate(now.getDate() - now.getDay())
                dateFrom = weekStart.toISOString().split('T')[0]
                dateTo = now.toISOString().split('T')[0]
                break
            case 'month':
                dateFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
                dateTo = now.toISOString().split('T')[0]
                break
            case 'all':
            default:
                dateFrom = ''
                dateTo = ''
                break
        }

        return { dateFrom, dateTo }
    }

    const handlePresetChange = (preset) => {
        const { dateFrom, dateTo } = getDateRangeFromPreset(preset)
        setFilters(prev => ({ ...prev, datePreset: preset, dateFrom, dateTo }))
        setPage(0)
    }

    const handleCustomDateChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value, datePreset: 'custom' }))
        setPage(0)
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
                query = query.eq('user_email', filters.user)
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
        setExporting(true)
        try {
            let query = supabase
                .from('admin_audit_log')
                .select('*')
                .order('created_at', { ascending: false })

            if (filters.action) {
                query = query.ilike('action', `%${filters.action}%`)
            }
            if (filters.user) {
                query = query.eq('user_email', filters.user)
            }
            if (filters.dateFrom) {
                query = query.gte('created_at', filters.dateFrom)
            }
            if (filters.dateTo) {
                query = query.lte('created_at', filters.dateTo + 'T23:59:59')
            }

            const { data, error } = await query

            if (error) throw error

            // Convert to CSV
            const headers = ['Date', 'User', 'Action', 'Table', 'Record ID', 'Description', 'Old Value', 'New Value']
            const rows = data.map(log => [
                new Date(log.created_at).toLocaleString(),
                log.user_email || '',
                log.action || '',
                log.table_name || '',
                log.record_id || '',
                log.description || '',
                JSON.stringify(log.old_value || {}),
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
        } finally {
            setExporting(false)
        }
    }

    const clearFilters = () => {
        setFilters({ action: '', user: '', datePreset: 'all', dateFrom: '', dateTo: '' })
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
            // Team/Role actions
            'role_change': { label: 'Role Changed', color: 'purple', icon: '👤' },
            'team_add': { label: 'Added to Team', color: 'green', icon: '➕' },
            'team_remove': { label: 'Removed from Team', color: 'red', icon: '➖' },
            'permission_change': { label: 'Permission Changed', color: 'blue', icon: '🔐' },

            // Settings
            'setting_change': { label: 'Setting Changed', color: 'yellow', icon: '⚙️' },

            // Prizes/Orders
            'prize_update': { label: 'Prize Updated', color: 'orange', icon: '🏆' },
            'order_process': { label: 'Order Processed', color: 'cyan', icon: '📦' },

            // Health Dashboard actions
            'daily_awards_change': { label: 'Daily Awards Changed', color: 'yellow', icon: '🎮' },
            'token_value_change': { label: 'Token Value Changed', color: 'purple', icon: '🪙' },
            'health_fix_applied': { label: 'Health Fix Applied', color: 'green', icon: '🏥' },

            // System
            'logs_deleted': { label: 'Logs Deleted', color: 'red', icon: '🗑️' },
            'login': { label: 'Admin Login', color: 'gray', icon: '🔑' },
            'logout': { label: 'Admin Logout', color: 'gray', icon: '🚪' }
        }
        const mapped = actionMap[action] || { label: action, color: 'gray', icon: '📝' }
        return mapped
    }

    const getDaysSinceOldest = () => {
        if (!stats.oldest) return 0
        const oldest = new Date(stats.oldest)
        const now = new Date()
        return Math.floor((now - oldest) / (1000 * 60 * 60 * 24))
    }

    const getFilteredCount = () => {
        return logs.length + (hasMore ? '+' : '')
    }

    if (loading) {
        return (
            <div className="p-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
            </div>
        )
    }

    if (!hasAuditLogAccess) {
        return (
            <div className="p-4">
                <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 text-red-400">
                    <h2 className="font-bold text-lg mb-2">🚫 Access Denied</h2>
                    <p>You don't have permission to view the Audit Log.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="p-4 overflow-x-hidden">
            <div className="mb-4">
                <h1 className={`text-lg font-bold text-${currentTheme.text}`}>📋 Audit Log</h1>
                <p className={`text-${currentTheme.textMuted} text-xs`}>Track all admin actions and changes</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4 overflow-hidden">
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-2 sm:p-3 min-w-0`}>
                    <div className="flex items-center justify-between">
                        <p className={`text-${currentTheme.textMuted} text-xs`}>Total Entries</p>
                        <Tooltip text="Total number of logged actions in the system">
                            <span className={`text-${currentTheme.textMuted} text-xs cursor-help`}>ℹ️</span>
                        </Tooltip>
                    </div>
                    <p className={`text-${currentTheme.text} text-lg sm:text-xl font-bold truncate`}>{stats.total.toLocaleString()}</p>
                </div>
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-2 sm:p-3 min-w-0`}>
                    <div className="flex items-center justify-between">
                        <p className={`text-${currentTheme.textMuted} text-xs`}>Log Age</p>
                        <Tooltip text="Days since the first logged action">
                            <span className={`text-${currentTheme.textMuted} text-xs cursor-help`}>ℹ️</span>
                        </Tooltip>
                    </div>
                    <p className={`text-${currentTheme.text} text-lg sm:text-xl font-bold truncate`}>{getDaysSinceOldest()}d</p>
                </div>
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-2 sm:p-3 min-w-0`}>
                    <p className={`text-${currentTheme.textMuted} text-xs`}>Oldest Entry</p>
                    <p className={`text-${currentTheme.text} text-xs sm:text-sm font-medium truncate`}>{formatDate(stats.oldest)}</p>
                </div>
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-2 sm:p-3 min-w-0`}>
                    <p className={`text-${currentTheme.textMuted} text-xs`}>Newest Entry</p>
                    <p className={`text-${currentTheme.text} text-xs sm:text-sm font-medium truncate`}>{formatDate(stats.newest)}</p>
                </div>
            </div>

            {/* Date Preset Buttons */}
            <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-3 mb-3 overflow-hidden`}>
                <div className="flex items-center gap-2 mb-2">
                    <p className={`text-${currentTheme.textMuted} text-xs font-medium`}>Quick Range:</p>
                    <Tooltip text="Select a preset time period or use custom dates below">
                        <span className={`text-${currentTheme.textMuted} text-xs cursor-help`}>ℹ️</span>
                    </Tooltip>
                </div>
                <div className="flex flex-wrap gap-2">
                    {[
                        { key: 'today', label: 'Today' },
                        { key: 'week', label: 'This Week' },
                        { key: 'month', label: 'This Month' },
                        { key: 'all', label: 'All Time' }
                    ].map(preset => (
                        <button
                            key={preset.key}
                            onClick={() => handlePresetChange(preset.key)}
                            className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${filters.datePreset === preset.key
                                    ? `bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'}`
                                    : `bg-${currentTheme.border} text-${currentTheme.textMuted} hover:bg-${currentTheme.border}/70`
                                }`}
                        >
                            {preset.label}
                        </button>
                    ))}
                    {filters.datePreset === 'custom' && (
                        <span className={`px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded text-sm font-medium`}>
                            Custom Range
                        </span>
                    )}
                </div>
            </div>

            {/* Filters */}
            <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-3 mb-4 overflow-hidden`}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div>
                        <div className="flex items-center gap-1 mb-1">
                            <label className={`text-${currentTheme.textMuted} text-xs`}>Action Type</label>
                            <Tooltip text="Filter by action type (e.g., role_change, health_fix_applied)">
                                <span className={`text-${currentTheme.textMuted} text-xs cursor-help`}>ℹ️</span>
                            </Tooltip>
                        </div>
                        <select
                            value={filters.action}
                            onChange={(e) => { setFilters({ ...filters, action: e.target.value }); setPage(0); }}
                            className={`w-full px-2 py-1.5 bg-${currentTheme.bg} border border-${currentTheme.border} rounded text-${currentTheme.text} text-sm`}
                        >
                            <option value="">All Actions</option>
                            <optgroup label="Team & Permissions">
                                <option value="role_change">Role Changed</option>
                                <option value="team_add">Added to Team</option>
                                <option value="team_remove">Removed from Team</option>
                                <option value="permission_change">Permission Changed</option>
                            </optgroup>
                            <optgroup label="Health Dashboard">
                                <option value="daily_awards_change">Daily Awards Changed</option>
                                <option value="token_value_change">Token Value Changed</option>
                                <option value="health_fix_applied">Health Fix Applied</option>
                            </optgroup>
                            <optgroup label="Other">
                                <option value="setting_change">Setting Changed</option>
                                <option value="prize_update">Prize Updated</option>
                                <option value="order_process">Order Processed</option>
                            </optgroup>
                        </select>
                    </div>
                    <div>
                        <div className="flex items-center gap-1 mb-1">
                            <label className={`text-${currentTheme.textMuted} text-xs`}>Admin User</label>
                            <Tooltip text="Filter to see actions by a specific admin">
                                <span className={`text-${currentTheme.textMuted} text-xs cursor-help`}>ℹ️</span>
                            </Tooltip>
                        </div>
                        <select
                            value={filters.user}
                            onChange={(e) => { setFilters({ ...filters, user: e.target.value }); setPage(0); }}
                            className={`w-full px-2 py-1.5 bg-${currentTheme.bg} border border-${currentTheme.border} rounded text-${currentTheme.text} text-sm`}
                        >
                            <option value="">All Users</option>
                            {adminUsers.map(user => (
                                <option key={user.id} value={user.email}>
                                    {user.username || user.email}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <div className="flex items-center gap-1 mb-1">
                                <label className={`text-${currentTheme.textMuted} text-xs`}>From</label>
                                <Tooltip text="Custom start date (overrides preset)">
                                    <span className={`text-${currentTheme.textMuted} text-xs cursor-help`}>ℹ️</span>
                                </Tooltip>
                            </div>
                            <input
                                type="date"
                                value={filters.dateFrom}
                                onChange={(e) => handleCustomDateChange('dateFrom', e.target.value)}
                                className={`w-full px-2 py-1.5 bg-${currentTheme.bg} border border-${currentTheme.border} rounded text-${currentTheme.text} text-sm`}
                            />
                        </div>
                        <div>
                            <div className="flex items-center gap-1 mb-1">
                                <label className={`text-${currentTheme.textMuted} text-xs`}>To</label>
                                <Tooltip text="Custom end date (overrides preset)">
                                    <span className={`text-${currentTheme.textMuted} text-xs cursor-help`}>ℹ️</span>
                                </Tooltip>
                            </div>
                            <input
                                type="date"
                                value={filters.dateTo}
                                onChange={(e) => handleCustomDateChange('dateTo', e.target.value)}
                                className={`w-full px-2 py-1.5 bg-${currentTheme.bg} border border-${currentTheme.border} rounded text-${currentTheme.text} text-sm`}
                            />
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                    <button
                        onClick={clearFilters}
                        className={`px-3 py-1.5 bg-${currentTheme.border} text-${currentTheme.textMuted} rounded text-sm hover:bg-${currentTheme.card}`}
                    >
                        Clear All
                    </button>
                    <Tooltip text="Exports ALL entries matching your current filters (not just what's shown on screen)">
                        <button
                            onClick={exportLogs}
                            disabled={exporting}
                            className="px-3 py-1.5 bg-green-500 text-white rounded text-sm hover:bg-green-400 disabled:opacity-50 flex items-center gap-1"
                        >
                            {exporting ? (
                                <>
                                    <span className="animate-spin">⏳</span> Exporting...
                                </>
                            ) : (
                                <>📥 Export CSV</>
                            )}
                        </button>
                    </Tooltip>
                </div>
            </div>

            {/* Results count */}
            <div className={`flex items-center justify-between mb-2`}>
                <p className={`text-${currentTheme.textMuted} text-xs`}>
                    Showing {logs.length}{hasMore ? '+' : ''} entries
                    {filters.datePreset !== 'all' || filters.action || filters.user ? ' (filtered)' : ''}
                </p>
            </div>

            {/* Log Table */}
            <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg overflow-hidden`}>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className={`bg-${currentTheme.border}/50 text-${currentTheme.textMuted}`}>
                                <th className="text-left py-2 px-3 whitespace-nowrap">Date</th>
                                <th className="text-left py-2 px-3 whitespace-nowrap">User</th>
                                <th className="text-left py-2 px-3 whitespace-nowrap">Action</th>
                                <th className="text-left py-2 px-3 whitespace-nowrap">Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className={`py-8 text-center text-${currentTheme.textMuted}`}>
                                        No audit logs found for the selected filters
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
                                            <td className={`py-2 px-3 text-${currentTheme.text} text-sm`}>
                                                {log.user_email || '-'}
                                            </td>
                                            <td className="py-2 px-3 whitespace-nowrap">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 bg-${actionInfo.color}-500/20 text-${actionInfo.color}-400 rounded text-xs`}>
                                                    <span>{actionInfo.icon}</span>
                                                    {actionInfo.label}
                                                </span>
                                            </td>
                                            <td className={`py-2 px-3 text-${currentTheme.text} text-sm`}>
                                                {log.description || (
                                                    <span className={`text-${currentTheme.textMuted} text-xs`}>
                                                        {log.table_name ? `${log.table_name}` : '-'}
                                                        {log.record_id ? ` #${log.record_id}` : ''}
                                                    </span>
                                                )}
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

            {/* Help Section */}
            <div className={`mt-4 p-3 bg-${currentTheme.border}/30 border border-${currentTheme.border} rounded-lg`}>
                <h3 className={`text-${currentTheme.text} text-sm font-medium mb-2`}>💡 Tips</h3>
                <ul className={`text-${currentTheme.textMuted} text-xs space-y-1`}>
                    <li>• <strong>Quick Date Range:</strong> Use preset buttons for fast filtering by time period</li>
                    <li>• <strong>Custom Dates:</strong> Selecting custom dates will override the preset</li>
                    <li>• <strong>Export CSV:</strong> Downloads ALL entries matching your filters (not just what's visible)</li>
                    <li>• <strong>Combining Filters:</strong> All filters work together to narrow results</li>
                </ul>
            </div>
        </div>
    )
}
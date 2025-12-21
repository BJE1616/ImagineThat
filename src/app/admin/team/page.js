'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'

const ROLES = [
    { key: 'super_admin', label: 'Super Admin', color: 'yellow', description: 'Full access to everything including audit logs and financial permissions' },
    { key: 'admin', label: 'Admin', color: 'purple', description: 'Full access except audit logs, team management, and sensitive financials' },
    { key: 'manager', label: 'Manager', color: 'blue', description: 'Can manage prizes, games, orders, and users (not admins)' },
    { key: 'support', label: 'Support', color: 'green', description: 'Can process orders and view users (read-only on most settings)' }
]

const RETENTION_OPTIONS = [
    { days: 30, label: '30 Days' },
    { days: 90, label: '90 Days' },
    { days: 180, label: '6 Months' },
    { days: 365, label: '1 Year' },
    { days: 730, label: '2 Years' },
    { days: 0, label: 'Forever (No Auto-Delete)' }
]

export default function AdminTeamPage() {
    const { currentTheme } = useTheme()
    const [loading, setLoading] = useState(true)
    const [currentUser, setCurrentUser] = useState(null)
    const [teamMembers, setTeamMembers] = useState([])
    const [allUsers, setAllUsers] = useState([])
    const [financialPermissions, setFinancialPermissions] = useState([])
    const [message, setMessage] = useState(null)
    const [activeTab, setActiveTab] = useState('team')
    const [showAddMember, setShowAddMember] = useState(false)
    const [selectedUserId, setSelectedUserId] = useState('')
    const [selectedRole, setSelectedRole] = useState('support')
    const [saving, setSaving] = useState(false)

    // Log retention state
    const [logStats, setLogStats] = useState({ total: 0, oldest: null, sizeEstimate: 0 })
    const [retentionDays, setRetentionDays] = useState(365)
    const [autoCleanup, setAutoCleanup] = useState(false)
    const [logsToDelete, setLogsToDelete] = useState(0)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [deleteConfirmText, setDeleteConfirmText] = useState('')
    const [deleting, setDeleting] = useState(false)

    useEffect(() => {
        loadData()
    }, [])

    useEffect(() => {
        if (activeTab === 'retention' && currentUser?.role === 'super_admin') {
            loadLogStats()
            loadRetentionSettings()
        }
    }, [activeTab, currentUser])

    const loadData = async () => {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data: userData } = await supabase
                    .from('users')
                    .select('id, email, role')
                    .eq('id', user.id)
                    .single()
                setCurrentUser(userData)

                if (userData?.role !== 'super_admin') {
                    setLoading(false)
                    return
                }
            }

            const { data: team } = await supabase
                .from('users')
                .select('id, email, username, first_name, last_name, role, is_admin, created_at')
                .in('role', ['super_admin', 'admin', 'manager', 'support'])
                .order('role')

            setTeamMembers(team || [])

            const { data: users } = await supabase
                .from('users')
                .select('id, email, username, first_name, last_name, role')
                .order('email')

            setAllUsers(users || [])

            const { data: permissions } = await supabase
                .from('admin_financial_permissions')
                .select('*')
                .order('display_order')

            setFinancialPermissions(permissions || [])

        } catch (error) {
            console.error('Error loading data:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadLogStats = async () => {
        try {
            const { count } = await supabase
                .from('admin_audit_log')
                .select('*', { count: 'exact', head: true })

            const { data: oldest } = await supabase
                .from('admin_audit_log')
                .select('created_at')
                .order('created_at', { ascending: true })
                .limit(1)
                .maybeSingle()

            // Estimate size: ~500 bytes per entry
            const sizeEstimate = (count || 0) * 500

            setLogStats({
                total: count || 0,
                oldest: oldest?.created_at,
                sizeEstimate
            })
        } catch (error) {
            console.error('Error loading log stats:', error)
        }
    }

    const loadRetentionSettings = async () => {
        try {
            const { data } = await supabase
                .from('admin_settings')
                .select('setting_key, setting_value')
                .in('setting_key', ['audit_log_retention_days', 'audit_log_auto_cleanup'])

            if (data) {
                const retention = data.find(d => d.setting_key === 'audit_log_retention_days')
                const auto = data.find(d => d.setting_key === 'audit_log_auto_cleanup')

                if (retention) setRetentionDays(parseInt(retention.setting_value) || 365)
                if (auto) setAutoCleanup(auto.setting_value === 'true')
            }
        } catch (error) {
            console.error('Error loading retention settings:', error)
        }
    }

    const saveRetentionSettings = async () => {
        setSaving(true)
        try {
            await supabase
                .from('admin_settings')
                .update({ setting_value: retentionDays.toString() })
                .eq('setting_key', 'audit_log_retention_days')

            await supabase
                .from('admin_settings')
                .update({ setting_value: autoCleanup.toString() })
                .eq('setting_key', 'audit_log_auto_cleanup')

            await logAuditAction('setting_change', 'admin_settings', 'audit_log_retention', { retentionDays, autoCleanup })

            setMessage({ type: 'success', text: 'Retention settings saved!' })
        } catch (error) {
            console.error('Error saving retention settings:', error)
            setMessage({ type: 'error', text: 'Failed to save settings' })
        } finally {
            setSaving(false)
            setTimeout(() => setMessage(null), 3000)
        }
    }

    const checkLogsToDelete = async (days) => {
        if (days === 0) {
            setLogsToDelete(0)
            return
        }

        try {
            const cutoffDate = new Date()
            cutoffDate.setDate(cutoffDate.getDate() - days)

            const { count } = await supabase
                .from('admin_audit_log')
                .select('*', { count: 'exact', head: true })
                .lt('created_at', cutoffDate.toISOString())

            setLogsToDelete(count || 0)
        } catch (error) {
            console.error('Error checking logs to delete:', error)
        }
    }

    const handleRetentionChange = (days) => {
        setRetentionDays(days)
        checkLogsToDelete(days)
    }

    const exportBeforeDelete = async () => {
        try {
            const cutoffDate = new Date()
            cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

            const { data, error } = await supabase
                .from('admin_audit_log')
                .select('*')
                .lt('created_at', cutoffDate.toISOString())
                .order('created_at', { ascending: false })

            if (error) throw error

            const headers = ['Date', 'User', 'Action', 'Table', 'Record ID', 'Old Value', 'New Value', 'Description']
            const rows = data.map(log => [
                new Date(log.created_at).toLocaleString(),
                log.user_email || '',
                log.action || '',
                log.table_name || '',
                log.record_id || '',
                JSON.stringify(log.old_value || {}),
                JSON.stringify(log.new_value || {}),
                log.description || ''
            ])

            const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')

            const blob = new Blob([csv], { type: 'text/csv' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `audit-log-archive-${new Date().toISOString().split('T')[0]}.csv`
            a.click()
            URL.revokeObjectURL(url)

            setMessage({ type: 'success', text: 'Archive exported!' })
        } catch (error) {
            console.error('Error exporting logs:', error)
            setMessage({ type: 'error', text: 'Failed to export' })
        }
    }

    const deleteOldLogs = async () => {
        if (deleteConfirmText !== 'DELETE') {
            setMessage({ type: 'error', text: 'Please type DELETE to confirm' })
            return
        }

        setDeleting(true)
        try {
            const cutoffDate = new Date()
            cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

            const { error } = await supabase
                .from('admin_audit_log')
                .delete()
                .lt('created_at', cutoffDate.toISOString())

            if (error) throw error

            await logAuditAction('logs_deleted', 'admin_audit_log', null, {
                deletedCount: logsToDelete,
                retentionDays,
                cutoffDate: cutoffDate.toISOString()
            })

            setMessage({ type: 'success', text: `${logsToDelete} log entries deleted!` })
            setShowDeleteConfirm(false)
            setDeleteConfirmText('')
            loadLogStats()
            setLogsToDelete(0)
        } catch (error) {
            console.error('Error deleting logs:', error)
            setMessage({ type: 'error', text: 'Failed to delete logs' })
        } finally {
            setDeleting(false)
            setTimeout(() => setMessage(null), 3000)
        }
    }

    const updateUserRole = async (userId, newRole) => {
        if (userId === currentUser?.id && newRole !== 'super_admin') {
            setMessage({ type: 'error', text: "You can't demote yourself!" })
            return
        }

        setSaving(true)
        try {
            const { error } = await supabase
                .from('users')
                .update({
                    role: newRole,
                    is_admin: ['super_admin', 'admin', 'manager', 'support'].includes(newRole),
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId)

            if (error) throw error

            await logAuditAction('role_change', 'users', userId, { newRole })

            setMessage({ type: 'success', text: 'Role updated!' })
            loadData()
        } catch (error) {
            console.error('Error updating role:', error)
            setMessage({ type: 'error', text: 'Failed to update role' })
        } finally {
            setSaving(false)
            setTimeout(() => setMessage(null), 3000)
        }
    }

    const removeFromTeam = async (userId) => {
        if (userId === currentUser?.id) {
            setMessage({ type: 'error', text: "You can't remove yourself!" })
            return
        }

        if (!confirm('Remove this user from the admin team?')) return

        setSaving(true)
        try {
            const { error } = await supabase
                .from('users')
                .update({
                    role: null,
                    is_admin: false,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId)

            if (error) throw error

            await logAuditAction('team_remove', 'users', userId, {})

            setMessage({ type: 'success', text: 'User removed from team' })
            loadData()
        } catch (error) {
            console.error('Error removing user:', error)
            setMessage({ type: 'error', text: 'Failed to remove user' })
        } finally {
            setSaving(false)
            setTimeout(() => setMessage(null), 3000)
        }
    }

    const addTeamMember = async () => {
        if (!selectedUserId) {
            setMessage({ type: 'error', text: 'Please select a user' })
            return
        }

        setSaving(true)
        try {
            const { error } = await supabase
                .from('users')
                .update({
                    role: selectedRole,
                    is_admin: true,
                    updated_at: new Date().toISOString()
                })
                .eq('id', selectedUserId)

            if (error) throw error

            await logAuditAction('team_add', 'users', selectedUserId, { role: selectedRole })

            setMessage({ type: 'success', text: 'Team member added!' })
            setShowAddMember(false)
            setSelectedUserId('')
            setSelectedRole('support')
            loadData()
        } catch (error) {
            console.error('Error adding team member:', error)
            setMessage({ type: 'error', text: 'Failed to add team member' })
        } finally {
            setSaving(false)
            setTimeout(() => setMessage(null), 3000)
        }
    }

    const updateFinancialPermission = async (id, role, value) => {
        setSaving(true)
        try {
            const { error } = await supabase
                .from('admin_financial_permissions')
                .update({
                    [role]: value,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)

            if (error) throw error

            await logAuditAction('permission_change', 'admin_financial_permissions', id, { role, value })

            setFinancialPermissions(prev =>
                prev.map(p => p.id === id ? { ...p, [role]: value } : p)
            )
            setMessage({ type: 'success', text: 'Permission updated!' })
        } catch (error) {
            console.error('Error updating permission:', error)
            setMessage({ type: 'error', text: 'Failed to update permission' })
        } finally {
            setSaving(false)
            setTimeout(() => setMessage(null), 3000)
        }
    }

    const logAuditAction = async (action, tableName, recordId, details) => {
        try {
            await supabase.from('admin_audit_log').insert([{
                user_id: currentUser?.id,
                user_email: currentUser?.email,
                action,
                table_name: tableName,
                record_id: recordId,
                new_value: details,
                description: `${action} on ${tableName}`
            }])
        } catch (error) {
            console.error('Error logging audit:', error)
        }
    }

    const getRoleColor = (role) => {
        const found = ROLES.find(r => r.key === role)
        return found?.color || 'gray'
    }

    const getDisplayName = (user) => {
        if (user.first_name || user.last_name) {
            return `${user.first_name || ''} ${user.last_name || ''}`.trim()
        }
        return user.username || user.email
    }

    const formatBytes = (bytes) => {
        if (bytes < 1024) return bytes + ' B'
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
    }

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A'
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }

    const getDaysSinceOldest = () => {
        if (!logStats.oldest) return 0
        return Math.floor((new Date() - new Date(logStats.oldest)) / (1000 * 60 * 60 * 24))
    }

    const nonTeamUsers = allUsers.filter(u => !u.role || u.role === 'user')

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
                    <p>Only Super Admins can access Team Management.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="p-4">
            <div className="mb-4">
                <h1 className={`text-lg font-bold text-${currentTheme.text}`}>👥 Team Management</h1>
                <p className={`text-${currentTheme.textMuted} text-xs`}>Manage admin roles, permissions, and audit log settings</p>
            </div>

            {message && (
                <div className={`mb-4 p-2 rounded text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {message.text}
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 mb-4 flex-wrap">
                <button
                    onClick={() => setActiveTab('team')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'team'
                        ? `bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'}`
                        : `bg-${currentTheme.border} text-${currentTheme.textMuted}`
                        }`}
                >
                    👥 Team Members
                </button>
                <button
                    onClick={() => setActiveTab('permissions')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'permissions'
                        ? `bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'}`
                        : `bg-${currentTheme.border} text-${currentTheme.textMuted}`
                        }`}
                >
                    🔒 Financial Permissions
                </button>
                <button
                    onClick={() => setActiveTab('retention')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'retention'
                        ? `bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'}`
                        : `bg-${currentTheme.border} text-${currentTheme.textMuted}`
                        }`}
                >
                    🗄️ Log Retention
                </button>
                <button
                    onClick={() => setActiveTab('roles')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'roles'
                        ? `bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'}`
                        : `bg-${currentTheme.border} text-${currentTheme.textMuted}`
                        }`}
                >
                    📋 Role Guide
                </button>
            </div>

            {/* Team Members Tab */}
            {activeTab === 'team' && (
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-3`}>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className={`text-sm font-bold text-${currentTheme.text}`}>Admin Team ({teamMembers.length})</h2>
                        <button
                            onClick={() => setShowAddMember(!showAddMember)}
                            className="px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded hover:bg-green-400"
                        >
                            {showAddMember ? 'Cancel' : '+ Add Member'}
                        </button>
                    </div>

                    {showAddMember && (
                        <div className={`mb-4 p-3 bg-${currentTheme.border}/50 rounded-lg`}>
                            <p className={`text-${currentTheme.text} text-sm font-medium mb-2`}>Add New Team Member</p>
                            <div className="flex gap-2 flex-wrap">
                                <select
                                    value={selectedUserId}
                                    onChange={(e) => setSelectedUserId(e.target.value)}
                                    className={`flex-1 min-w-48 px-3 py-2 bg-${currentTheme.bg} border border-${currentTheme.border} rounded text-${currentTheme.text} text-sm`}
                                >
                                    <option value="">Select a user...</option>
                                    {nonTeamUsers.map(user => {
                                        const displayName = user.first_name || user.last_name
                                            ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                                            : user.username || 'No Name'
                                        return (
                                            <option key={user.id} value={user.id}>
                                                {displayName} - {user.email}
                                            </option>
                                        )
                                    })}
                                </select>
                                <select
                                    value={selectedRole}
                                    onChange={(e) => setSelectedRole(e.target.value)}
                                    className={`px-3 py-2 bg-${currentTheme.bg} border border-${currentTheme.border} rounded text-${currentTheme.text} text-sm`}
                                >
                                    {ROLES.map(role => (
                                        <option key={role.key} value={role.key}>{role.label}</option>
                                    ))}
                                </select>
                                <button
                                    onClick={addTeamMember}
                                    disabled={saving || !selectedUserId}
                                    className="px-4 py-2 bg-green-500 text-white text-sm font-medium rounded hover:bg-green-400 disabled:opacity-50"
                                >
                                    {saving ? '...' : 'Add'}
                                </button>
                            </div>
                        </div>
                    )}

                    <table className="w-full text-sm">
                        <thead>
                            <tr className={`text-${currentTheme.textMuted} border-b border-${currentTheme.border}`}>
                                <th className="text-left py-2">User</th>
                                <th className="text-left py-2">Email</th>
                                <th className="text-left py-2">Role</th>
                                <th className="text-right py-2">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {teamMembers.map(member => (
                                <tr key={member.id} className={`border-b border-${currentTheme.border}/50`}>
                                    <td className={`py-2 text-${currentTheme.text} font-medium`}>
                                        {getDisplayName(member)}
                                        {member.id === currentUser?.id && (
                                            <span className="ml-2 text-yellow-400 text-xs">(You)</span>
                                        )}
                                    </td>
                                    <td className={`py-2 text-${currentTheme.textMuted}`}>{member.email}</td>
                                    <td className="py-2">
                                        <select
                                            value={member.role || ''}
                                            onChange={(e) => updateUserRole(member.id, e.target.value)}
                                            disabled={saving}
                                            className={`px-2 py-1 bg-${getRoleColor(member.role)}-500/20 text-${getRoleColor(member.role)}-400 border border-${getRoleColor(member.role)}-500/50 rounded text-xs font-medium`}
                                        >
                                            {ROLES.map(role => (
                                                <option key={role.key} value={role.key}>{role.label}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="py-2 text-right">
                                        {member.id !== currentUser?.id && (
                                            <button
                                                onClick={() => removeFromTeam(member.id)}
                                                disabled={saving}
                                                className="text-red-400 hover:text-red-300 text-xs"
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Financial Permissions Tab */}
            {activeTab === 'permissions' && (
                <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-3`}>
                    <div className="mb-3">
                        <h2 className={`text-sm font-bold text-${currentTheme.text}`}>Financial Visibility Settings</h2>
                        <p className={`text-${currentTheme.textMuted} text-xs`}>Control which roles can see each financial metric. Super Admin always has access.</p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className={`text-${currentTheme.textMuted} border-b border-${currentTheme.border}`}>
                                    <th className="text-left py-2">Metric</th>
                                    <th className="text-center py-2 px-2">
                                        <span className="text-yellow-400">Super</span>
                                    </th>
                                    <th className="text-center py-2 px-2">
                                        <span className="text-purple-400">Admin</span>
                                    </th>
                                    <th className="text-center py-2 px-2">
                                        <span className="text-blue-400">Manager</span>
                                    </th>
                                    <th className="text-center py-2 px-2">
                                        <span className="text-green-400">Support</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {financialPermissions.map(perm => (
                                    <tr key={perm.id} className={`border-b border-${currentTheme.border}/50`}>
                                        <td className="py-2">
                                            <p className={`text-${currentTheme.text} font-medium`}>{perm.metric_name}</p>
                                            <p className={`text-${currentTheme.textMuted} text-xs`}>{perm.description}</p>
                                        </td>
                                        <td className="text-center py-2">
                                            <input type="checkbox" checked={true} disabled className="w-4 h-4 rounded opacity-50" />
                                        </td>
                                        <td className="text-center py-2">
                                            <input
                                                type="checkbox"
                                                checked={perm.admin}
                                                onChange={(e) => updateFinancialPermission(perm.id, 'admin', e.target.checked)}
                                                disabled={saving}
                                                className="w-4 h-4 rounded cursor-pointer"
                                            />
                                        </td>
                                        <td className="text-center py-2">
                                            <input
                                                type="checkbox"
                                                checked={perm.manager}
                                                onChange={(e) => updateFinancialPermission(perm.id, 'manager', e.target.checked)}
                                                disabled={saving}
                                                className="w-4 h-4 rounded cursor-pointer"
                                            />
                                        </td>
                                        <td className="text-center py-2">
                                            <input
                                                type="checkbox"
                                                checked={perm.support}
                                                onChange={(e) => updateFinancialPermission(perm.id, 'support', e.target.checked)}
                                                disabled={saving}
                                                className="w-4 h-4 rounded cursor-pointer"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Log Retention Tab */}
            {activeTab === 'retention' && (
                <div className="space-y-4">
                    {/* Log Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-3`}>
                            <p className={`text-${currentTheme.textMuted} text-xs`}>Total Log Entries</p>
                            <p className={`text-${currentTheme.text} text-xl font-bold`}>{logStats.total.toLocaleString()}</p>
                        </div>
                        <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-3`}>
                            <p className={`text-${currentTheme.textMuted} text-xs`}>Estimated Size</p>
                            <p className={`text-${currentTheme.text} text-xl font-bold`}>{formatBytes(logStats.sizeEstimate)}</p>
                        </div>
                        <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-3`}>
                            <p className={`text-${currentTheme.textMuted} text-xs`}>Log Age</p>
                            <p className={`text-${currentTheme.text} text-xl font-bold`}>{getDaysSinceOldest()} days</p>
                        </div>
                        <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-3`}>
                            <p className={`text-${currentTheme.textMuted} text-xs`}>Oldest Entry</p>
                            <p className={`text-${currentTheme.text} text-sm font-medium`}>{formatDate(logStats.oldest)}</p>
                        </div>
                    </div>

                    {/* Retention Settings */}
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-4`}>
                        <h2 className={`text-sm font-bold text-${currentTheme.text} mb-3`}>📅 Retention Settings</h2>

                        <div className="mb-4">
                            <label className={`block text-${currentTheme.textMuted} text-xs mb-2`}>Keep logs for:</label>
                            <div className="flex flex-wrap gap-2">
                                {RETENTION_OPTIONS.map(opt => (
                                    <button
                                        key={opt.days}
                                        onClick={() => handleRetentionChange(opt.days)}
                                        className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${retentionDays === opt.days
                                            ? `bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'}`
                                            : `bg-${currentTheme.border} text-${currentTheme.textMuted} hover:bg-${currentTheme.card}`
                                            }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={autoCleanup}
                                    onChange={(e) => setAutoCleanup(e.target.checked)}
                                    className="w-4 h-4 rounded"
                                />
                                <span className={`text-${currentTheme.text} text-sm`}>Enable automatic cleanup (runs weekly)</span>
                            </label>
                            <p className={`text-${currentTheme.textMuted} text-xs mt-1 ml-6`}>
                                Automatically deletes logs older than the retention period every Sunday at midnight.
                            </p>
                        </div>

                        <button
                            onClick={saveRetentionSettings}
                            disabled={saving}
                            className={`px-4 py-2 bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'} text-sm font-bold rounded hover:opacity-90 disabled:opacity-50`}
                        >
                            {saving ? 'Saving...' : 'Save Retention Settings'}
                        </button>
                    </div>

                    {/* Manual Cleanup */}
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-4`}>
                        <h2 className={`text-sm font-bold text-${currentTheme.text} mb-3`}>🗑️ Manual Cleanup</h2>

                        {logsToDelete > 0 && retentionDays > 0 && (
                            <div className="mb-4 p-3 bg-yellow-500/20 border border-yellow-500/50 rounded-lg">
                                <p className="text-yellow-400 text-sm font-medium">
                                    ⚠️ {logsToDelete.toLocaleString()} log entries are older than {retentionDays} days
                                </p>
                                <p className={`text-${currentTheme.textMuted} text-xs mt-1`}>
                                    These will be deleted if you proceed with manual cleanup.
                                </p>
                            </div>
                        )}

                        {retentionDays === 0 && (
                            <div className="mb-4 p-3 bg-blue-500/20 border border-blue-500/50 rounded-lg">
                                <p className="text-blue-400 text-sm">
                                    ℹ️ Retention is set to "Forever" - no logs will be auto-deleted.
                                </p>
                            </div>
                        )}

                        <div className="flex gap-2 flex-wrap">
                            <button
                                onClick={exportBeforeDelete}
                                disabled={logsToDelete === 0 || retentionDays === 0}
                                className="px-4 py-2 bg-green-500 text-white text-sm font-medium rounded hover:bg-green-400 disabled:opacity-50"
                            >
                                📥 Export Old Logs First
                            </button>
                            <button
                                onClick={() => { checkLogsToDelete(retentionDays); setShowDeleteConfirm(true); }}
                                disabled={logsToDelete === 0 || retentionDays === 0}
                                className="px-4 py-2 bg-red-500 text-white text-sm font-medium rounded hover:bg-red-400 disabled:opacity-50"
                            >
                                🗑️ Delete Old Logs
                            </button>
                        </div>
                    </div>

                    {/* Delete Confirmation Modal */}
                    {showDeleteConfirm && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
                            <div className={`bg-${currentTheme.card} border border-red-500 rounded-lg p-6 max-w-md w-full`}>
                                <h3 className="text-red-400 font-bold text-lg mb-3">⚠️ Confirm Deletion</h3>

                                <div className="mb-4 p-3 bg-red-500/20 rounded-lg">
                                    <p className={`text-${currentTheme.text} text-sm mb-2`}>
                                        You are about to permanently delete:
                                    </p>
                                    <p className="text-red-400 text-2xl font-bold">
                                        {logsToDelete.toLocaleString()} log entries
                                    </p>
                                    <p className={`text-${currentTheme.textMuted} text-xs mt-2`}>
                                        This action cannot be undone. Make sure you've exported the logs if needed for accounting.
                                    </p>
                                </div>

                                <div className="mb-4">
                                    <label className={`block text-${currentTheme.textMuted} text-xs mb-1`}>
                                        Type DELETE to confirm:
                                    </label>
                                    <input
                                        type="text"
                                        value={deleteConfirmText}
                                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                                        placeholder="DELETE"
                                        className={`w-full px-3 py-2 bg-${currentTheme.bg} border border-${currentTheme.border} rounded text-${currentTheme.text}`}
                                    />
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}
                                        className={`flex-1 px-4 py-2 bg-${currentTheme.border} text-${currentTheme.text} rounded font-medium`}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={deleteOldLogs}
                                        disabled={deleting || deleteConfirmText !== 'DELETE'}
                                        className="flex-1 px-4 py-2 bg-red-500 text-white rounded font-medium disabled:opacity-50"
                                    >
                                        {deleting ? 'Deleting...' : 'Delete Permanently'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Role Guide Tab */}
            {activeTab === 'roles' && (
                <div className="space-y-3">
                    {ROLES.map(role => (
                        <div key={role.key} className={`bg-${currentTheme.card} border border-${role.color}-500/50 rounded-lg p-3`}>
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`px-2 py-1 bg-${role.color}-500/20 text-${role.color}-400 rounded text-xs font-bold`}>
                                    {role.label}
                                </span>
                            </div>
                            <p className={`text-${currentTheme.text} text-sm mb-2`}>{role.description}</p>
                            <div className={`text-${currentTheme.textMuted} text-xs`}>
                                {role.key === 'super_admin' && (
                                    <ul className="list-disc list-inside space-y-1">
                                        <li>✅ Full access to all admin pages</li>
                                        <li>✅ View and manage audit logs</li>
                                        <li>✅ Manage team roles and permissions</li>
                                        <li>✅ Access all financial data including ownership splits</li>
                                        <li>✅ Configure financial visibility for other roles</li>
                                    </ul>
                                )}
                                {role.key === 'admin' && (
                                    <ul className="list-disc list-inside space-y-1">
                                        <li>✅ Access most admin pages</li>
                                        <li>✅ Manage prizes, games, orders, users</li>
                                        <li>✅ View financial data (based on permissions)</li>
                                        <li>❌ Cannot access audit logs</li>
                                        <li>❌ Cannot manage team roles</li>
                                        <li>❌ Cannot see ownership/profit splits (by default)</li>
                                    </ul>
                                )}
                                {role.key === 'manager' && (
                                    <ul className="list-disc list-inside space-y-1">
                                        <li>✅ Manage prizes and game settings</li>
                                        <li>✅ Process orders and manage merch</li>
                                        <li>✅ Add/edit regular users (not admins)</li>
                                        <li>✅ View basic stats</li>
                                        <li>❌ Cannot access financial details</li>
                                        <li>❌ Cannot change platform settings</li>
                                    </ul>
                                )}
                                {role.key === 'support' && (
                                    <ul className="list-disc list-inside space-y-1">
                                        <li>✅ Process orders and shipments</li>
                                        <li>✅ View user information</li>
                                        <li>✅ View basic dashboard</li>
                                        <li>❌ Read-only access to most areas</li>
                                        <li>❌ Cannot change any settings</li>
                                        <li>❌ Cannot access financial data</li>
                                    </ul>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
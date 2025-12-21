'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'
import { useAdminRole } from '../layout'

export default function AdminUsersPage() {
    const { currentTheme } = useTheme()
    const { role: userRole } = useAdminRole()

    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState('all')
    const [selectedUser, setSelectedUser] = useState(null)
    const [userStats, setUserStats] = useState({})
    const [stats, setStats] = useState({
        total: 0,
        active: 0,
        disabled: 0,
        newThisWeek: 0
    })
    const [showAddModal, setShowAddModal] = useState(false)
    const [addingUser, setAddingUser] = useState(false)
    const [addError, setAddError] = useState('')
    const [addSuccess, setAddSuccess] = useState('')
    const [newUser, setNewUser] = useState({
        username: '',
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        phone: '',
        isAdmin: false,
        emailVerified: true
    })

    const [editMode, setEditMode] = useState(null)
    const [editData, setEditData] = useState({})
    const [editLoading, setEditLoading] = useState(false)
    const [editMessage, setEditMessage] = useState({ type: '', text: '' })

    // Permission checks
    const canResetPassword = ['super_admin', 'admin'].includes(userRole)
    const canEditEmail = ['super_admin', 'admin'].includes(userRole)
    const canEditDetails = ['super_admin', 'admin', 'manager'].includes(userRole)
    const canDisableUsers = ['super_admin', 'admin'].includes(userRole)
    const canManageAdmins = ['super_admin', 'admin'].includes(userRole)
    const canAddUsers = ['super_admin', 'admin', 'manager'].includes(userRole)
    const canToggleAdminOnUser = (targetUser) => {
        // Only super_admin can toggle admin status on other admins
        if (targetUser.is_admin && userRole !== 'super_admin') return false
        // Only super_admin and admin can manage admin status
        return ['super_admin', 'admin'].includes(userRole)
    }
    const canDisableUser = (targetUser) => {
        // Can't disable admins unless you're super_admin
        if (targetUser.is_admin && userRole !== 'super_admin') return false
        return ['super_admin', 'admin'].includes(userRole)
    }

    const formatPhone = (value) => {
        const numbers = value.replace(/\D/g, '').slice(0, 10)
        if (numbers.length <= 3) return numbers
        if (numbers.length <= 6) return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`
        return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6)}`
    }

    useEffect(() => {
        loadUsers()
    }, [search, filter])

    const loadUsers = async () => {
        setLoading(true)
        try {
            let query = supabase
                .from('users')
                .select('*')
                .order('created_at', { ascending: false })

            if (search) {
                query = query.or(`username.ilike.%${search}%,email.ilike.%${search}%,first_name.ilike.%${search}%`)
            }

            if (filter === 'disabled') {
                query = query.eq('is_disabled', true)
            } else if (filter === 'active') {
                query = query.or('is_disabled.is.null,is_disabled.eq.false')
            }

            const { data, error } = await query.limit(100)
            if (error) throw error
            setUsers(data || [])

            const { data: allUsers } = await supabase
                .from('users')
                .select('id, is_disabled, created_at')

            if (allUsers) {
                const weekAgo = new Date()
                weekAgo.setDate(weekAgo.getDate() - 7)
                setStats({
                    total: allUsers.length,
                    active: allUsers.filter(u => !u.is_disabled).length,
                    disabled: allUsers.filter(u => u.is_disabled).length,
                    newThisWeek: allUsers.filter(u => new Date(u.created_at) >= weekAgo).length
                })
            }
        } catch (error) {
            console.error('Error loading users:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadUserStats = async (userId) => {
        try {
            const { data: games, count: totalGames } = await supabase
                .from('leaderboard')
                .select('*', { count: 'exact' })
                .eq('user_id', userId)
                .order('score', { ascending: true })

            const bestScore = games?.[0]?.score || null
            const averageScore = games?.length
                ? Math.round(games.reduce((sum, g) => sum + g.score, 0) / games.length)
                : null

            setUserStats(prev => ({
                ...prev,
                [userId]: { totalGames: totalGames || 0, bestScore, averageScore }
            }))
        } catch (error) {
            console.error('Error loading user stats:', error)
        }
    }

    const toggleUserStatus = async (user) => {
        if (!canDisableUser(user)) {
            setEditMessage({ type: 'error', text: 'You do not have permission to disable this user' })
            return
        }

        const newStatus = !user.is_disabled
        try {
            const { error } = await supabase
                .from('users')
                .update({ is_disabled: newStatus })
                .eq('id', user.id)
            if (error) throw error
            setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_disabled: newStatus } : u))
            if (selectedUser?.id === user.id) {
                setSelectedUser({ ...selectedUser, is_disabled: newStatus })
            }

            // Log audit action
            await supabase.from('admin_audit_log').insert([{
                user_email: (await supabase.auth.getUser()).data.user?.email,
                action: newStatus ? 'user_disabled' : 'user_enabled',
                table_name: 'users',
                record_id: user.id,
                new_value: { is_disabled: newStatus },
                description: `${newStatus ? 'Disabled' : 'Enabled'} user ${user.email}`
            }])
        } catch (error) {
            console.error('Error updating user:', error)
        }
    }

    const toggleAdminStatus = async (user) => {
        if (!canToggleAdminOnUser(user)) {
            setEditMessage({ type: 'error', text: 'You do not have permission to change admin status for this user' })
            return
        }

        const newStatus = !user.is_admin
        try {
            const { error } = await supabase
                .from('users')
                .update({
                    is_admin: newStatus,
                    role: newStatus ? 'admin' : 'user'
                })
                .eq('id', user.id)
            if (error) throw error
            setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_admin: newStatus, role: newStatus ? 'admin' : 'user' } : u))
            if (selectedUser?.id === user.id) {
                setSelectedUser({ ...selectedUser, is_admin: newStatus, role: newStatus ? 'admin' : 'user' })
            }

            // Log audit action
            await supabase.from('admin_audit_log').insert([{
                user_email: (await supabase.auth.getUser()).data.user?.email,
                action: newStatus ? 'admin_granted' : 'admin_revoked',
                table_name: 'users',
                record_id: user.id,
                new_value: { is_admin: newStatus },
                description: `${newStatus ? 'Granted' : 'Revoked'} admin for ${user.email}`
            }])
        } catch (error) {
            console.error('Error updating admin status:', error)
        }
    }

    const handleAddUser = async () => {
        setAddError('')
        setAddSuccess('')
        setAddingUser(true)

        try {
            const response = await fetch('/api/admin/create-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newUser)
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || 'Failed to create user')
            }

            setAddSuccess(`User "${result.user.username}" created successfully!`)
            setNewUser({
                username: '',
                email: '',
                password: '',
                firstName: '',
                lastName: '',
                phone: '',
                isAdmin: false,
                emailVerified: true
            })
            loadUsers()

            // Log audit action
            await supabase.from('admin_audit_log').insert([{
                user_email: (await supabase.auth.getUser()).data.user?.email,
                action: 'user_created',
                table_name: 'users',
                record_id: result.user.id,
                new_value: { username: result.user.username, email: result.user.email },
                description: `Created user ${result.user.email}`
            }])

            setTimeout(() => {
                setShowAddModal(false)
                setAddSuccess('')
            }, 1500)

        } catch (error) {
            setAddError(error.message)
        } finally {
            setAddingUser(false)
        }
    }

    const startEdit = (mode) => {
        // Check permissions
        if (mode === 'password' && !canResetPassword) return
        if (mode === 'email' && !canEditEmail) return
        if (mode === 'details' && !canEditDetails) return

        setEditMode(mode)
        setEditMessage({ type: '', text: '' })
        if (mode === 'password') {
            setEditData({ password: '' })
        } else if (mode === 'email') {
            setEditData({ email: selectedUser.email })
        } else if (mode === 'details') {
            setEditData({
                firstName: selectedUser.first_name || '',
                lastName: selectedUser.last_name || '',
                phone: selectedUser.phone || ''
            })
        }
    }

    const cancelEdit = () => {
        setEditMode(null)
        setEditData({})
        setEditMessage({ type: '', text: '' })
    }

    const saveEdit = async () => {
        setEditLoading(true)
        setEditMessage({ type: '', text: '' })

        try {
            const response = await fetch('/api/admin/update-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: editMode === 'password' ? 'reset-password' : editMode === 'email' ? 'update-email' : 'update-details',
                    userId: selectedUser.id,
                    data: editData
                })
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || 'Failed to update')
            }

            setEditMessage({ type: 'success', text: result.message })

            // Log audit action
            await supabase.from('admin_audit_log').insert([{
                user_email: (await supabase.auth.getUser()).data.user?.email,
                action: editMode === 'password' ? 'password_reset' : editMode === 'email' ? 'email_changed' : 'details_updated',
                table_name: 'users',
                record_id: selectedUser.id,
                new_value: editMode === 'password' ? { password: '***' } : editData,
                description: `${editMode} updated for ${selectedUser.email}`
            }])

            if (editMode === 'email') {
                setSelectedUser({ ...selectedUser, email: editData.email })
                setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, email: editData.email } : u))
            } else if (editMode === 'details') {
                setSelectedUser({
                    ...selectedUser,
                    first_name: editData.firstName,
                    last_name: editData.lastName,
                    phone: editData.phone
                })
                setUsers(prev => prev.map(u => u.id === selectedUser.id ? {
                    ...u,
                    first_name: editData.firstName,
                    last_name: editData.lastName,
                    phone: editData.phone
                } : u))
            }

            setTimeout(() => {
                cancelEdit()
            }, 1500)

        } catch (error) {
            setEditMessage({ type: 'error', text: error.message })
        } finally {
            setEditLoading(false)
        }
    }

    const formatDate = (dateString) => {
        if (!dateString) return '—'
        return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
    }

    const openUserDetails = (user) => {
        setSelectedUser(user)
        setEditMode(null)
        setEditMessage({ type: '', text: '' })
        if (!userStats[user.id]) loadUserStats(user.id)
    }

    if (loading && users.length === 0) {
        return (
            <div className="p-4">
                <div className="animate-pulse space-y-3">
                    <div className={`h-6 bg-${currentTheme.border} rounded w-48`}></div>
                    <div className={`h-64 bg-${currentTheme.card} rounded`}></div>
                </div>
            </div>
        )
    }

    return (
        <div className="p-4">
            {showAddModal && canAddUsers && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className={`bg-${currentTheme.card} border border-${currentTheme.border} rounded-lg p-4 w-full max-w-md mx-4`}>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className={`text-sm font-bold text-${currentTheme.text}`}>Quick Add User</h3>
                            <button onClick={() => setShowAddModal(false)} className={`text-${currentTheme.textMuted} hover:text-${currentTheme.text}`}>✕</button>
                        </div>

                        {addError && (
                            <div className="mb-3 px-2 py-1.5 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-xs">
                                {addError}
                            </div>
                        )}

                        {addSuccess && (
                            <div className="mb-3 px-2 py-1.5 bg-green-500/10 border border-green-500/30 rounded text-green-400 text-xs">
                                {addSuccess}
                            </div>
                        )}

                        <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className={`block text-[10px] text-${currentTheme.textMuted} mb-0.5`}>First Name</label>
                                    <input
                                        type="text"
                                        value={newUser.firstName}
                                        onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                                        className={`w-full px-2 py-1.5 text-xs bg-${currentTheme.border} border border-${currentTheme.border} rounded text-${currentTheme.text} focus:outline-none focus:ring-1 focus:ring-${currentTheme.accent}`}
                                        placeholder="First"
                                    />
                                </div>
                                <div>
                                    <label className={`block text-[10px] text-${currentTheme.textMuted} mb-0.5`}>Last Name</label>
                                    <input
                                        type="text"
                                        value={newUser.lastName}
                                        onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                                        className={`w-full px-2 py-1.5 text-xs bg-${currentTheme.border} border border-${currentTheme.border} rounded text-${currentTheme.text} focus:outline-none focus:ring-1 focus:ring-${currentTheme.accent}`}
                                        placeholder="Last"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className={`block text-[10px] text-${currentTheme.textMuted} mb-0.5`}>Username *</label>
                                <input
                                    type="text"
                                    value={newUser.username}
                                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                                    className={`w-full px-2 py-1.5 text-xs bg-${currentTheme.border} border border-${currentTheme.border} rounded text-${currentTheme.text} focus:outline-none focus:ring-1 focus:ring-${currentTheme.accent}`}
                                    placeholder="username"
                                />
                            </div>

                            <div>
                                <label className={`block text-[10px] text-${currentTheme.textMuted} mb-0.5`}>Email *</label>
                                <input
                                    type="email"
                                    value={newUser.email}
                                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                    className={`w-full px-2 py-1.5 text-xs bg-${currentTheme.border} border border-${currentTheme.border} rounded text-${currentTheme.text} focus:outline-none focus:ring-1 focus:ring-${currentTheme.accent}`}
                                    placeholder="email@example.com"
                                />
                            </div>

                            <div>
                                <label className={`block text-[10px] text-${currentTheme.textMuted} mb-0.5`}>Password *</label>
                                <input
                                    type="text"
                                    value={newUser.password}
                                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                    className={`w-full px-2 py-1.5 text-xs bg-${currentTheme.border} border border-${currentTheme.border} rounded text-${currentTheme.text} focus:outline-none focus:ring-1 focus:ring-${currentTheme.accent}`}
                                    placeholder="password123"
                                />
                            </div>

                            <div>
                                <label className={`block text-[10px] text-${currentTheme.textMuted} mb-0.5`}>Phone</label>
                                <input
                                    type="text"
                                    value={newUser.phone}
                                    onChange={(e) => setNewUser({ ...newUser, phone: formatPhone(e.target.value) })}
                                    className={`w-full px-2 py-1.5 text-xs bg-${currentTheme.border} border border-${currentTheme.border} rounded text-${currentTheme.text} focus:outline-none focus:ring-1 focus:ring-${currentTheme.accent}`}
                                    placeholder="(555) 123-4567"
                                />
                            </div>

                            {/* Only show admin toggle for super_admin and admin */}
                            {canManageAdmins && (
                                <div className="flex gap-4 pt-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <button
                                            type="button"
                                            onClick={() => setNewUser({ ...newUser, isAdmin: !newUser.isAdmin })}
                                            className={`w-8 h-4 rounded-full transition-colors ${newUser.isAdmin ? `bg-${currentTheme.accent}` : `bg-${currentTheme.border}`}`}
                                        >
                                            <div className={`w-3 h-3 bg-white rounded-full transition-transform ${newUser.isAdmin ? 'translate-x-4' : 'translate-x-0.5'}`}></div>
                                        </button>
                                        <span className={`text-xs text-${currentTheme.textMuted}`}>Make Admin</span>
                                    </label>

                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <button
                                            type="button"
                                            onClick={() => setNewUser({ ...newUser, emailVerified: !newUser.emailVerified })}
                                            className={`w-8 h-4 rounded-full transition-colors ${newUser.emailVerified ? 'bg-green-500' : `bg-${currentTheme.border}`}`}
                                        >
                                            <div className={`w-3 h-3 bg-white rounded-full transition-transform ${newUser.emailVerified ? 'translate-x-4' : 'translate-x-0.5'}`}></div>
                                        </button>
                                        <span className={`text-xs text-${currentTheme.textMuted}`}>Email Verified</span>
                                    </label>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2 mt-4">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className={`flex-1 py-1.5 bg-${currentTheme.border} text-${currentTheme.textMuted} text-xs font-medium rounded hover:bg-${currentTheme.card}`}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddUser}
                                disabled={addingUser || !newUser.username || !newUser.email || !newUser.password}
                                className={`flex-1 py-1.5 bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'} text-xs font-bold rounded hover:bg-${currentTheme.accentHover} disabled:opacity-50`}
                            >
                                {addingUser ? 'Creating...' : 'Create User'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className={`text-lg font-bold text-${currentTheme.text}`}>User Management</h1>
                    <p className={`text-${currentTheme.textMuted} text-xs`}>
                        View {canEditDetails ? 'and manage ' : ''}user accounts
                        {userRole === 'support' && <span className="ml-2 text-yellow-400">(View Only)</span>}
                    </p>
                </div>
                {canAddUsers && (
                    <button
                        onClick={() => setShowAddModal(true)}
                        className={`px-3 py-1.5 bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'} text-xs font-bold rounded hover:bg-${currentTheme.accentHover}`}
                    >
                        + Add User
                    </button>
                )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                <div className="bg-blue-500/10 border border-blue-500/20 rounded p-3">
                    <p className={`text-${currentTheme.textMuted} text-xs`}>Total Users</p>
                    <p className="text-xl font-bold text-blue-400">{stats.total}</p>
                </div>
                <div className="bg-green-500/10 border border-green-500/20 rounded p-3">
                    <p className={`text-${currentTheme.textMuted} text-xs`}>Active</p>
                    <p className="text-xl font-bold text-green-400">{stats.active}</p>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded p-3">
                    <p className={`text-${currentTheme.textMuted} text-xs`}>Disabled</p>
                    <p className="text-xl font-bold text-red-400">{stats.disabled}</p>
                </div>
                <div className="bg-purple-500/10 border border-purple-500/20 rounded p-3">
                    <p className={`text-${currentTheme.textMuted} text-xs`}>New This Week</p>
                    <p className="text-xl font-bold text-purple-400">{stats.newThisWeek}</p>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-2 mb-3">
                <div className="flex-1">
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by username, email, or name..."
                        className={`w-full px-3 py-1.5 text-sm bg-${currentTheme.card} border border-${currentTheme.border} rounded text-${currentTheme.text} placeholder-${currentTheme.textMuted} focus:outline-none focus:ring-1 focus:ring-${currentTheme.accent}`}
                    />
                </div>
                <div className="flex gap-1">
                    {['all', 'active', 'disabled'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setFilter(tab)}
                            className={`px-3 py-1.5 rounded text-sm font-medium capitalize transition-all ${filter === tab ? `bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'}` : `bg-${currentTheme.border} text-${currentTheme.textMuted} hover:bg-${currentTheme.card}`}`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex gap-3">
                <div className={`${selectedUser ? 'w-2/3' : 'w-full'} bg-${currentTheme.card} border border-${currentTheme.border} rounded overflow-hidden transition-all`}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className={`border-b border-${currentTheme.border}`}>
                                    <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>User</th>
                                    <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Email</th>
                                    <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Joined</th>
                                    <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Status</th>
                                    {canDisableUsers && (
                                        <th className={`text-left py-2 px-3 text-${currentTheme.textMuted} font-medium text-xs`}>Actions</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {users.length > 0 ? users.map(user => (
                                    <tr
                                        key={user.id}
                                        onClick={() => openUserDetails(user)}
                                        className={`border-b border-${currentTheme.border}/50 hover:bg-${currentTheme.border}/30 cursor-pointer ${selectedUser?.id === user.id ? `bg-${currentTheme.border}/50` : ''}`}
                                    >
                                        <td className="py-2 px-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                                                    {user.username?.charAt(0).toUpperCase() || '?'}
                                                </div>
                                                <div>
                                                    <p className={`text-${currentTheme.text} font-medium text-xs`}>{user.username}</p>
                                                    {user.first_name && <p className={`text-${currentTheme.textMuted} text-[10px]`}>{user.first_name} {user.last_name}</p>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className={`py-2 px-3 text-${currentTheme.textMuted} text-xs`}>{user.email}</td>
                                        <td className={`py-2 px-3 text-${currentTheme.textMuted} text-xs`}>{formatDate(user.created_at)}</td>
                                        <td className="py-2 px-3">
                                            <div className="flex items-center gap-1">
                                                {user.is_admin && <span className={`px-1.5 py-0.5 bg-${currentTheme.accent}/20 text-${currentTheme.accent} text-[10px] font-medium rounded-full`}>Admin</span>}
                                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${user.is_disabled ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                                                    {user.is_disabled ? 'Disabled' : 'Active'}
                                                </span>
                                            </div>
                                        </td>
                                        {canDisableUsers && (
                                            <td className="py-2 px-3">
                                                {canDisableUser(user) && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); toggleUserStatus(user) }}
                                                        className={`px-2 py-1 rounded text-xs font-medium ${user.is_disabled ? 'bg-green-600 text-white hover:bg-green-500' : 'bg-red-600/80 text-white hover:bg-red-500'}`}
                                                    >
                                                        {user.is_disabled ? 'Enable' : 'Disable'}
                                                    </button>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                )) : (
                                    <tr><td colSpan={canDisableUsers ? 5 : 4} className={`py-8 text-center text-${currentTheme.textMuted} text-sm`}>No users found</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {selectedUser && (
                    <div className={`w-1/3 bg-${currentTheme.card} border border-${currentTheme.border} rounded p-3`}>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className={`text-sm font-bold text-${currentTheme.text}`}>User Details</h3>
                            <button onClick={() => setSelectedUser(null)} className={`text-${currentTheme.textMuted} hover:text-${currentTheme.text} text-sm`}>✕</button>
                        </div>

                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                                {selectedUser.username?.charAt(0).toUpperCase() || '?'}
                            </div>
                            <div>
                                <p className={`text-${currentTheme.text} font-bold text-sm`}>{selectedUser.username}</p>
                                <p className={`text-${currentTheme.textMuted} text-xs`}>{selectedUser.email}</p>
                            </div>
                        </div>

                        {editMessage.text && (
                            <div className={`mb-2 px-2 py-1.5 rounded text-xs ${editMessage.type === 'error' ? 'bg-red-500/10 border border-red-500/30 text-red-400' : 'bg-green-500/10 border border-green-500/30 text-green-400'}`}>
                                {editMessage.text}
                            </div>
                        )}

                        {editMode === 'password' && canResetPassword && (
                            <div className={`mb-3 p-2 bg-${currentTheme.border}/50 rounded`}>
                                <label className={`block text-[10px] text-${currentTheme.textMuted} mb-1`}>New Password</label>
                                <input
                                    type="text"
                                    value={editData.password}
                                    onChange={(e) => setEditData({ password: e.target.value })}
                                    className={`w-full px-2 py-1.5 text-xs bg-${currentTheme.border} border border-${currentTheme.border} rounded text-${currentTheme.text} mb-2`}
                                    placeholder="Enter new password"
                                />
                                <div className="flex gap-1">
                                    <button onClick={cancelEdit} className={`flex-1 py-1 bg-${currentTheme.border} text-${currentTheme.text} text-xs rounded`}>Cancel</button>
                                    <button onClick={saveEdit} disabled={editLoading || !editData.password} className={`flex-1 py-1 bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'} text-xs font-bold rounded disabled:opacity-50`}>
                                        {editLoading ? '...' : 'Save'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {editMode === 'email' && canEditEmail && (
                            <div className={`mb-3 p-2 bg-${currentTheme.border}/50 rounded`}>
                                <label className={`block text-[10px] text-${currentTheme.textMuted} mb-1`}>Email Address</label>
                                <input
                                    type="email"
                                    value={editData.email}
                                    onChange={(e) => setEditData({ email: e.target.value })}
                                    className={`w-full px-2 py-1.5 text-xs bg-${currentTheme.border} border border-${currentTheme.border} rounded text-${currentTheme.text} mb-2`}
                                />
                                <div className="flex gap-1">
                                    <button onClick={cancelEdit} className={`flex-1 py-1 bg-${currentTheme.border} text-${currentTheme.text} text-xs rounded`}>Cancel</button>
                                    <button onClick={saveEdit} disabled={editLoading || !editData.email} className={`flex-1 py-1 bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'} text-xs font-bold rounded disabled:opacity-50`}>
                                        {editLoading ? '...' : 'Save'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {editMode === 'details' && canEditDetails && (
                            <div className={`mb-3 p-2 bg-${currentTheme.border}/50 rounded space-y-2`}>
                                <div>
                                    <label className={`block text-[10px] text-${currentTheme.textMuted} mb-0.5`}>First Name</label>
                                    <input
                                        type="text"
                                        value={editData.firstName}
                                        onChange={(e) => setEditData({ ...editData, firstName: e.target.value })}
                                        className={`w-full px-2 py-1 text-xs bg-${currentTheme.border} border border-${currentTheme.border} rounded text-${currentTheme.text}`}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-[10px] text-${currentTheme.textMuted} mb-0.5`}>Last Name</label>
                                    <input
                                        type="text"
                                        value={editData.lastName}
                                        onChange={(e) => setEditData({ ...editData, lastName: e.target.value })}
                                        className={`w-full px-2 py-1 text-xs bg-${currentTheme.border} border border-${currentTheme.border} rounded text-${currentTheme.text}`}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-[10px] text-${currentTheme.textMuted} mb-0.5`}>Phone</label>
                                    <input
                                        type="text"
                                        value={editData.phone}
                                        onChange={(e) => setEditData({ ...editData, phone: formatPhone(e.target.value) })}
                                        className={`w-full px-2 py-1 text-xs bg-${currentTheme.border} border border-${currentTheme.border} rounded text-${currentTheme.text}`}
                                    />
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={cancelEdit} className={`flex-1 py-1 bg-${currentTheme.border} text-${currentTheme.text} text-xs rounded`}>Cancel</button>
                                    <button onClick={saveEdit} disabled={editLoading} className={`flex-1 py-1 bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'} text-xs font-bold rounded disabled:opacity-50`}>
                                        {editLoading ? '...' : 'Save'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {!editMode && (
                            <>
                                <div className="space-y-1.5 mb-3 text-xs">
                                    <div className={`flex justify-between py-1 border-b border-${currentTheme.border}`}>
                                        <span className={`text-${currentTheme.textMuted}`}>Name</span>
                                        <span className={`text-${currentTheme.text}`}>{selectedUser.first_name} {selectedUser.last_name || '—'}</span>
                                    </div>
                                    <div className={`flex justify-between py-1 border-b border-${currentTheme.border}`}>
                                        <span className={`text-${currentTheme.textMuted}`}>Phone</span>
                                        <span className={`text-${currentTheme.text}`}>{selectedUser.phone || '—'}</span>
                                    </div>
                                    <div className={`flex justify-between py-1 border-b border-${currentTheme.border}`}>
                                        <span className={`text-${currentTheme.textMuted}`}>Referral ID</span>
                                        <span className={`text-${currentTheme.text} font-mono text-[10px]`}>{selectedUser.referral_id || '—'}</span>
                                    </div>
                                    <div className={`flex justify-between py-1 border-b border-${currentTheme.border}`}>
                                        <span className={`text-${currentTheme.textMuted}`}>Joined</span>
                                        <span className={`text-${currentTheme.text}`}>{formatDate(selectedUser.created_at)}</span>
                                    </div>
                                    <div className={`flex justify-between py-1 border-b border-${currentTheme.border}`}>
                                        <span className={`text-${currentTheme.textMuted}`}>Referrals</span>
                                        <span className={`text-${currentTheme.text}`}>{selectedUser.simple_referral_count || 0}</span>
                                    </div>
                                </div>

                                {userStats[selectedUser.id] && (
                                    <div className="mb-3">
                                        <h4 className={`text-${currentTheme.text} font-semibold text-xs mb-2`}>Game Stats</h4>
                                        <div className="grid grid-cols-2 gap-1.5">
                                            <div className={`bg-${currentTheme.border}/50 rounded p-2`}>
                                                <p className={`text-${currentTheme.textMuted} text-[10px]`}>Total Games</p>
                                                <p className={`text-${currentTheme.text} font-bold text-sm`}>{userStats[selectedUser.id].totalGames}</p>
                                            </div>
                                            <div className={`bg-${currentTheme.border}/50 rounded p-2`}>
                                                <p className={`text-${currentTheme.textMuted} text-[10px]`}>Best Score</p>
                                                <p className={`text-${currentTheme.accent} font-bold text-sm`}>{userStats[selectedUser.id].bestScore ?? '—'}</p>
                                            </div>
                                            <div className={`bg-${currentTheme.border}/50 rounded p-2 col-span-2`}>
                                                <p className={`text-${currentTheme.textMuted} text-[10px]`}>Average Score</p>
                                                <p className={`text-${currentTheme.text} font-bold text-sm`}>{userStats[selectedUser.id].averageScore ?? '—'}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Action buttons - only show based on permissions */}
                                {(canResetPassword || canEditEmail || canEditDetails) && (
                                    <div className="space-y-1.5">
                                        <div className="grid grid-cols-3 gap-1">
                                            {canResetPassword && (
                                                <button
                                                    onClick={() => startEdit('password')}
                                                    className="py-1.5 bg-blue-600 text-white text-[10px] font-medium rounded hover:bg-blue-500"
                                                >
                                                    Reset PW
                                                </button>
                                            )}
                                            {canEditEmail && (
                                                <button
                                                    onClick={() => startEdit('email')}
                                                    className="py-1.5 bg-purple-600 text-white text-[10px] font-medium rounded hover:bg-purple-500"
                                                >
                                                    Edit Email
                                                </button>
                                            )}
                                            {canEditDetails && (
                                                <button
                                                    onClick={() => startEdit('details')}
                                                    className={`py-1.5 bg-${currentTheme.border} text-${currentTheme.text} text-[10px] font-medium rounded hover:bg-${currentTheme.card}`}
                                                >
                                                    Edit Info
                                                </button>
                                            )}
                                        </div>

                                        {canDisableUser(selectedUser) && (
                                            <button
                                                onClick={() => toggleUserStatus(selectedUser)}
                                                className={`w-full py-1.5 rounded text-xs font-medium ${selectedUser.is_disabled ? 'bg-green-600 text-white hover:bg-green-500' : 'bg-red-600 text-white hover:bg-red-500'}`}
                                            >
                                                {selectedUser.is_disabled ? 'Enable Account' : 'Disable Account'}
                                            </button>
                                        )}

                                        {canToggleAdminOnUser(selectedUser) && (
                                            <button
                                                onClick={() => toggleAdminStatus(selectedUser)}
                                                className={`w-full py-1.5 rounded text-xs font-medium ${selectedUser.is_admin ? `bg-${currentTheme.border} text-${currentTheme.text} hover:bg-${currentTheme.card}` : `bg-${currentTheme.accent} text-${currentTheme.mode === 'dark' ? 'slate-900' : 'white'} hover:bg-${currentTheme.accentHover}`}`}
                                            >
                                                {selectedUser.is_admin ? 'Remove Admin' : 'Make Admin'}
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* View only message for support */}
                                {userRole === 'support' && (
                                    <div className={`mt-3 p-2 bg-${currentTheme.border}/50 rounded text-center`}>
                                        <p className={`text-${currentTheme.textMuted} text-xs`}>👁️ View Only Mode</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
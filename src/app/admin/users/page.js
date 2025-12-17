'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminUsersPage() {
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
        } catch (error) {
            console.error('Error updating user:', error)
        }
    }

    const toggleAdminStatus = async (user) => {
        const newStatus = !user.is_admin
        try {
            const { error } = await supabase
                .from('users')
                .update({ is_admin: newStatus })
                .eq('id', user.id)
            if (error) throw error
            setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_admin: newStatus } : u))
            if (selectedUser?.id === user.id) {
                setSelectedUser({ ...selectedUser, is_admin: newStatus })
            }
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
                    <div className="h-6 bg-slate-700 rounded w-48"></div>
                    <div className="h-64 bg-slate-800 rounded"></div>
                </div>
            </div>
        )
    }

    return (
        <div className="p-4">
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 w-full max-w-md mx-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-bold text-white">Quick Add User</h3>
                            <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">✕</button>
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
                                    <label className="block text-[10px] text-slate-400 mb-0.5">First Name</label>
                                    <input
                                        type="text"
                                        value={newUser.firstName}
                                        onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                                        className="w-full px-2 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                        placeholder="First"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-slate-400 mb-0.5">Last Name</label>
                                    <input
                                        type="text"
                                        value={newUser.lastName}
                                        onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                                        className="w-full px-2 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                        placeholder="Last"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] text-slate-400 mb-0.5">Username *</label>
                                <input
                                    type="text"
                                    value={newUser.username}
                                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                                    className="w-full px-2 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                    placeholder="username"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] text-slate-400 mb-0.5">Email *</label>
                                <input
                                    type="email"
                                    value={newUser.email}
                                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                    className="w-full px-2 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                    placeholder="email@example.com"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] text-slate-400 mb-0.5">Password *</label>
                                <input
                                    type="text"
                                    value={newUser.password}
                                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                    className="w-full px-2 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                    placeholder="password123"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] text-slate-400 mb-0.5">Phone</label>
                                <input
                                    type="text"
                                    value={newUser.phone}
                                    onChange={(e) => setNewUser({ ...newUser, phone: formatPhone(e.target.value) })}
                                    className="w-full px-2 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                    placeholder="(555) 123-4567"
                                />
                            </div>

                            <div className="flex gap-4 pt-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <button
                                        type="button"
                                        onClick={() => setNewUser({ ...newUser, isAdmin: !newUser.isAdmin })}
                                        className={`w-8 h-4 rounded-full transition-colors ${newUser.isAdmin ? 'bg-amber-500' : 'bg-slate-600'}`}
                                    >
                                        <div className={`w-3 h-3 bg-white rounded-full transition-transform ${newUser.isAdmin ? 'translate-x-4' : 'translate-x-0.5'}`}></div>
                                    </button>
                                    <span className="text-xs text-slate-300">Make Admin</span>
                                </label>

                                <label className="flex items-center gap-2 cursor-pointer">
                                    <button
                                        type="button"
                                        onClick={() => setNewUser({ ...newUser, emailVerified: !newUser.emailVerified })}
                                        className={`w-8 h-4 rounded-full transition-colors ${newUser.emailVerified ? 'bg-green-500' : 'bg-slate-600'}`}
                                    >
                                        <div className={`w-3 h-3 bg-white rounded-full transition-transform ${newUser.emailVerified ? 'translate-x-4' : 'translate-x-0.5'}`}></div>
                                    </button>
                                    <span className="text-xs text-slate-300">Email Verified</span>
                                </label>
                            </div>
                        </div>

                        <div className="flex gap-2 mt-4">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="flex-1 py-1.5 bg-slate-700 text-slate-300 text-xs font-medium rounded hover:bg-slate-600"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddUser}
                                disabled={addingUser || !newUser.username || !newUser.email || !newUser.password}
                                className="flex-1 py-1.5 bg-amber-500 text-slate-900 text-xs font-bold rounded hover:bg-amber-400 disabled:opacity-50"
                            >
                                {addingUser ? 'Creating...' : 'Create User'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-lg font-bold text-white">User Management</h1>
                    <p className="text-slate-400 text-xs">View and manage user accounts</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="px-3 py-1.5 bg-amber-500 text-slate-900 text-xs font-bold rounded hover:bg-amber-400"
                >
                    + Add User
                </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                <div className="bg-blue-500/10 border border-blue-500/20 rounded p-3">
                    <p className="text-slate-400 text-xs">Total Users</p>
                    <p className="text-xl font-bold text-blue-400">{stats.total}</p>
                </div>
                <div className="bg-green-500/10 border border-green-500/20 rounded p-3">
                    <p className="text-slate-400 text-xs">Active</p>
                    <p className="text-xl font-bold text-green-400">{stats.active}</p>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded p-3">
                    <p className="text-slate-400 text-xs">Disabled</p>
                    <p className="text-xl font-bold text-red-400">{stats.disabled}</p>
                </div>
                <div className="bg-purple-500/10 border border-purple-500/20 rounded p-3">
                    <p className="text-slate-400 text-xs">New This Week</p>
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
                        className="w-full px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                </div>
                <div className="flex gap-1">
                    {['all', 'active', 'disabled'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setFilter(tab)}
                            className={`px-3 py-1.5 rounded text-sm font-medium capitalize transition-all ${filter === tab ? 'bg-amber-500 text-slate-900' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex gap-3">
                <div className={`${selectedUser ? 'w-2/3' : 'w-full'} bg-slate-800 border border-slate-700 rounded overflow-hidden transition-all`}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-700">
                                    <th className="text-left py-2 px-3 text-slate-400 font-medium text-xs">User</th>
                                    <th className="text-left py-2 px-3 text-slate-400 font-medium text-xs">Email</th>
                                    <th className="text-left py-2 px-3 text-slate-400 font-medium text-xs">Joined</th>
                                    <th className="text-left py-2 px-3 text-slate-400 font-medium text-xs">Status</th>
                                    <th className="text-left py-2 px-3 text-slate-400 font-medium text-xs">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.length > 0 ? users.map(user => (
                                    <tr
                                        key={user.id}
                                        onClick={() => openUserDetails(user)}
                                        className={`border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer ${selectedUser?.id === user.id ? 'bg-slate-700/50' : ''}`}
                                    >
                                        <td className="py-2 px-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                                                    {user.username?.charAt(0).toUpperCase() || '?'}
                                                </div>
                                                <div>
                                                    <p className="text-white font-medium text-xs">{user.username}</p>
                                                    {user.first_name && <p className="text-slate-400 text-[10px]">{user.first_name} {user.last_name}</p>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-2 px-3 text-slate-300 text-xs">{user.email}</td>
                                        <td className="py-2 px-3 text-slate-400 text-xs">{formatDate(user.created_at)}</td>
                                        <td className="py-2 px-3">
                                            <div className="flex items-center gap-1">
                                                {user.is_admin && <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] font-medium rounded-full">Admin</span>}
                                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${user.is_disabled ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                                                    {user.is_disabled ? 'Disabled' : 'Active'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-2 px-3">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); toggleUserStatus(user) }}
                                                className={`px-2 py-1 rounded text-xs font-medium ${user.is_disabled ? 'bg-green-600 text-white hover:bg-green-500' : 'bg-red-600/80 text-white hover:bg-red-500'}`}
                                            >
                                                {user.is_disabled ? 'Enable' : 'Disable'}
                                            </button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan="5" className="py-8 text-center text-slate-400 text-sm">No users found</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {selectedUser && (
                    <div className="w-1/3 bg-slate-800 border border-slate-700 rounded p-3">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-bold text-white">User Details</h3>
                            <button onClick={() => setSelectedUser(null)} className="text-slate-400 hover:text-white text-sm">✕</button>
                        </div>

                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                                {selectedUser.username?.charAt(0).toUpperCase() || '?'}
                            </div>
                            <div>
                                <p className="text-white font-bold text-sm">{selectedUser.username}</p>
                                <p className="text-slate-400 text-xs">{selectedUser.email}</p>
                            </div>
                        </div>

                        {editMessage.text && (
                            <div className={`mb-2 px-2 py-1.5 rounded text-xs ${editMessage.type === 'error' ? 'bg-red-500/10 border border-red-500/30 text-red-400' : 'bg-green-500/10 border border-green-500/30 text-green-400'}`}>
                                {editMessage.text}
                            </div>
                        )}

                        {editMode === 'password' && (
                            <div className="mb-3 p-2 bg-slate-700/50 rounded">
                                <label className="block text-[10px] text-slate-400 mb-1">New Password</label>
                                <input
                                    type="text"
                                    value={editData.password}
                                    onChange={(e) => setEditData({ password: e.target.value })}
                                    className="w-full px-2 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded text-white mb-2"
                                    placeholder="Enter new password"
                                />
                                <div className="flex gap-1">
                                    <button onClick={cancelEdit} className="flex-1 py-1 bg-slate-600 text-white text-xs rounded">Cancel</button>
                                    <button onClick={saveEdit} disabled={editLoading || !editData.password} className="flex-1 py-1 bg-amber-500 text-slate-900 text-xs font-bold rounded disabled:opacity-50">
                                        {editLoading ? '...' : 'Save'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {editMode === 'email' && (
                            <div className="mb-3 p-2 bg-slate-700/50 rounded">
                                <label className="block text-[10px] text-slate-400 mb-1">Email Address</label>
                                <input
                                    type="email"
                                    value={editData.email}
                                    onChange={(e) => setEditData({ email: e.target.value })}
                                    className="w-full px-2 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded text-white mb-2"
                                />
                                <div className="flex gap-1">
                                    <button onClick={cancelEdit} className="flex-1 py-1 bg-slate-600 text-white text-xs rounded">Cancel</button>
                                    <button onClick={saveEdit} disabled={editLoading || !editData.email} className="flex-1 py-1 bg-amber-500 text-slate-900 text-xs font-bold rounded disabled:opacity-50">
                                        {editLoading ? '...' : 'Save'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {editMode === 'details' && (
                            <div className="mb-3 p-2 bg-slate-700/50 rounded space-y-2">
                                <div>
                                    <label className="block text-[10px] text-slate-400 mb-0.5">First Name</label>
                                    <input
                                        type="text"
                                        value={editData.firstName}
                                        onChange={(e) => setEditData({ ...editData, firstName: e.target.value })}
                                        className="w-full px-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-slate-400 mb-0.5">Last Name</label>
                                    <input
                                        type="text"
                                        value={editData.lastName}
                                        onChange={(e) => setEditData({ ...editData, lastName: e.target.value })}
                                        className="w-full px-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-slate-400 mb-0.5">Phone</label>
                                    <input
                                        type="text"
                                        value={editData.phone}
                                        onChange={(e) => setEditData({ ...editData, phone: formatPhone(e.target.value) })}
                                        className="w-full px-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-white"
                                    />
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={cancelEdit} className="flex-1 py-1 bg-slate-600 text-white text-xs rounded">Cancel</button>
                                    <button onClick={saveEdit} disabled={editLoading} className="flex-1 py-1 bg-amber-500 text-slate-900 text-xs font-bold rounded disabled:opacity-50">
                                        {editLoading ? '...' : 'Save'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {!editMode && (
                            <>
                                <div className="space-y-1.5 mb-3 text-xs">
                                    <div className="flex justify-between py-1 border-b border-slate-700">
                                        <span className="text-slate-400">Name</span>
                                        <span className="text-white">{selectedUser.first_name} {selectedUser.last_name || '—'}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-slate-700">
                                        <span className="text-slate-400">Phone</span>
                                        <span className="text-white">{selectedUser.phone || '—'}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-slate-700">
                                        <span className="text-slate-400">Referral ID</span>
                                        <span className="text-white font-mono text-[10px]">{selectedUser.referral_id || '—'}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-slate-700">
                                        <span className="text-slate-400">Joined</span>
                                        <span className="text-white">{formatDate(selectedUser.created_at)}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-slate-700">
                                        <span className="text-slate-400">Referrals</span>
                                        <span className="text-white">{selectedUser.simple_referral_count || 0}</span>
                                    </div>
                                </div>

                                {userStats[selectedUser.id] && (
                                    <div className="mb-3">
                                        <h4 className="text-white font-semibold text-xs mb-2">Game Stats</h4>
                                        <div className="grid grid-cols-2 gap-1.5">
                                            <div className="bg-slate-700/50 rounded p-2">
                                                <p className="text-slate-400 text-[10px]">Total Games</p>
                                                <p className="text-white font-bold text-sm">{userStats[selectedUser.id].totalGames}</p>
                                            </div>
                                            <div className="bg-slate-700/50 rounded p-2">
                                                <p className="text-slate-400 text-[10px]">Best Score</p>
                                                <p className="text-amber-400 font-bold text-sm">{userStats[selectedUser.id].bestScore ?? '—'}</p>
                                            </div>
                                            <div className="bg-slate-700/50 rounded p-2 col-span-2">
                                                <p className="text-slate-400 text-[10px]">Average Score</p>
                                                <p className="text-white font-bold text-sm">{userStats[selectedUser.id].averageScore ?? '—'}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <div className="grid grid-cols-3 gap-1">
                                        <button
                                            onClick={() => startEdit('password')}
                                            className="py-1.5 bg-blue-600 text-white text-[10px] font-medium rounded hover:bg-blue-500"
                                        >
                                            Reset PW
                                        </button>
                                        <button
                                            onClick={() => startEdit('email')}
                                            className="py-1.5 bg-purple-600 text-white text-[10px] font-medium rounded hover:bg-purple-500"
                                        >
                                            Edit Email
                                        </button>
                                        <button
                                            onClick={() => startEdit('details')}
                                            className="py-1.5 bg-slate-600 text-white text-[10px] font-medium rounded hover:bg-slate-500"
                                        >
                                            Edit Info
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => toggleUserStatus(selectedUser)}
                                        className={`w-full py-1.5 rounded text-xs font-medium ${selectedUser.is_disabled ? 'bg-green-600 text-white hover:bg-green-500' : 'bg-red-600 text-white hover:bg-red-500'}`}
                                    >
                                        {selectedUser.is_disabled ? 'Enable Account' : 'Disable Account'}
                                    </button>
                                    <button
                                        onClick={() => toggleAdminStatus(selectedUser)}
                                        className={`w-full py-1.5 rounded text-xs font-medium ${selectedUser.is_admin ? 'bg-slate-600 text-white hover:bg-slate-500' : 'bg-amber-600 text-white hover:bg-amber-500'}`}
                                    >
                                        {selectedUser.is_admin ? 'Remove Admin' : 'Make Admin'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
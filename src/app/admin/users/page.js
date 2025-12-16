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

    const formatDate = (dateString) => {
        if (!dateString) return '—'
        return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
    }

    const openUserDetails = (user) => {
        setSelectedUser(user)
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
            <div className="mb-4">
                <h1 className="text-lg font-bold text-white">User Management</h1>
                <p className="text-slate-400 text-xs">View and manage user accounts</p>
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

                        <div className="space-y-1.5 mb-3 text-xs">
                            <div className="flex justify-between py-1 border-b border-slate-700">
                                <span className="text-slate-400">Name</span>
                                <span className="text-white">{selectedUser.first_name} {selectedUser.last_name || '—'}</span>
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
                    </div>
                )}
            </div>
        </div>
    )
}
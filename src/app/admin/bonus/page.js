'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminBonusPage() {
    const [loading, setLoading] = useState(true)
    const [users, setUsers] = useState([])
    const [selectedUser, setSelectedUser] = useState('')
    const [searchTerm, setSearchTerm] = useState('')
    const [amount, setAmount] = useState('')
    const [message, setMessage] = useState('')
    const [reason, setReason] = useState('')
    const [giving, setGiving] = useState(false)
    const [history, setHistory] = useState([])
    const [feedback, setFeedback] = useState('')

    useEffect(() => {
        loadUsers()
        loadHistory()
    }, [])

    const loadUsers = async () => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('id, username, first_name, last_name, email')
                .order('username')

            if (error) throw error
            setUsers(data || [])
        } catch (error) {
            console.error('Error loading users:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadHistory = async () => {
        try {
            const { data, error } = await supabase
                .from('bonus_views_history')
                .select(`
                    *,
                    user:users!bonus_views_history_user_id_fkey(username, first_name, last_name),
                    admin:users!bonus_views_history_given_by_fkey(username)
                `)
                .order('created_at', { ascending: false })
                .limit(20)

            if (error) throw error
            setHistory(data || [])
        } catch (error) {
            console.error('Error loading history:', error)
        }
    }

    const handleGiveBonus = async () => {
        if (!selectedUser || !amount) {
            setFeedback('Please select a user and enter an amount')
            return
        }

        setGiving(true)
        setFeedback('')

        try {
            const { data: { user: adminUser } } = await supabase.auth.getUser()

            const { data: campaign } = await supabase
                .from('ad_campaigns')
                .select('id, bonus_views')
                .eq('user_id', selectedUser)
                .eq('status', 'active')
                .maybeSingle()

            if (campaign) {
                await supabase
                    .from('ad_campaigns')
                    .update({
                        bonus_views: (campaign.bonus_views || 0) + parseInt(amount),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', campaign.id)

                await supabase
                    .from('bonus_views_history')
                    .insert([{
                        user_id: selectedUser,
                        campaign_id: campaign.id,
                        amount: parseInt(amount),
                        message: message || null,
                        reason: reason || null,
                        given_by: adminUser.id
                    }])

                await supabase
                    .from('notifications')
                    .insert([{
                        user_id: selectedUser,
                        type: 'bonus_views',
                        title: '🎉 You received bonus views!',
                        message: message || `You've been awarded ${amount} bonus views!`
                    }])

                setFeedback(`Successfully gave ${amount} bonus views!`)
                setSelectedUser('')
                setAmount('')
                setMessage('')
                setReason('')
                loadHistory()
            } else {
                setFeedback('User does not have an active campaign')
            }
        } catch (error) {
            console.error('Error giving bonus:', error)
            setFeedback('Error: ' + error.message)
        } finally {
            setGiving(false)
        }
    }

    const filteredUsers = users.filter(user => {
        const search = searchTerm.toLowerCase()
        return (
            user.username?.toLowerCase().includes(search) ||
            user.first_name?.toLowerCase().includes(search) ||
            user.last_name?.toLowerCase().includes(search) ||
            user.email?.toLowerCase().includes(search)
        )
    })

    const getUserDisplay = (user) => {
        if (user.first_name && user.last_name) {
            return `${user.first_name} ${user.last_name} (${user.username})`
        }
        return user.username
    }

    if (loading) {
        return (
            <div className="p-4">
                <div className="flex items-center justify-center h-32">
                    <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            </div>
        )
    }

    return (
        <div className="p-4">
            <div className="mb-4">
                <h1 className="text-lg font-bold text-white">Give Bonus Views</h1>
                <p className="text-slate-400 text-xs">Award extra views to advertisers</p>
            </div>

            {/* Give Bonus Form */}
            <div className="bg-slate-800 border border-slate-700 rounded p-3 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* User Selection */}
                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                            Select User *
                        </label>
                        <input
                            type="text"
                            placeholder="Search by name or username..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-2 py-1.5 mb-1 bg-slate-700 border border-slate-600 rounded text-sm text-white placeholder-slate-400"
                        />
                        <select
                            value={selectedUser}
                            onChange={(e) => setSelectedUser(e.target.value)}
                            className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                        >
                            <option value="">-- Select User --</option>
                            {filteredUsers.map(user => (
                                <option key={user.id} value={user.id}>
                                    {getUserDisplay(user)}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Amount */}
                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                            Number of Bonus Views *
                        </label>
                        <input
                            type="number"
                            min="1"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="e.g. 50"
                            className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white placeholder-slate-400"
                        />
                    </div>

                    {/* Message (User sees this) */}
                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                            Message to User <span className="text-slate-500">(visible)</span>
                        </label>
                        <input
                            type="text"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="e.g. Thanks for your patience!"
                            className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white placeholder-slate-400"
                        />
                    </div>

                    {/* Reason (Admin only) */}
                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                            Private Reason <span className="text-slate-500">(admin only)</span>
                        </label>
                        <input
                            type="text"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="e.g. Customer complaint resolved"
                            className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white placeholder-slate-400"
                        />
                    </div>
                </div>

                <div className="mt-3 flex items-center gap-3">
                    <button
                        onClick={handleGiveBonus}
                        disabled={giving || !selectedUser || !amount}
                        className="px-4 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 text-sm font-bold rounded hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {giving ? 'Giving...' : 'Give Bonus Views'}
                    </button>

                    {feedback && (
                        <p className={`text-xs ${feedback.includes('Error') ? 'text-red-400' : 'text-green-400'}`}>
                            {feedback}
                        </p>
                    )}
                </div>
            </div>

            {/* History */}
            <h2 className="text-sm font-bold text-white mb-2">Recent Bonus History</h2>
            <div className="bg-slate-800 border border-slate-700 rounded overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-700">
                        <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-slate-300">Date</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-slate-300">User</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-slate-300">Amount</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-slate-300">Message</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-slate-300">Reason</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-slate-300">Given By</th>
                        </tr>
                    </thead>
                    <tbody>
                        {history.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="px-3 py-6 text-center text-slate-400 text-sm">
                                    No bonus views have been given yet
                                </td>
                            </tr>
                        ) : (
                            history.map((item) => (
                                <tr key={item.id} className="border-t border-slate-700">
                                    <td className="px-3 py-2 text-xs text-slate-300">
                                        {new Date(item.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-white">
                                        {item.user?.first_name && item.user?.last_name
                                            ? `${item.user.first_name} ${item.user.last_name}`
                                            : item.user?.username || 'Unknown'}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-green-400 font-bold">
                                        +{item.amount}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-slate-300">
                                        {item.message || '-'}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-slate-400 italic">
                                        {item.reason || '-'}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-slate-300">
                                        {item.admin?.username || 'Unknown'}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
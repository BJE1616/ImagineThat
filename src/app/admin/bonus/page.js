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
            // Get current user (admin)
            const { data: { user: adminUser } } = await supabase.auth.getUser()

            // Get user's active campaign
            const { data: campaign } = await supabase
                .from('ad_campaigns')
                .select('id, bonus_views')
                .eq('user_id', selectedUser)
                .eq('status', 'active')
                .maybeSingle()

            // Update campaign bonus_views
            if (campaign) {
                await supabase
                    .from('ad_campaigns')
                    .update({
                        bonus_views: (campaign.bonus_views || 0) + parseInt(amount),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', campaign.id)

                // Record in history
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

                // Send notification to user
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
            <div className="p-8">
                <div className="flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            </div>
        )
    }

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold text-white mb-6">Give Bonus Views</h1>

            {/* Give Bonus Form */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* User Selection */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Select User *
                        </label>
                        <input
                            type="text"
                            placeholder="Search by name or username..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-3 py-2 mb-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400"
                        />
                        <select
                            value={selectedUser}
                            onChange={(e) => setSelectedUser(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
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
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Number of Bonus Views *
                        </label>
                        <input
                            type="number"
                            min="1"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="e.g. 50"
                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400"
                        />
                    </div>

                    {/* Message (User sees this) */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Message to User <span className="text-slate-400">(they will see this)</span>
                        </label>
                        <input
                            type="text"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="e.g. Thanks for your patience!"
                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400"
                        />
                    </div>

                    {/* Reason (Admin only) */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Private Reason <span className="text-slate-400">(admin only)</span>
                        </label>
                        <input
                            type="text"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="e.g. Customer complaint resolved"
                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400"
                        />
                    </div>
                </div>

                <div className="mt-4">
                    <button
                        onClick={handleGiveBonus}
                        disabled={giving || !selectedUser || !amount}
                        className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 font-bold rounded-lg hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {giving ? 'Giving...' : 'Give Bonus Views'}
                    </button>

                    {feedback && (
                        <p className={`mt-2 text-sm ${feedback.includes('Error') ? 'text-red-400' : 'text-green-400'}`}>
                            {feedback}
                        </p>
                    )}
                </div>
            </div>

            {/* History */}
            <h2 className="text-xl font-bold text-white mb-4">Recent Bonus History</h2>
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-700">
                        <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Date</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">User</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Amount</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Message</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Reason (Private)</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Given By</th>
                        </tr>
                    </thead>
                    <tbody>
                        {history.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="px-4 py-8 text-center text-slate-400">
                                    No bonus views have been given yet
                                </td>
                            </tr>
                        ) : (
                            history.map((item) => (
                                <tr key={item.id} className="border-t border-slate-700">
                                    <td className="px-4 py-3 text-sm text-slate-300">
                                        {new Date(item.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-white">
                                        {item.user?.first_name && item.user?.last_name
                                            ? `${item.user.first_name} ${item.user.last_name}`
                                            : item.user?.username || 'Unknown'}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-green-400 font-bold">
                                        +{item.amount}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-300">
                                        {item.message || '-'}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-400 italic">
                                        {item.reason || '-'}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-300">
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